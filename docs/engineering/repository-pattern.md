# Repository pattern

The repository pattern is the first layer of multi-tenancy enforcement (`docs/architecture/multi-tenancy.md`) and the only layer that touches Prisma directly. Every Prisma query in the application flows through a repository function. Each function takes `userId` (or `PortalContext`) as its first argument and injects it into every `where` clause.

## Why

Three reasons that compound.

**Multi-tenant isolation.** Centralizing Prisma access means there is one place where the `userId` filter is added. A code review can scan a repo file and verify every function injects `userId`; the same audit on direct `prisma.*` calls scattered through actions and components would be impossible.

**Centralized queries.** When a query shape needs to change (an extra include, an index hint, a different sort), the change happens in one place. A view migration that changed every page that listed projects would be a nightmare; a change to `projectsRepo.list` propagates.

**Simpler tests.** Repository functions are small, pure-ish, and have a real Postgres behind them. They are the natural unit of test for multi-tenancy. Testing every action against the database would duplicate the coverage; testing every repo function once gives the same guarantee with a fraction of the code.

## Where

`src/lib/repositories/`. The only place `@prisma/client` is imported. ESLint enforces the boundary with the custom rule `no-direct-prisma`; CI fails if any file outside `src/lib/repositories/` imports `@/lib/prisma`.

```javascript
// eslint.config.js (excerpt)
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/lib/repositories/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/lib/prisma",
            message: "Import a repository function from src/lib/repositories instead.",
          },
        ],
      },
    ],
  },
}
```

The `prisma.ts` file itself sits at `src/lib/prisma.ts`; it exports the single `PrismaClient` instance. Its only legitimate consumer is files in `src/lib/repositories/`.

## Function shape

Every public repository function:

1. Takes `userId: string` (or `PortalContext`) as its first argument.
2. Injects that into every Prisma `where` clause.
3. Has an explicit return type (no leaked Prisma internals beyond what is necessary).
4. Uses `findFirst`/`updateMany` over `findUnique`/`update` when the lookup needs to be a composite of `id + userId`.

```typescript
// src/lib/repositories/clients.repo.ts
import { prisma } from "@/lib/prisma";
import type { Client, Currency } from "@prisma/client";

export const clientsRepo = {
  async findById(userId: string, id: string): Promise<Client | null> {
    return prisma.client.findFirst({
      where: { id, userId, archivedAt: null },
    });
  },

  async list(
    userId: string,
    filters: { search?: string; includeArchived?: boolean } = {}
  ): Promise<Client[]> {
    return prisma.client.findMany({
      where: {
        userId,
        ...(filters.includeArchived ? {} : { archivedAt: null }),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { companyName: { contains: filters.search, mode: "insensitive" } },
                { email: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  },

  async create(
    userId: string,
    input: {
      name: string;
      companyName?: string | null;
      email: string;
      phone?: string | null;
      website?: string | null;
      address?: string | null;
      taxId?: string | null;
      notes?: string | null;
      preferredCurrency?: Currency | null;
    }
  ): Promise<Client> {
    return prisma.client.create({
      data: { ...input, userId },
    });
  },

  async update(
    userId: string,
    id: string,
    input: Partial<{
      name: string;
      companyName: string | null;
      email: string;
      phone: string | null;
      website: string | null;
      address: string | null;
      taxId: string | null;
      notes: string | null;
      preferredCurrency: Currency | null;
    }>
  ): Promise<Client> {
    const result = await prisma.client.updateMany({
      where: { id, userId },
      data: input,
    });
    if (result.count === 0) throw new Error("CLIENT_NOT_FOUND");
    const updated = await clientsRepo.findById(userId, id);
    if (!updated) throw new Error("CLIENT_NOT_FOUND");
    return updated;
  },

  async archive(userId: string, id: string): Promise<void> {
    const result = await prisma.client.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) throw new Error("CLIENT_NOT_FOUND");
  },
};
```

Two patterns to recognize.

**`updateMany` over `update`.** `update` accepts a unique `where` and would succeed if the user owned a row with that id; if it does not, Prisma throws `P2025` ("record not found"). That throw is correct for "not found," but the wording leaks information ("the row exists for someone else"). `updateMany` with `{ id, userId }` returns `count: 0` for cross-tenant access; the helper checks count and throws the same `CLIENT_NOT_FOUND` error in both cases. The error vocabulary becomes uniform, the leak is closed, and the test for cross-tenant is "the row was not modified."

**`findFirst` over `findUnique`.** `findUnique` requires a unique constraint that matches the `where` shape. `id` is unique on its own, but the function should never look up by `id` alone — the `userId` filter must be present. `findFirst` accepts the composite filter without a uniqueness requirement and returns `null` for cross-tenant lookups.

## Naming

Conventional verbs across every repo:

| Method | Behavior |
|---|---|
| `findById(userId, id)` | Returns the row or `null`. Filters by `archivedAt: null` unless the entity has no soft-delete. |
| `findMany(userId, filters)` / `list(userId, filters)` | Returns an array. Sorted by a sensible default. |
| `create(userId, input)` | Inserts a row with `userId` baked in. |
| `update(userId, id, input)` | Updates fields. Throws `<ENTITY>_NOT_FOUND` for cross-tenant or missing rows. |
| `archive(userId, id)` | Sets `archivedAt = now`. |
| `unarchive(userId, id)` | Clears `archivedAt`. |
| `softDelete(userId, id)` | Sets `deletedAt = now` (used for entities with explicit deletion lifecycle, e.g., files). |

Cross-cutting helpers (search, count, exists) follow the same `userId`-first convention and are named for what they return:

```typescript
async countByStatus(userId: string, status: ProjectStatus): Promise<number>
async existsByEmail(userId: string, email: string): Promise<boolean>
```

## Return types

Explicit. The repository never returns `Promise<unknown>` or relies on Prisma's inferred return types in the public API. The reason: Prisma's inferred types depend on the exact `select` and `include` used at the call site; a function that returns "whatever Prisma inferred today" produces TypeScript errors at every call site when the query shape changes.

For functions that need to return a shape other than the bare model (e.g., a list with included relations), define the return type explicitly:

```typescript
import type { Client, Project } from "@prisma/client";

type ProjectWithClient = Project & { client: Pick<Client, "id" | "name" | "companyName"> };

async listWithClient(userId: string): Promise<ProjectWithClient[]> {
  return prisma.project.findMany({
    where: { userId },
    include: {
      client: { select: { id: true, name: true, companyName: true } },
    },
    orderBy: { updatedAt: "desc" },
  }) as Promise<ProjectWithClient[]>;
}
```

The cast at the boundary acknowledges the discrepancy between Prisma's inferred type and the explicit one. Prefer to widen the explicit type rather than narrow Prisma's; TypeScript catches missing fields at compile time.

## Service vs repository

**Repos are thin.** A repo function does the smallest amount of work needed to read or write a row: assemble the `where` clause, run the query, return the result. A repo does not call other repos, does not write audit, does not emit Inngest events.

**Services orchestrate.** A service function combines repo calls, applies business rules, writes audit, emits events, and returns a value to the action layer. Services are where multi-step logic lives.

```typescript
// src/lib/services/proposals.service.ts
import { proposalsRepo } from "@/lib/repositories/proposals.repo";
import { clientsRepo } from "@/lib/repositories/clients.repo";
import { writeAudit } from "@/lib/audit/write";
import { inngest } from "@/lib/inngest/client";
import { NotFoundError, ValidationError } from "@/lib/utils/errors";

export const proposalsService = {
  async send(userId: string, proposalId: string) {
    const proposal = await proposalsRepo.findById(userId, proposalId);
    if (!proposal) throw new NotFoundError("Proposal not found");
    if (proposal.status !== "draft") {
      throw new ValidationError("Only draft proposals can be sent");
    }
    const client = await clientsRepo.findById(userId, proposal.clientId);
    if (!client) throw new NotFoundError("Client not found");
    if (!client.emailValid) throw new ValidationError("Client email has bounced");

    const updated = await proposalsRepo.update(userId, proposalId, {
      status: "sent",
      sentAt: new Date(),
    });

    await writeAudit({
      userId,
      action: "proposal.sent",
      entityType: "proposal",
      entityId: proposalId,
      metadata: { from: "draft", to: "sent" },
    });

    await inngest.send({
      name: "proposal.sent",
      data: { userId, proposalId },
    });

    return updated;
  },
};
```

The service touches two repos, validates a state machine rule, writes audit, emits an event, and returns the final state. The action layer just calls `proposalsService.send` and returns the result envelope.

## Cross-tenant queries

Forbidden in v1. There is no path in the application code that needs to read across tenants except for cron-driven maintenance, which is documented separately.

If v2 introduces cross-tenant operations (e.g., an admin dashboard for the operator), a separate `admin.repo.ts` will house the elevated functions, each one clearly named (`adminListAllUsers`, `adminCountInvoices`) and each one wrapped in an authorization check that verifies the caller is the operator (or in v2, holds a specific role). The split keeps "this function reads any user's data" visible at every call site.

## Public-token repos

The repository function for public lookups does not take `userId`. The token *is* the access proof. The lookup happens by token; the row that matches is the entire authorization scope.

```typescript
// src/lib/repositories/proposals.repo.ts (excerpt)
async findByPublicToken(token: string) {
  return prisma.proposal.findUnique({
    where: { publicToken: token },
    include: { client: true, blocks: { orderBy: { position: "asc" } } },
  });
}
```

The function returns the row matching the token or `null`. The route handler is responsible for treating `null` as "not found" and returning 404 (not 403, not 401 — see `docs/security/authorization.md`).

The same pattern applies to `findByPublicToken` on `Invoice` and to `findByHashForRedeem` on `ClientPortalSession`.

## Cron-driven repos

Crons need to read across tenants by definition (e.g., "find every invoice that is overdue"). They use a small set of repo functions that are explicitly cross-tenant:

```typescript
// src/lib/repositories/invoices.repo.ts (excerpt)
async findOverdueAcrossTenants(now: Date) {
  return prisma.invoice.findMany({
    where: {
      status: { in: ["sent", "viewed"] },
      dueDate: { lt: now },
    },
    select: { id: true, userId: true },
  });
}
```

These functions are named with `AcrossTenants` (or a similar marker) and live in the same repo file as their per-tenant equivalents. The Inngest cron iterates the result and dispatches per-tenant events; the per-tenant event handlers go through the normal `userId`-scoped repos.

## Testing

Every repository function gets a two-user isolation test. The test seeds rows for two users, runs the function as user A, and asserts it cannot see user B's data — and vice versa.

```typescript
// src/lib/repositories/__tests__/clients.repo.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clientsRepo } from "../clients.repo";

describe("clientsRepo (multi-tenant isolation)", () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    userA = (await prisma.user.create({ data: { email: "a@test", name: "A", passwordHash: "x" } })).id;
    userB = (await prisma.user.create({ data: { email: "b@test", name: "B", passwordHash: "x" } })).id;

    await prisma.client.create({ data: { userId: userA, name: "Acme", email: "acme@a.test" } });
    await prisma.client.create({ data: { userId: userB, name: "Acme", email: "acme@b.test" } });
  });

  it("list returns only the calling user's clients", async () => {
    const aClients = await clientsRepo.list(userA);
    const bClients = await clientsRepo.list(userB);
    expect(aClients).toHaveLength(1);
    expect(bClients).toHaveLength(1);
    expect(aClients[0].email).toBe("acme@a.test");
    expect(bClients[0].email).toBe("acme@b.test");
  });

  it("findById returns null for cross-tenant access", async () => {
    const bClient = (await prisma.client.findFirst({ where: { userId: userB } }))!;
    const result = await clientsRepo.findById(userA, bClient.id);
    expect(result).toBeNull();
  });

  it("update is a no-op for cross-tenant access", async () => {
    const bClient = (await prisma.client.findFirst({ where: { userId: userB } }))!;
    await expect(
      clientsRepo.update(userA, bClient.id, { name: "Changed" })
    ).rejects.toThrow("CLIENT_NOT_FOUND");
    const reread = (await prisma.client.findUnique({ where: { id: bClient.id } }))!;
    expect(reread.name).toBe("Acme");
  });
});
```

The test runs against a real Postgres (Neon test branch in CI, Docker locally). Mocked Prisma cannot prove tenancy; the test must hit the database. See `docs/engineering/testing.md` for the test infrastructure.

A new repo without an isolation test does not pass review. The pattern is mechanical enough that the cost of writing the test is low; the cost of *not* writing it is the chance of a tenancy leak.
