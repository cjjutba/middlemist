# Authorization

Authentication answers "who is this." Authorization answers "what may they do." Middlemist's authorization model is row-level isolation (every authenticated query is filtered by `userId`) plus a narrower client-portal model (every portal query is filtered by `userId` and `clientId`). The mechanics live in `docs/architecture/multi-tenancy.md` and the four-layer enforcement is described there. This document covers the rules, the principal types, the edge cases, and the checklist a contributor uses before merging a server action.

## Principal types

Two authenticated principals and one anonymous-but-authorized principal.

### 1. Authenticated freelancer

The owner of a `User` row. Established by the Auth.js session cookie (see `docs/security/authentication.md`). Has full read/write access to every row owned by their `userId`. Cannot read or write any row owned by another user.

The session cookie's payload includes `userId` and a `passwordVersion` claim; both are verified on every request. A freelancer's authorization scope equals their `userId`. Nothing more.

### 2. Client portal session

A magic-link-redeemed cookie scoped to one freelancer (`userId`) and one client (`clientId`). Established by `docs/security/magic-links.md`. Has read-only access to entities that are jointly owned by `(userId, clientId)`: projects, updates marked client-visible, proposals associated with that client, invoices associated with that client. Has no write capability for v1 except a single state transition: accepting or declining a proposal (and that transition runs through the public-link flow, not the portal-cookie flow, because acceptance happens on `/p/[token]` rather than `/portal`).

The portal session's authorization scope is the tuple `(userId, clientId)`. Portal repository functions accept `PortalContext` instead of `userId` (see `docs/architecture/multi-tenancy.md`).

### 3. Public-token holder (not a principal)

A possessor of a `nanoid(21)` token in a URL. Not a principal in the strict sense — there is no session, no identity, no claim. The token is the credential and the row that matches the token is the entire authorization scope.

Public-token possession grants:

- **Read** of the specific Proposal or Invoice referenced by the token.
- **One state transition for proposals only**: accept or decline. The transition writes a typed signature, captures IP and user agent, and updates `Proposal.status` and `Proposal.acceptedAt` / `declinedAt`. There is no other write capability.

Public-token possession does _not_ grant any of the following: read of any other row, listing of entities, impersonation of the freelancer, access to the dashboard, access to other proposals or invoices owned by the same freelancer.

## Authorization rules

### Rule 1: never accept `userId` from client input

Server actions take typed input that does not include `userId`. The wrapper extracts `userId` from the session and passes it to the handler. A handler that destructures `userId` from input is a security bug, and code review rejects it.

```typescript
// FORBIDDEN — never accept userId from input
export const updateClientBad = async (input: { userId: string; id: string; name: string }) => {
  return clientsRepo.update(input.userId, input.id, { name: input.name });
};

// CORRECT — userId comes from withAuth, input is name + id only
export const updateClient = withAuth(
  z.object({ id: z.string(), name: z.string().min(1).max(120) }),
  async (userId, input) => {
    return clientsRepo.update(userId, input.id, { name: input.name });
  },
);
```

### Rule 2: never trust headers like `x-user-id`

Headers can be forged. The session cookie is the only proof of identity; the Auth.js library verifies its signature and extracts `userId`. No code path reads `x-user-id` or any equivalent custom header.

### Rule 3: never assert ownership only in the UI

A "the edit button is hidden if you do not own this row" approach is not authorization. Any client can craft a request directly to a server action; the action must re-check ownership. The repository pattern makes the check automatic: `clientsRepo.update(userId, id, ...)` does not exist as "update by id"; it exists as "update by id where userId matches." A request from user A trying to mutate user B's row gets `count: 0` from `updateMany` and the action throws.

### Rule 4: every authenticated entry point goes through `withAuth`

Server actions, route handlers that read user data, and any other surface that exposes data to a logged-in user runs through `withAuth` (or, for route handlers, the equivalent explicit `auth()` call followed by a `userId` extraction). A surface that does _not_ go through this pattern is treated as a bug.

### Rule 5: portal queries take `PortalContext`, not `userId`

The portal session is narrower than the freelancer session. Repository functions used by portal routes take `{ userId, clientId }` and inject both into every Prisma `where` clause. A portal route that calls a `userId`-only repository function risks exposing rows that belong to a different client of the same freelancer.

```typescript
// portal repo
export const portalRepo = {
  async listProjects(ctx: PortalContext) {
    return prisma.project.findMany({
      where: { userId: ctx.userId, clientId: ctx.clientId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  },
};
```

### Rule 6: public-token routes look up by token only

Public routes call `*Repo.findByPublicToken(token)`. They do not accept `userId` from input, do not read a session, and do not read any header that could be forged. The lookup is the access proof; the row that matches is the entire authorization scope.

## Authorization checklist for every server action

Before merging a new server action, the author confirms each of the following:

- **Wrapped in `withAuth`?** Or for public-token actions, named with a `Public` suffix and rate-limited explicitly?
- **All Prisma access through repository functions that take `userId`?** No direct `prisma.*` calls in the action file.
- **Repository functions inject `userId` (or `userId + clientId` for portal) into every `where`?** Confirmed by code review and by the isolation test that runs on the matching repo.
- **Audit log written for state changes?** Every action that mutates writes a row through `writeAudit`.
- **Two-user isolation test for the underlying repository function?** A test seeds rows for users A and B and proves A's query cannot see B's data.
- **Input zod-parsed?** The action's first parameter is the schema; the wrapper runs `safeParse` before the handler.

A pull request is incomplete until all six are checked.

## Worked example: updating a project

The full chain from action to repo demonstrates every layer. Below is an end-to-end implementation of "rename a project" with every authorization check made explicit.

```typescript
// src/lib/schemas/project.schema.ts
import { z } from 'zod';

export const updateProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
});
```

```typescript
// src/lib/repositories/projects.repo.ts (excerpt)
import { prisma } from '@/lib/prisma';

export const projectsRepo = {
  async findById(userId: string, id: string) {
    return prisma.project.findFirst({
      where: { id, userId, archivedAt: null },
    });
  },

  async update(userId: string, id: string, input: { name: string; description?: string | null }) {
    const result = await prisma.project.updateMany({
      where: { id, userId },
      data: input,
    });
    if (result.count === 0) throw new Error('PROJECT_NOT_FOUND');
    return projectsRepo.findById(userId, id);
  },
};
```

```typescript
// src/lib/services/projects.service.ts
import { projectsRepo } from '@/lib/repositories/projects.repo';
import { writeAudit } from '@/lib/audit/write';

export const projectsService = {
  async rename(userId: string, id: string, input: { name: string; description?: string | null }) {
    const before = await projectsRepo.findById(userId, id);
    if (!before) throw new Error('PROJECT_NOT_FOUND');
    const after = await projectsRepo.update(userId, id, input);
    await writeAudit({
      userId,
      action: 'project.updated',
      entityType: 'project',
      entityId: id,
      metadata: {
        nameChanged: before.name !== input.name,
        from: before.name,
        to: input.name,
      },
    });
    return after;
  },
};
```

```typescript
// src/actions/projects.ts
'use server';
import { withAuth } from '@/lib/auth/with-auth';
import { updateProjectSchema } from '@/lib/schemas/project.schema';
import { projectsService } from '@/lib/services/projects.service';
import { revalidatePath } from 'next/cache';

export const updateProject = withAuth(updateProjectSchema, async (userId, input) => {
  const project = await projectsService.rename(userId, input.id, {
    name: input.name,
    description: input.description ?? null,
  });
  revalidatePath(`/projects/${input.id}`);
  return project;
});
```

The chain has authorization checks at each level. The action wrapper supplies `userId`. The service function passes `userId` through. The repository function injects `userId` into every Prisma where clause. A request from user A trying to rename user B's project finds `result.count === 0` in the repo, throws `PROJECT_NOT_FOUND`, and the action returns `{ ok: false, error: "PROJECT_NOT_FOUND" }`. No row of user B's was read or written.

## Public-route authorization

Public routes (`/p/[token]`, `/i/[token]`, `/api/pdf/public/proposal/[token]`, `/api/pdf/public/invoice/[token]`) skip the freelancer session entirely. Their authorization is the token-by-lookup pattern.

```typescript
// src/app/p/[token]/page.tsx
import { proposalsRepo } from "@/lib/repositories/proposals.repo";
import { writeAudit } from "@/lib/audit/write";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await proposalsRepo.findByPublicToken(token);
  if (!proposal) notFound();
  if (proposal.status === "archived") notFound();

  const h = await headers();
  await writeAudit({
    userId: null,
    action: "proposal.viewed",
    entityType: "proposal",
    entityId: proposal.id,
    metadata: {},
    ip: h.get("x-forwarded-for") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  });

  return <ProposalView proposal={proposal} />;
}
```

The route reads only the row that matches the token. There is no list. There is no enumeration. There is no path to discover a token by guessing.

## Cross-tenant edge cases

Three scenarios trip authorization checks; each is handled explicitly.

**Freelancer attaches a Task to a Project they do not own.** The task creation action takes `projectId` as input. The repository function calls `projectsRepo.findById(userId, projectId)` first; if the project does not belong to the freelancer, the function returns null and the action throws `PROJECT_NOT_FOUND`. The Task row is never created. The error message is the same as for "project does not exist" so an attacker probing IDs cannot distinguish "exists for someone else" from "does not exist."

**Freelancer A invoices a project owned by freelancer B.** Same pattern. Invoice creation requires `projectId` as input; the repository checks `userId` ownership before creating the invoice.

**Freelancer A regenerates the public token of freelancer B's proposal.** The "regenerate token" action runs through the same `proposalsRepo.update(userId, id, { publicToken: newToken })` path; `updateMany` returns count 0 and the action throws.

**Portal session attempts to read a project owned by a different client of the same freelancer.** The portal repository function filters by `clientId` as well as `userId`. A client A whose portal session has `clientId = clientA.id` cannot read projects of `clientB.id` even though both belong to the same freelancer.

**Public-token holder of an accepted proposal attempts to accept it again.** The accept action checks the current status; if status is already `accepted` or `declined`, the action returns `ALREADY_DECIDED`. The proposal row remains immutable on this point.

**Public-token holder attempts to use the token for the public PDF after the freelancer regenerated it.** Token regeneration overwrites `Proposal.publicToken`. The unique index ensures only one valid token at a time. The previous holder's request to `/api/pdf/public/proposal/[oldToken]` returns 404 because the lookup finds no row.

## Failure mode

Every authorization failure must result in one of three responses, in this order of preference.

1. **Equivalent "not found"** for cross-tenant access (`updateMany` count 0, `findFirst` returns null). The attacker cannot distinguish "exists but you do not own it" from "does not exist." Used for routes that list or read by id.
2. **401 unauthenticated** when the session cookie is missing or invalid. The middleware handles this for `app/(app)/*` by redirecting to `/login`.
3. **403 forbidden** is reserved for one case: an authenticated freelancer attempting an explicitly forbidden state transition (e.g., accepting a proposal on behalf of a client). 403 is rare; most failures are "not found" by design.

A 500 error is always a bug. Authorization paths return defined responses; they do not surface stack traces.
