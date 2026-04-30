# 0006: Shared Database, Row-Level Tenancy

**Date:** 2026-04-29
**Status:** Accepted

## Context

Middlemist is multi-tenant: many freelancers, each with their own clients, projects, proposals, invoices, and so on. Every authenticated read and write must be scoped to one freelancer's data. A leak across tenants would be product-ending: a portfolio project that exposed one paying client's invoices to another would close out the case study and the practice attached to it.

There are three standard patterns for SaaS multi-tenancy:

1. **Database-per-tenant.** Each freelancer gets their own Postgres database. Complete isolation at the storage level.
2. **Schema-per-tenant.** All freelancers share one database; each gets their own Postgres schema (e.g., `tenant_abc.invoice`).
3. **Shared-database row-level isolation.** All freelancers share one database and one schema. Every per-tenant row carries `userId`. Application code includes `userId` in every query.

Each pattern has a different cost surface and a different failure mode. Middlemist must pick one for v1 and build around it.

## Decision

Use shared-database row-level isolation. Every per-tenant table carries `userId` directly (or through a parent that does, for subordinate tables like `InvoiceLineItem`). Every authenticated query filters by `userId`. Public-link tables (Proposal, Invoice, ClientPortalSession) use token lookups that authenticate the row directly.

Defense in depth: four enforcement layers, all required.

1. **Repository pattern.** All Prisma access through `src/lib/repositories/*.repo.ts`. Each function takes `userId` and includes it in `where`. Direct Prisma access outside the repository folder is forbidden by ESLint.
2. **Server Action wrapper.** A `withAuth` helper extracts `userId` from the session and passes it to the action handler. No action accepts `userId` from input.
3. **Public-link tokens.** Two-entity exception: tokens are the access proof for unauthenticated viewers. Tokens are 21 characters of nanoid for proposal/invoice plaintext storage; 48 characters hashed for magic-link tokens.
4. **Two-user isolation tests.** Every repository function is tested by seeding data for user A and user B and proving A's queries cannot see B's data and vice versa. New repos without isolation tests do not pass review.

The full enforcement details live in `multi-tenancy.md`.

## Consequences

**Positive**

- Lowest operational overhead. One database, one connection pool, one set of migrations, one backup. Neon's free tier and serverless connection model handle thousands of tenants on one branch.
- Cross-tenant analytical queries are trivial when needed (e.g., admin debugging). Schema-per-tenant makes these queries painful (UNION across N schemas); database-per-tenant makes them impossible without a separate analytics store.
- Migrations apply once. A column added to `Invoice` rolls out to all tenants in one statement. With schema-per-tenant, a migration runs N times; with database-per-tenant, a migration runs N times across N database connections.
- Familiar, well-understood pattern. Most production SaaS at small-to-medium scale runs this model. The failure mode is well-known and the defenses are well-known.

**Negative**

- A single missed `userId` filter is a leak. The defense is the four-layer enforcement and the tests. A bug in the application code can leak data across tenants in a way that database-per-tenant would prevent at the storage level.
- "Noisy neighbor" risk. A pathological query from one tenant can affect database-wide performance. Mitigation: per-user query patterns are bounded (a freelancer has at most a few thousand rows per entity); pathological queries are not a realistic v1 concern.
- No per-tenant geographic data residency. All data is in one Neon region. Acceptable for v1; if a tenant required EU residency or PH residency in v2, the response would be a separate deployment, not a per-tenant database.
- The migration to a more isolated model later (if scale or compliance demanded it) is a meaningful project. Not a v1 concern; the v2 wishlist does not currently include this.

## Alternatives Considered

**Database-per-tenant.** Stronger isolation at the storage level. Rejected because the operational complexity is high (one Neon database per signup, separate connections, separate migration runs), the cost scales with tenants, and the security gain at v1 scale does not justify the cost. Suitable for very large enterprise tenants with explicit contractual requirements; not a fit here.

**Schema-per-tenant.** A middle ground: one database, many schemas. Rejected because the migration story is awkward (Prisma can target one schema cleanly but not many), the cross-schema queries are clumsy, and the security gain over row-level (with proper enforcement) is small. Most SaaS that picks schema-per-tenant migrates to one of the other two patterns later.

**Row-level security (RLS) policies inside Postgres.** A defense-in-depth layer where Postgres itself enforces tenancy via per-row policies tied to a session variable. Considered seriously. Not adopted in v1 because the application-layer enforcement is already four-layer, RLS adds a second mental model, and the Prisma + RLS integration requires manual session variable management on every query. v2 candidate as an additional safety layer once the v1 surface is stable.

**Application-layer-only with no repository pattern.** Just remember to filter by `userId` everywhere. Rejected because human memory is the worst possible enforcement; one missed `where` clause is a leak. The repository pattern is non-negotiable.
