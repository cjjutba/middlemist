# 0003 — Prisma vs Drizzle

**Date:** 2026-04-29
**Status:** Accepted

## Context

Middlemist needs an ORM (or query builder) on top of Postgres. The two credible choices in the TypeScript ecosystem in 2026 are Prisma (a generated-client ORM with its own schema language) and Drizzle (a TypeScript-native query builder closer to raw SQL). Both have first-class types, serverless support, and active development.

The author has shipped FiscPlus on Prisma 5 and built up real muscle memory with the schema language, the migration tooling, the generated types, and Prisma Studio for ad-hoc data inspection. The author has not shipped Drizzle in production. The portfolio context favors a tool the author can move fast in.

## Decision

Use Prisma 6. Define the schema in `prisma/schema.prisma`. Wrap all access in repository functions per `multi-tenancy.md` Layer 1. Generate the client at build time. Run migrations with `prisma migrate`.

Prefer `findFirst` over `findUnique` for tenant-scoped queries (covered in `multi-tenancy.md`). Use `Decimal` for money columns. Use the `previewFeatures = ["fullTextSearch"]` flag where needed.

## Consequences

**Positive**

- Generated types flow into Server Components and Server Actions for free. `Prisma.ProposalGetPayload<{ include: {...} }>` is the standard pattern for "give me the type of a query result with these joins" and it works.
- Prisma Studio is a real productivity boost during early development for ad-hoc queries, fixture data, and visual schema exploration. There is no Drizzle equivalent that matches it.
- Migrations are well-trodden territory: `prisma migrate dev`, `prisma migrate deploy`, and a clean rollback story via squashed migrations. Neon's branch model plus Prisma's migrate plays well.
- The schema language is concise. The whole Middlemist data model fits in one file (see `data-model.md`), which makes pull requests that change the model easy to review.

**Negative**

- Prisma's runtime has a measurable startup cost on serverless cold-starts. The query engine is a separate process in some configurations; the in-process engine is improving but still bigger than Drizzle's overhead. v1 traffic is low enough that the cold-start cost is invisible to users.
- Prisma's SQL is hidden by the query builder. For unusual queries (recursive CTEs, lateral joins, advanced window functions), `$queryRaw` is the escape hatch. The escape hatch loses type safety; v1 does not need any of those queries.
- Schema changes that need to be expressed at the SQL level (e.g., GIN indexes for `pg_trgm`) are written as raw SQL in migration files; the schema file does not represent them. This is a workable convention but slightly clunkier than Drizzle's SQL-builder approach.
- The migration model has historically had quirks around shadow databases and divergence in CI; Prisma 6 has improved this but it is still occasionally a friction.

## Alternatives Considered

**Drizzle.** Lower runtime overhead, SQL-closer ergonomics, better story for advanced SQL features, no separate schema language. Rejected because the author lacks Drizzle muscle memory and the time cost of switching off Prisma is not justified by Middlemist's scale or query patterns. Drizzle is on the v2 candidate list if the project's needs ever outgrow Prisma's strengths.

**Kysely.** A pure query builder with great types. Rejected because it does not bundle migrations or a schema language; using Kysely means picking a separate migration tool (e.g., dbmate, Atlas, or hand-rolled SQL files) and a separate type-generation strategy. The integration cost outweighs the runtime savings.

**Direct SQL via `pg` and a hand-written types layer.** Maximum flexibility, maximum work. Rejected because the project does not need maximum flexibility; it needs predictable, reviewable, fast development.

**Prisma + Kysely for hot queries.** A hybrid. Rejected for v1 because no query is hot enough to need it, and the duplication of "two query layers" adds review surface.
