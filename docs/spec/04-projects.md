# Module 04 — Projects

## Purpose

Projects are the central object in Middlemist. Tasks, time entries, updates, proposals, and invoices all attach to a project. The first product principle ("project is the central object") makes this module non-negotiable — when a feature does not have a clear home, the answer is usually "the project detail page." This module covers project creation, the detail page with its tabbed sub-sections, status lifecycle (active → on hold → completed → archived), and the public token used in the client portal scope.

## In Scope (v1)

- Create, edit, archive, and unarchive a project.
- Status transitions: active ↔ on-hold; active/on-hold → completed; any → archived; archived → active (unarchive).
- Project detail page with tabs for Overview, Tasks, Time, Updates, Proposals, Invoices.
- Per-project currency and optional budget amount.
- Public token (for use by the client portal scope; not its own public web page).
- Regenerate public token from project settings.
- Project list with status pill filter.

## Out of Scope (v1)

- **Project templates.** Cut to v2; the value at single-developer scale is low.
- **Milestones as a first-class entity.** Cut to v2; the existing pinned-update and tasks-with-due-dates patterns cover the use case.
- **Sub-projects / project hierarchy.** Cut entirely; the data model is flat by design.
- **Multi-client projects.** Cut entirely; one project, one client.
- **Project-level rate variation per task.** Cut to v2; v1 has one rate per project (post-v1) or none (v1).
- **Cross-project Gantt view.** Cut to v2.

## Data Model

Uses `Project` (see `docs/architecture/data-model.md`). Relevant columns: `id`, `userId`, `clientId`, `name`, `description`, `status`, `currency`, `budgetAmount`, `startedAt`, `endedAt`, `archivedAt`. Foreign keys from `Task`, `TimeEntry`, `Update`, `Proposal` (`SetNull` cascade), `Invoice` (`Restrict` cascade).

Status enum (`ProjectStatus`): `active`, `on_hold`, `completed`, `archived`. The `archivedAt` column is set in addition to `status = archived` so archive ordering is queryable by date.

## User Flows

### Create

1. From `/(app)/projects`, the user clicks `{component.button-primary}` "New project." A `{component.modal}` (md) opens.
2. The user fills in name (required), client (required, `{component.select}` from `clients.repo.listForClientPicker`), description (optional, plain textarea — markdown not Tiptap), currency (required, defaults to client's preferred or user's default), budget amount (optional, numeric), start date and end date (optional, paired `{component.date-picker}` fields).
3. Submit calls `createProject`. The action validates input, generates a `publicToken` (nanoid 21), inserts the row, and routes to `/(app)/projects/[id]`.

### Edit

1. From the detail page, clicking `{component.button-secondary}` "Edit" opens the same modal pre-filled. Submit calls `updateProject`.
2. Status, archived state, and currency are not edited from this modal. Status changes go through dedicated actions; currency is fixed at create time.

### Status transitions

1. From the detail header `{component.dropdown-menu}` (next to the status pill), the user picks the new status.
2. The action `setProjectStatus` validates the transition (see edge cases) and updates the row. `endedAt` is auto-set to `now` when transitioning to `completed`.

### Archive / unarchive

1. From the detail page or the list row's `{component.dropdown-menu}`, the user clicks "Archive." A `{component.modal}` confirms.
2. The action `archiveProject` sets `archivedAt = now` and `status = archived`.
3. Unarchive sets `archivedAt = null` and `status = active` (regardless of prior status).

### Regenerate public token

1. From the project Overview tab, in the "Client portal access" `{component.feature-icon-card}`, a `{component.button-secondary}` "Regenerate token" sits next to the current token's value (last 6 characters shown, full URL hidden).
2. A `{component.modal}` confirms ("This invalidates the current portal link for this project").
3. The action issues a new nanoid(21), updates the row, writes audit `project.regenerated-token`, and the next portal lookup resolves through the new token.

## UI Surfaces

### `/(app)/projects` — list view

- Page heading "Projects" in `{typography.display-md}`.
- Top bar: `{component.nav-pill-group}` filtering "Active / On hold / Completed / Archived"; right side `{component.button-primary}` "New project."
- Body: 3-up grid of `{component.feature-icon-card}` (wraps to 2-up on tablet, 1-up on mobile). Each card:
  - Top: status `{component.status-pill}` (color tone: active=neutral, on-hold=warning, completed=success, archived=muted).
  - Project name in `{typography.title-md}`.
  - Client name below in `{typography.body-sm}` `{colors.muted}`.
  - Three-stat strip: open tasks count, hours this week (`{typography.code}`), outstanding invoice total (in project currency).
  - Footer: "Last activity 2 days ago" in `{typography.caption}` `{colors.muted-soft}`.
- Empty state: `{component.empty-state-card}` ("No active projects yet").

### `/(app)/projects/[id]` — detail page

App shell + max-width 1080px content area.

- Header band:
  - Project name in `{typography.display-md}`.
  - Right-aligned: status `{component.status-pill}` with attached `{component.dropdown-menu}` (status transitions); `{component.button-secondary}` "Edit"; `{component.dropdown-menu}` for Archive / Unarchive / Regenerate portal token.
  - Sub-row: client name (linking to client detail), date range in `{typography.body-sm}` `{colors.muted}`, currency code in `{typography.code}`.
- `{component.tab-underline}` row under the header with tabs: Overview, Tasks, Time, Updates, Proposals, Invoices. The active tab is the part of the URL after the project id (e.g., `/projects/abc/tasks`).
- Tab content area (each tab is a separate page route under `/projects/[id]/...`).

#### Overview tab

- "About" `{component.feature-icon-card}` with the description (rendered as plain markdown) and metadata grid (start/end dates, currency, budget).
- "Stats" 4-up grid of small `{component.feature-icon-card}` (tasks open / hours this week / invoiced this period / outstanding).
- "Recent updates" — last 3 updates as `{component.client-portal-update-card}`.
- "Client portal access" — token regenerate UI described above.

#### Tasks, Time, Updates, Proposals, Invoices tabs

Each tab renders content owned by the respective module. The tab is a thin wrapper that calls the module's repo with the project's id and the user's id, passing through filters.

### `/(app)/projects/new` — modal route

Modal-as-route same pattern as Clients. Same form as the inline create modal.

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `createProject` | `createProjectSchema` | `{ ok: true, data: { id } }` | Generates `publicToken`; inserts; writes `project.created` audit. |
| `updateProject` | `updateProjectSchema` (id + partials) | `{ ok: true, data: Project }` | Updates fields. Currency, status, archive state are not editable via this action. |
| `setProjectStatus` | `{ id, status }` | `{ ok: true, data: Project }` | Validates transition. Writes `project.status-changed` audit with `{ from, to }`. Sets `endedAt = now` when transitioning to `completed`. |
| `archiveProject` | `{ id }` | `{ ok: true }` | Sets `archivedAt = now`, `status = archived`. Writes audit. |
| `unarchiveProject` | `{ id }` | `{ ok: true }` | Clears `archivedAt`, sets `status = active`. Writes audit. |
| `regeneratePublicToken` | `{ id }` | `{ ok: true, data: { newToken } }` | New nanoid(21) into `publicToken`. Writes `project.regenerated-token` audit. |

## Repository Functions

In `src/lib/repositories/projects.repo.ts`:

- `findById(userId, id)` — full row lookup, scoped by userId.
- `findByPublicToken(token)` — non-tenant; used by the client portal token resolver. Returns the project + the userId/clientId so the portal can scope subsequent queries.
- `list(userId, { status, clientId })` — list with optional filters.
- `listForPicker(userId, { clientId })` — minimal projection for forms; only active and on-hold.
- `create(userId, input)` — insert with `publicToken` generated.
- `update(userId, id, input)` — `updateMany` pattern.
- `setStatus(userId, id, status)` — separate function so the audit/transition logic can sit in the action layer cleanly.
- `archive(userId, id)` / `unarchive(userId, id)`.
- `regeneratePublicToken(userId, id)` — generates new token, updates, returns the new value.
- `getDashboardSnapshot(userId)` — used by the dashboard for aggregated stats; lives partially here, partially in `dashboard.repo.ts`.

## Validation Rules

- **Name.** 1–200 characters, trimmed. Required.
- **Description.** 0–4000 characters; markdown.
- **Status.** `ProjectStatus` enum.
- **Currency.** ISO-4217 from supported set. Required at create; not editable.
- **Budget amount.** Optional `Decimal(12,2)`, non-negative.
- **Start / end dates.** Optional. If both set, end must be on or after start.
- **Status transition table:**

  | From | To allowed |
  |---|---|
  | active | on_hold, completed, archived |
  | on_hold | active, completed, archived |
  | completed | active (re-open), archived |
  | archived | active (unarchive only) |

  Disallowed transitions return `{ ok: false, error: "INVALID_TRANSITION" }`.

## Permissions and Tenant Isolation

Standard. Every read and write goes through `projects.repo.ts` with `userId`. `findByPublicToken` is the one exception: it does not take a userId because the lookup itself proves access for the portal entry path. The function does not return the freelancer's `userId` directly to the browser; it returns it to the server-side portal session creator only.

A two-user isolation test asserts: user A cannot read, update, set-status, archive, or regenerate-token on a project owned by user B; `findByPublicToken` returns user B's project only when given user B's exact token.

## Audit and Notifications

Audit actions: `project.created`, `project.updated`, `project.status-changed`, `project.archived`, `project.unarchived`, `project.regenerated-token`. None surface in the in-app notification feed; project edits are freelancer-initiated.

## Emails Sent

None from this module directly. Updates posted to a project may trigger client emails, but that lives in [Updates](./07-updates.md).

## Background Jobs

None. Status transitions are synchronous. The dashboard's "stale project" hint (e.g., a project with no activity in 30 days) is computed at read time, not by a job.

## Edge Cases and Decisions

- **Currency change after creation.** Disallowed. The currency on a project is fixed because invoices and proposals attached to the project may already exist in that currency. Changing it would orphan the historical totals.
- **Deleting a project.** Not allowed in v1. The model uses archive. Hard-delete is intentionally absent from the action layer; if needed, a developer can do it via Prisma with manual cleanup. The data model's cascade rules support it (cascade tasks/time/updates; setNull proposals; restrict invoices).
- **Project with no client (orphaned client).** Not possible: client FK is `Restrict`. A client cannot be deleted while it has a project.
- **Re-opening a completed project.** Allowed. Sets status back to `active`, clears `endedAt`. Writes the audit transition. Does not touch invoices.
- **Regenerated token while a portal session is live.** The portal session itself is bound to a `ClientPortalSession.tokenHash`, not to `Project.publicToken`. Regenerating the project token does not invalidate active portal sessions for that client, but it does mean any cached "project link" the client has stops working at the per-project public-link layer (which is not a v1 surface, but the token is reserved for future use).
- **Archiving a project with running timer.** The running timer continues; archival does not stop a timer. The timer stop UI is on the Time tab and remains accessible. (Recorded as an edge case to revisit if it surprises users.)

## Definition of Done

- All six server actions implemented and typed end-to-end with the status-transition table enforced.
- `projects.repo.ts` covered by a two-user isolation test, including `findByPublicToken` (assert it returns user B's project for user B's token, and only that).
- Detail-page tab routing works with deep-linking (`/projects/[id]/tasks`, `/projects/[id]/time`, etc.) — refresh on a tab returns to that tab.
- Status-pill colors correct for each status per the design tokens.
- Status transition table covered by a Vitest test that asserts disallowed transitions return `INVALID_TRANSITION`.
- A Playwright test exercises create → edit → status change → archive → unarchive.
- Screenshots of `/projects`, `/projects/[id]` (Overview tab), and the create modal captured.
