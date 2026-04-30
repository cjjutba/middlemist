# Module 13 — Global Search

## Purpose

A Cmd+K command palette that searches across clients, projects, proposals, invoices, and tasks, plus a small set of quick actions for "create" and "navigate" commands. The palette is the primary keyboard surface for moving around the app once the user has data in it. It is fast (debounced, with cancellation), tenant-scoped, and styled to match the rest of the product. The palette is not a search-everything Spotlight; it is a focused operational tool.

## In Scope (v1)

- Cmd+K (Mac) / Ctrl+K (Windows/Linux) opens the palette.
- Search across five entity types: clients (name, company, email), projects (name, description), proposals (title), invoices (number), tasks (title, description).
- Recent items (last 10 across types) shown when the query is empty.
- Quick actions when the query begins with `>`: `> New proposal`, `> New invoice`, `> New task`, `> Start timer`, `> Today view`, `> Settings`, `> Sign out`.
- Result grouping by type, with a per-group cap (e.g., max 5 per group) and a "Show more in {type}" link.
- Postgres ILIKE + `pg_trgm` for fuzzy matching.
- 150ms debounce; in-flight cancellation of stale queries.
- Keyboard navigation: arrow keys, Enter, Esc.

## Out of Scope (v1)

- **Search across update body content.** Cut to v2; the editor JSON makes this complex.
- **Full-text search via Meilisearch.** Cut to v2; pg_trgm covers v1 scale.
- **Filters inside search.** Cut to v2; the user types a query, picks a result.
- **Search history.** Cut to v2.
- **Per-result rich previews (snippets, highlights).** Cut to v2; results are name + type + small metadata.
- **Per-user shortcut customization.** Cut to v2.
- **Voice or natural-language search.** Cut entirely.

## Data Model

No new tables. Reads from `Client`, `Project`, `Proposal`, `Invoice`, `Task`. The `pg_trgm` extension is required and enabled in a migration documented in `docs/architecture/search.md`. Per-table GIN indexes:

- `Client(name gin_trgm_ops)`, `Client(companyName gin_trgm_ops)`, `Client(email gin_trgm_ops)`.
- `Project(name gin_trgm_ops)`.
- `Proposal(title gin_trgm_ops)`.
- `Invoice(number gin_trgm_ops)`.
- `Task(title gin_trgm_ops)`.

These indexes are added by this module's migration if not already present.

## User Flows

### Open and search

1. User presses Cmd+K from anywhere in `(app)`. The palette opens as a centered overlay (`{component.command-palette}`) positioned ~120px from the top.
2. The empty-query state shows a "Recent" group with up to 10 most-recently-touched entities (sourced from a small materialized list — see Repository Functions).
3. User types. After 150ms of idle, the action `searchAll` runs. Stale in-flight requests are aborted via `AbortController`.
4. Results render grouped by type. The first result is selected by default.
5. Arrow keys move selection across groups (skipping group headers); Enter opens the selected result; Esc closes the palette.

### Quick actions

1. If the query starts with `>` (with or without a leading space), the palette switches into command-action mode. Quick actions render as a single group "Actions."
2. Selecting an action either opens a create modal (e.g., `> New invoice` opens the invoice create modal at `/(app)/invoices/new`), navigates (`> Today view` → `/today`), or runs an action (`> Start timer` opens the start-timer flow on the most-recently-touched project, prompting if none).

### No results

1. The palette renders an empty state inside its result area: "No matches for {query}." A `{component.button-text-link}` "Try a different term" closes the palette.

### Result types and their open behavior

- Client → `/(app)/clients/[id]`.
- Project → `/(app)/projects/[id]` (Overview tab).
- Proposal → `/(app)/proposals/[id]/edit` if `status = draft`, else `/(app)/proposals/[id]/preview`.
- Invoice → `/(app)/invoices/[id]/edit` if `status = draft`, else `/(app)/invoices/[id]`.
- Task → opens the task `{component.sheet-right}` with the task's id; the URL navigates to `/(app)/projects/[projectId]/tasks?task={id}`.

## UI Surfaces

### `{component.command-palette}` overlay

- Backdrop: dimmed `{colors.canvas}` with low opacity (`rgba(17,17,17,0.4)`), click-to-close.
- Panel: centered, max-width 600px, `{rounded.lg}`, `{colors.canvas}` background, hairline `{colors.hairline}` border, subtle drop shadow `0 4px 12px rgba(0,0,0,0.08)`.
- Top: search `{component.text-input}` (borderless variant inside the panel) with a magnifier icon at left and a small `{component.kbd-key}` showing "Esc" at right.
- Result area: vertically scrolling list, max height ~480px.
  - Group headers: `{typography.caption}` `{colors.muted-soft}`, uppercase, with a small `{typography.caption}` count to the right of the header.
  - Result rows: `{spacing.md}` height; left-side type icon (`{component.feature-icon}` small), middle text (primary line `{typography.body-md}`, secondary line `{typography.caption}` `{colors.muted}`), right-side `{component.status-pill}` for entity status (proposals/invoices) or right-side keyboard hint `{component.kbd-key}` "↵" on hover.
  - Selected row gets `{colors.surface-card}` background.
- Footer of the panel: small `{typography.caption}` `{colors.muted-soft}` strip with key hints: "↑↓ navigate · ↵ open · esc close · `>` actions."

### Quick action mode

Same panel; the result area replaces the type groups with a single "Actions" group. Each action row carries an icon and an action label in `{typography.body-md}`.

### Entry from outside the palette

- The top nav has a `{component.text-input}` (search variant) labeled "Search" with a `{component.kbd-key}` "⌘K" suffix on desktop. Clicking it opens the palette.
- The mobile top nav has a search icon `{component.button-icon-circular}` that opens the palette.

States: loading (skeleton rows), error ("Search failed — try again"), empty (no recent items state for brand-new accounts shows the quick actions instead of recents).

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `searchAll` | `{ query: string, limit?: number }` | `{ ok: true, data: GroupedResults }` | Read-only; no side effects. |
| `getRecentItems` | `{ limit?: number }` | `{ ok: true, data: RecentItem[] }` | Read-only. |

Result shape:

```ts
type SearchResult =
  | { type: "client", id, name, companyName?, email }
  | { type: "project", id, name, clientName, status }
  | { type: "proposal", id, title, clientName, status, total?, currency }
  | { type: "invoice", id, number, clientName, status, total, currency }
  | { type: "task", id, title, projectName, status, dueDate? };

type GroupedResults = {
  clients: SearchResult[];
  projects: SearchResult[];
  proposals: SearchResult[];
  invoices: SearchResult[];
  tasks: SearchResult[];
};
```

## Repository Functions

In `src/lib/repositories/search.repo.ts`:

- `searchAll(userId, query, perTypeLimit)` — runs five sub-queries in parallel using ILIKE + pg_trgm `similarity()` ranking. Each sub-query is tenant-scoped by `userId`. Returns the grouped result.
- `getRecentItems(userId, limit)` — returns the most-recently-touched entities by `updatedAt`. Implementation: union of recent rows per table with a small in-memory sort. Caps at the per-type limit.

The `searchAll` function uses raw SQL via Prisma's `$queryRaw` for the trigram ranking, since Prisma's query builder does not have first-class similarity support. The raw SQL is one of a small number of permitted exceptions to the "go through Prisma's query builder" preference; the function still tenant-filters by `userId` and is covered by the standard isolation test.

## Validation Rules

- **Query.** 1–100 characters. Trimmed. Empty query short-circuits to recent items.
- **Limit.** Integer 1–10 per type, default 5.

## Permissions and Tenant Isolation

Standard. The five sub-queries each include `WHERE "userId" = $userId`. The action layer wraps with `withAuth`. The raw SQL in the repo is reviewed line-by-line for the `userId` clause.

A two-user isolation test asserts: searching for a name that exists for both users returns only the calling user's row. The recent-items function is tested similarly.

## Audit and Notifications

Audit: search actions are not logged (read operations on owned resources are not logged per `docs/architecture/audit-log.md`).

No notifications.

## Emails Sent

None.

## Background Jobs

None.

## Edge Cases and Decisions

- **Very short query (1–2 characters).** Allowed. pg_trgm handles short queries with reasonable performance because of the GIN indexes; the per-type limit caps result volume.
- **Query is an exact entity id (cuid).** Not specially handled in v1; the search runs as text against name fields. A v2 enhancement could detect cuid-shaped strings and resolve to the entity directly.
- **Query starts with `>` but is otherwise empty.** Show all quick actions.
- **Stale in-flight request after the user types more.** AbortController cancels; the new request runs with the latest query.
- **Result row open and the item has been deleted between fetch and click.** The destination route handles the not-found case with the standard 404 fallback. The palette does not pre-validate.
- **A user with no items.** The empty-query state shows the quick actions instead of recents. After typing, the no-results state surfaces.
- **Query length above 100 characters.** Schema rejects; the input field caps at 100 characters in v1.

## Definition of Done

- The palette opens with Cmd+K and Ctrl+K from any `(app)` route.
- Searching across five entity types returns properly grouped results scoped to the user.
- pg_trgm indexes added in a migration; performance acceptable on a fixture dataset of 1,000 rows per table.
- The 150ms debounce and AbortController-based cancellation are implemented.
- The keyboard navigation matrix (arrow keys, Enter, Esc) works correctly across groups.
- Quick action mode renders the action list and each action routes/runs correctly.
- A two-user isolation test on `search.repo.ts` covers `searchAll` and `getRecentItems` with overlapping data.
- A Playwright test opens the palette, types a query, navigates to a result with the keyboard, and asserts the destination loads.
- Screenshots of the palette (empty, with results, in quick action mode) captured.
