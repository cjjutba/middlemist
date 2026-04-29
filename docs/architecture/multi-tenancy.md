# Multi-tenancy

This is the most important architecture document in Middlemist. Get it wrong and customer data leaks across accounts. The cost of a leak is product-ending: a portfolio project that exposed one paying client's invoices to another would close out the case study and the practice attached to it. The four enforcement layers below exist because no single layer is enough on its own.

## Strategy

Shared database, row-level isolation by `userId`. Every per-tenant table carries `userId` (directly or through a parent that does). Every authenticated query injects `userId` into the `where` clause. Public-link queries do not carry `userId` from the client; they look up by token only and let the lookup itself prove access.

Why this and not schema-per-tenant or database-per-tenant for v1:

- **Schema-per-tenant** means `CREATE SCHEMA` on signup and migrations applied per schema. Migrations across hundreds of schemas are slow and error-prone, and Prisma's introspection model does not handle multiple schemas elegantly. The operational complexity is real and the safety win is small if the application logic is correct.
- **Database-per-tenant** means provisioning a new Postgres database per signup. Cost scales linearly with users, not with usage; Neon supports it but ergonomics break (one connection pool per tenant, separate migration runs, separate backups). Acceptable for very large enterprise tenants; overkill for solo freelancers.

Shared-database row-level isolation is the standard pattern for SaaS at this scale. Done right, it scales to thousands of tenants on one database. Done wrong, it leaks. The four enforcement layers ensure done-right.

## Layer 1 — Repository pattern

Every Prisma query goes through a repository function in `src/lib/repositories/*.repo.ts`. Each function takes `userId` as its first argument and includes it in every Prisma `where` clause. There are no top-level repository functions for indirect-ownership tables (line items, attachments); those are accessed only through their parent's repo.

ESLint enforces the pattern. A custom rule `no-direct-prisma` forbids importing `@/lib/prisma` from any path that does not match `src/lib/repositories/`. CI fails on violation.

### Example: clients.repo.ts

```typescript
// src/lib/repositories/clients.repo.ts

import { prisma } from "@/lib/prisma";
import { Currency } from "@prisma/client";

export const clientsRepo = {
  async findById(userId: string, id: string) {
    return prisma.client.findFirst({
      where: { id, userId, archivedAt: null },
    });
  },

  async list(
    userId: string,
    filters: { search?: string; includeArchived?: boolean } = {}
  ) {
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
      companyName?: string;
      email: string;
      phone?: string;
      website?: string;
      address?: string;
      taxId?: string;
      notes?: string;
      preferredCurrency?: Currency;
    }
  ) {
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
  ) {
    const result = await prisma.client.updateMany({
      where: { id, userId },
      data: input,
    });
    if (result.count === 0) throw new Error("Client not found");
    return clientsRepo.findById(userId, id);
  },

  async archive(userId: string, id: string) {
    const result = await prisma.client.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) throw new Error("Client not found or already archived");
  },
};
```

Two patterns to notice:

- **`updateMany` over `update`.** Plain `prisma.client.update` accepts a unique `where` and would succeed if the user owned a client with that id, but if the id belongs to another user, Prisma throws a generic `P2025`. Using `updateMany` with a composite filter and checking `result.count` keeps the failure mode explicit and makes cross-tenant access a count-zero no-op rather than an exception that could leak the existence of a row.
- **`findFirst` over `findUnique`.** `findUnique` cannot include `userId` in the where (id alone is unique). `findFirst` accepts the composite filter without needing a unique constraint.

## Layer 2 — Server Action wrapper

Server Actions are the only mutation entry points the app exposes. Every action is wrapped with `withAuth`, which extracts `userId` from the session and refuses the call if no session is present. Actions do not accept `userId` from input. Ever.

### The wrapper

```typescript
// src/lib/auth/with-auth.ts

import { auth } from "@/lib/auth/config";
import { z } from "zod";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function withAuth<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (userId: string, input: TInput) => Promise<TOutput>
): (rawInput: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput) => {
    const session = await auth();
    if (!session?.user?.id) {
      return { ok: false, error: "UNAUTHENTICATED" };
    }
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
    }
    try {
      const data = await handler(session.user.id, parsed.data);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "UNKNOWN_ERROR" };
    }
  };
}
```

### Using it

```typescript
// src/app/(app)/clients/clients.action.ts
"use server";

import { withAuth } from "@/lib/auth/with-auth";
import { clientsRepo } from "@/lib/repositories/clients.repo";
import { createClientSchema } from "@/lib/schemas/client.schema";

export const createClient = withAuth(createClientSchema, async (userId, input) => {
  return clientsRepo.create(userId, input);
});
```

The action signature does not include `userId`. The wrapper does. Code review for any new action checks that the action does not destructure `userId` from input.

## Layer 3 — Public-link tables

Two entities are visible to unauthenticated viewers via a token in the URL: proposals (`/p/[token]`) and invoices (`/i/[token]`). Both have a `publicToken` column populated with `nanoid(21)` at row creation. The token is the only access proof. The repository function for public lookup looks like this:

```typescript
// src/lib/repositories/proposals.repo.ts (excerpt)

export const proposalsRepo = {
  async findByPublicToken(token: string) {
    return prisma.proposal.findUnique({
      where: { publicToken: token },
      include: { client: true },
    });
  },
  // ...
};
```

The function does not take `userId`. This is the one repository pattern that does not. The reason: the lookup itself is the access proof. The token is opaque, 21 characters of URL-safe alphabet, ~150 bits of entropy. It cannot be brute-forced in a useful timeframe; the route is rate-limited at 30 requests per minute per IP.

Tokens never expose `userId`. Public routes never display data from any other user's rows even if the URL is on the same domain. The Server Component that renders the public proposal calls only this repo function and renders only the row it returned; there is no way to "list public proposals" or to enumerate by adjacent ID.

The client portal magic-link flow uses a similar pattern but with hashed tokens — see `docs/architecture/public-links.md` for that variant.

## Layer 4 — Tests

Every repository function has a two-user isolation test. The test seeds two users with overlapping data (a client named the same, a project with the same name, an invoice with the same number) and proves that user A's repo calls cannot see user B's data and vice versa.

### Example test

```typescript
// src/lib/repositories/__tests__/clients.repo.test.ts

import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { clientsRepo } from "../clients.repo";

describe("clientsRepo (multi-tenant isolation)", () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    userA = (await prisma.user.create({ data: { email: "a@test", name: "A" } })).id;
    userB = (await prisma.user.create({ data: { email: "b@test", name: "B" } })).id;

    await prisma.client.create({
      data: { userId: userA, name: "Acme", email: "acme@a.test" },
    });
    await prisma.client.create({
      data: { userId: userB, name: "Acme", email: "acme@b.test" },
    });
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
    const bClient = await prisma.client.findFirst({ where: { userId: userB } });
    const result = await clientsRepo.findById(userA, bClient!.id);
    expect(result).toBeNull();
  });

  it("update is a no-op for cross-tenant access", async () => {
    const bClient = await prisma.client.findFirst({ where: { userId: userB } });
    await expect(
      clientsRepo.update(userA, bClient!.id, { name: "Changed" })
    ).rejects.toThrow("Client not found");
    const reread = await prisma.client.findUnique({ where: { id: bClient!.id } });
    expect(reread?.name).toBe("Acme");
  });
});
```

The test runs against a real Postgres (Neon branch dedicated to tests, or local Postgres in CI), not a mock. Mocked Prisma cannot prove isolation; only a real query against a real database can.

## The client portal session model

A client (not a freelancer) authenticates via magic link to view their own scope of one freelancer's data. The model is intentionally narrower than the freelancer's session.

When a client requests portal access:

1. The freelancer's UI (or an automated trigger) calls `clientPortal.issueLink(userId, clientId)`.
2. A random token is generated (`nanoid(48)`), hashed (`sha256`), and stored as `tokenHash` in `ClientPortalSession` along with `userId`, `clientId`, and `magicLinkExpiresAt = now + 1 hour`.
3. An email is sent to the client with the unhashed token in a URL: `/portal/[token]`.

When the client opens the link:

1. The route handler hashes the token and looks up `ClientPortalSession` by `tokenHash`. If not found or `magicLinkExpiresAt` has passed, render an "expired" page.
2. If `consumedAt` is null, set `consumedAt = now`, set `sessionExpiresAt = now + 7 days`, and issue a signed cookie carrying the session id.
3. Subsequent requests in the portal validate the cookie's session id against `ClientPortalSession`, check `sessionExpiresAt` is in the future, and resolve `userId` and `clientId` from the row.

Every portal query then filters by both `userId` and `clientId`. The portal cannot show:

- Other clients of the same freelancer.
- Projects, proposals, or invoices that belong to other clients of the same freelancer.
- Anything from a different freelancer.

The portal repository functions take a `PortalContext` (`{ userId, clientId }`) instead of just `userId`. Example:

```typescript
// src/lib/repositories/portal.repo.ts

type PortalContext = { userId: string; clientId: string };

export const portalRepo = {
  async listProjects(ctx: PortalContext) {
    return prisma.project.findMany({
      where: { userId: ctx.userId, clientId: ctx.clientId, archivedAt: null },
    });
  },
  async findInvoiceByNumber(ctx: PortalContext, number: string) {
    return prisma.invoice.findFirst({
      where: { userId: ctx.userId, clientId: ctx.clientId, number },
      include: { lineItems: true },
    });
  },
};
```

Tests for portal repo functions seed data for two clients of the same freelancer and prove client A cannot see client B's data.

## Defense in depth

No layer is sufficient on its own. The repository layer can be bypassed with a direct Prisma import (caught by lint, but lint is a fence not a wall). The action wrapper can be skipped if a developer adds a route handler that does not use it (caught by code review). The token lookup can be subverted by a typo in the where clause (caught by tests). The tests can have gaps (caught by review and by isolation-incidents that turn into added tests). All four layers together make a leak require multiple independent failures, which is the definition of defense-in-depth.

When in doubt, write the test that proves the property holds. If the test is hard to write, the boundary is unclear, and the boundary is what needs fixing.
