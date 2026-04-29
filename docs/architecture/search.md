# Search

Middlemist's global search (Cmd+K) and entity-specific filters use Postgres trigram matching via the `pg_trgm` extension plus `ILIKE` patterns. There is no external search service in v1. The implementation works at the scale Middlemist expects (tens of thousands of rows per user across all entities); a migration to Meilisearch is a v2 candidate if the ceiling is hit.

## Approach

Postgres `pg_trgm` provides similarity-based text matching: trigram-indexed columns can be searched with `ILIKE` patterns or with the `%` operator (similarity threshold). Combined with GIN indexes, the queries are fast at moderate scale. The reasoning over Algolia or Meilisearch:

- **No second data store** to keep in sync with the database.
- **No second vendor** with API keys, billing, and a second SLA.
- **One transactional write path.** Indexed columns are updated by Postgres on row writes; there is no eventual-consistency lag between the database and the search index.

The cost is that ranking is naive (similarity score plus a few hand-tuned weights) and the query language is limited to what `ILIKE` and `tsvector` support. For a freelance-ops product this is fine.

## What is searchable

Cmd+K searches across:

| Entity | Fields |
|---|---|
| Client | `name`, `companyName`, `email` |
| Project | `name`, `description` |
| Proposal | `title` |
| Invoice | `number` |
| Task | `title`, `description` |

Each result links to the relevant page. Entity-specific filters on list pages (clients, projects, invoices) reuse the same trigram-indexed columns.

## Cmd+K UX

The command palette is a Client Component opened with `Cmd+K` (or `Ctrl+K` on Linux/Windows). It shows:

- **Top section**: matched entities, grouped by entity type, up to 8 total results across all groups. Each item shows the entity icon, the matched field with the matching substring highlighted, and a secondary line of context (e.g., a project's client name).
- **Bottom section**: quick actions. "New proposal", "New invoice", "New client", "Start timer", "Today". These are not search results; they are deterministic shortcuts.

Keystrokes:

- `↑` / `↓` to move the highlighted item.
- `Enter` to navigate to the selected entity or run the action.
- `Esc` to close.
- Empty input shows recently visited entities (up to 5) plus the quick actions.

The palette is opened from any authenticated route. It does not work on the public-link routes (clients do not get a Cmd+K).

## Performance ceiling

Trigram search performance degrades roughly linearly with the number of rows being searched. For a single user with a few thousand rows across all entities, queries run in under 50ms. For a user with tens of thousands of rows, queries are still under 200ms with proper indexing. Beyond ~50,000 rows per user, the latency starts to be noticeable in the command palette.

The ceiling is a per-user property. Middlemist's median user has fewer than 100 clients, fewer than 1,000 projects across all time, and a few thousand tasks. The ceiling is not a v1 concern. v2 candidates if the ceiling is reached:

- Switch to Meilisearch (or Typesense) and replicate writes.
- Add a denormalized `SearchIndex` table per user with a single `tsvector` and a small set of indexed metadata; rebuild on writes.
- Move to Postgres full-text search with `tsvector` columns instead of trigram.

Each of these is a contained migration; the global search query interface is one file (`src/lib/services/search.service.ts`), so swapping the backend does not ripple into the UI.

## Migration to enable pg_trgm

A Prisma migration enables the extension and adds GIN indexes on the searchable columns:

```sql
-- prisma/migrations/00000000_search_extension/migration.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_client_name_trgm
  ON "Client" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_client_company_trgm
  ON "Client" USING gin ("companyName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_client_email_trgm
  ON "Client" USING gin ("email" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_project_name_trgm
  ON "Project" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_project_description_trgm
  ON "Project" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_proposal_title_trgm
  ON "Proposal" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_invoice_number_trgm
  ON "Invoice" USING gin ("number" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_task_title_trgm
  ON "Task" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_task_description_trgm
  ON "Task" USING gin ("description" gin_trgm_ops);
```

This migration runs once per environment. Neon's free tier supports `pg_trgm` without additional configuration.

## Query construction

The search service runs a tenant-scoped query against each entity in parallel and merges results.

```typescript
// src/lib/services/search.service.ts
import { prisma } from "@/lib/prisma";

type SearchHit =
  | { type: "client"; id: string; primary: string; secondary: string }
  | { type: "project"; id: string; primary: string; secondary: string }
  | { type: "proposal"; id: string; primary: string; secondary: string }
  | { type: "invoice"; id: string; primary: string; secondary: string }
  | { type: "task"; id: string; primary: string; secondary: string };

export async function search(userId: string, query: string): Promise<SearchHit[]> {
  if (query.trim().length < 2) return [];
  const q = query.trim();
  const ilike = `%${q}%`;

  const [clients, projects, proposals, invoices, tasks] = await Promise.all([
    prisma.client.findMany({
      where: {
        userId,
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      select: { id: true, name: true, companyName: true, email: true },
    }),
    prisma.project.findMany({
      where: {
        userId,
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      include: { client: { select: { name: true } } },
    }),
    prisma.proposal.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      take: 4,
      include: { client: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { userId, number: { contains: q, mode: "insensitive" } },
      take: 4,
      include: { client: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      include: { project: { select: { name: true } } },
    }),
  ]);

  const hits: SearchHit[] = [
    ...clients.map((c) => ({
      type: "client" as const,
      id: c.id,
      primary: c.name,
      secondary: c.companyName ?? c.email,
    })),
    ...projects.map((p) => ({
      type: "project" as const,
      id: p.id,
      primary: p.name,
      secondary: p.client.name,
    })),
    ...proposals.map((p) => ({
      type: "proposal" as const,
      id: p.id,
      primary: p.title,
      secondary: p.client.name,
    })),
    ...invoices.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      primary: i.number,
      secondary: i.client.name,
    })),
    ...tasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      primary: t.title,
      secondary: t.project.name,
    })),
  ];

  return hits.slice(0, 8);
}
```

Two design choices to notice:

- **Per-entity caps then global cap**. Each entity contributes at most 4 results; the merged set is capped at 8. This avoids one entity dominating and gives the user a glance across types.
- **`mode: "insensitive"`** uses Postgres's case-insensitive `ILIKE` under the hood. The trigram indexes accelerate this.

The route handler that serves the palette JSON wraps `search` in `withAuth` and passes the query string from the request.

## Adding search to a new entity

1. Identify the searchable text columns on the entity.
2. Add GIN trigram indexes in a new migration.
3. Add the entity to the `search` service with a per-entity query and a `SearchHit` mapping.
4. Add an icon and click handler in the command palette UI.
5. Update this document's "What is searchable" table.
