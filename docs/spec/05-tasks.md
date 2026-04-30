# Module 05 — Tasks

## Purpose

Tasks track the work items inside a project: the things the freelancer needs to do for one client on one project this week. Three views inside the project — list, kanban, and calendar — provide three lenses on the same set of rows. A cross-project Today view aggregates what is due today and what is currently being worked on. Tasks are intentionally small and lightweight: they are not a personal task manager, and they are not a substitute for Notion or Linear. The bar for adding a feature here is high.

## In Scope (v1)

- Create, edit, delete a task on a project.
- Three task statuses: `todo`, `in_progress`, `done`.
- Three views inside the project Tasks tab: list, kanban, calendar.
- Drag-and-drop to reorder within a kanban column or list section.
- Drag between kanban columns to change status.
- Per-task `dueDate` (optional).
- Per-task `clientVisible` flag for filtering what the client portal sees.
- A cross-project Today view at `/(app)/today`.
- Cmd+K quick action "New task" prompts for project + title.

## Out of Scope (v1)

- **Subtasks.** Cut to v2; v1 keeps the model flat.
- **Dependencies between tasks.** Cut to v2; the editorial dashboard does not need a graph.
- **Recurring tasks.** Cut to v2.
- **Tags or labels.** Cut to v2; status is the only grouping.
- **Multi-user assignment.** Cut entirely; one user per account.
- **Estimated vs actual time per task.** Cut to v2; time tracking attaches to tasks but does not roll up estimates yet.
- **Priority field.** Cut to v2; the design mock keeps the row light.

## Data Model

Uses `Task` (see `docs/architecture/data-model.md`). Relevant columns: `id`, `userId`, `projectId`, `title`, `description`, `status`, `dueDate`, `position`, `completedAt`, `createdAt`, `updatedAt`. Note: the schema does not include `clientVisible` or `priority` or `estimatedHours`. The `clientVisible` flag is being added in this module's migration; if absent at implementation time, it is added through the same Prisma schema change. Priority and estimated hours are explicitly cut.

Status enum (`TaskStatus`): `todo`, `in_progress`, `done`, `cancelled`. The schema includes `cancelled` for future use; v1 UI does not surface it (treated as a hidden state).

## User Flows

### Create

1. From the project Tasks tab or via Cmd+K, the user invokes "New task." From Cmd+K, a `{component.modal}` (sm) prompts for title and project (the project picker uses `{component.select}` from `projects.repo.listForPicker`).
2. From the kanban view, an inline-add row at the bottom of the `todo` column accepts a title and inserts immediately.
3. The action `createTask` validates input, computes the next `position` for the (projectId, status) bucket, inserts, and returns the new id.

### Edit

1. Clicking a task in any view opens a `{component.sheet-right}` containing the full task form: title, description (markdown textarea), status, due date, client-visible toggle, project (read-only).
2. Submit calls `updateTask`. The sheet stays open with a saved indicator; the user can close manually or with Esc.

### Status change via drag

1. On the kanban view, the user drags a task card from `todo` to `in_progress`.
2. The drop handler calls `setTaskStatus(id, "in_progress")` and `setTaskPosition(id, newPosition)` in sequence.
3. The kanban column re-orders and re-positions visually before the action returns; on action failure, the UI rolls back.
4. When a task moves to `done`, `completedAt` is set to `now`. Moving away from `done` clears it.

### Delete

1. From the sheet's `{component.dropdown-menu}` or a row's actions, the user clicks "Delete." A `{component.modal}` confirms.
2. Action `deleteTask` removes the row and writes audit. Time entries that referenced the task have their `taskId` set to `null` (cascade rule).

### Today view

1. User navigates to `/(app)/today` from the sidebar.
2. The page renders an aggregated list grouped by section: "In progress" (tasks with `status = in_progress`), "Due today" (`dueDate` matches today in the user's timezone), "Overdue" (`dueDate` < today), "Up next" (next 7 days).
3. Clicking any row opens the same sheet used in the project Tasks tab, with the parent project name shown at the top of the sheet for context.
4. A running timer banner appears at the top of the page if any timer is running (see [Time Tracking](./06-time-tracking.md)).

## UI Surfaces

### `/(app)/projects/[id]/tasks` — project Tasks tab

Top bar of the tab content: `{component.nav-pill-group}` toggling List / Kanban / Calendar. Right side: `{component.button-primary}` "New task," and a `{component.button-secondary}` "Filter" opening a `{component.dropdown-menu}` for filters (status, due-date range, client-visible).

#### List view

`{component.data-table}` with columns Checkbox (status toggle done/todo) / Title / Status pill / Due date / Drag handle / Actions. Rows render at `{spacing.md}` height; the table uses hairline `{colors.hairline}` row separators.

#### Kanban view

Three `{component.task-kanban-column}` columns side by side (todo, in_progress, done). Each column has a header in `{typography.title-md}` with a count pill in `{typography.caption}` `{colors.muted-soft}`. Each task is a `{component.feature-icon-card}` (compact variant) with title in `{typography.body-md}`, due date below in `{typography.caption}` `{colors.muted}`, and an avatar of the project's client in the corner (initial in a pastel `{component.badge-pill}`). Drag handles are full-card; cards are draggable between columns.

#### Calendar view

A month grid (7-column `{spacing.sm}` gap), each day-cell `{rounded.md}` `{colors.surface-card}`. Tasks with a `dueDate` in the cell render as small `{component.feature-icon-card}` rows (compact). Cells over the cell limit show a "+3 more" `{component.button-text-link}`.

### `/(app)/today` — cross-project Today view

App shell + max-width 880px content area.

- Hero band: page heading "Today" in `{typography.display-md}`. Below it, the date in `{typography.body-md}` `{colors.muted}` ("Wednesday, April 30").
- Running timer band: when a timer is running, a `{component.feature-card}` strip shows project + task + elapsed time (`{typography.code}`) + a stop `{component.button-icon-circular}`.
- "In progress" section heading in `{typography.title-md}`, then a list of `{component.feature-icon-card}` rows.
- "Due today" / "Overdue" / "Up next" sections in the same shape.
- Empty state: `{component.empty-state-card}` ("Nothing on today's plate. Pick something to start.").

### Cmd+K quick add

Inside `{component.command-palette}` (see [Global Search](./13-global-search.md)), typing `> New task` (or just clicking the "New task" quick action) opens a small inline form with project picker + title.

States across views: loading skeletons inside table rows or kanban cards; error banners at the page top when an action fails; optimistic updates for status drag and reorder.

## Server Actions

| Action                 | Input                              | Output                       | Side effects                                                                             |
| ---------------------- | ---------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| `createTask`           | `createTaskSchema`                 | `{ ok: true, data: { id } }` | Computes position; inserts; writes `task.created` audit.                                 |
| `updateTask`           | `updateTaskSchema` (id + partials) | `{ ok: true, data: Task }`   | Updates fields.                                                                          |
| `setTaskStatus`        | `{ id, status }`                   | `{ ok: true, data: Task }`   | Sets/clears `completedAt`; writes `task.status-changed` audit.                           |
| `setTaskPosition`      | `{ id, status, position }`         | `{ ok: true }`               | Recomputes positions for the (projectId, status) bucket.                                 |
| `deleteTask`           | `{ id }`                           | `{ ok: true }`               | Removes row; cascades clear time entry `taskId` references. Writes `task.deleted` audit. |
| `setTaskClientVisible` | `{ id, clientVisible }`            | `{ ok: true }`               | Toggles the flag.                                                                        |

## Repository Functions

In `src/lib/repositories/tasks.repo.ts`:

- `findById(userId, id)` — single task with parent project name for sheet display.
- `listByProject(userId, projectId, { status?, range? })` — list filtered by status and/or due-date range.
- `listClientVisible(ctx)` — used by the portal repo (where `ctx = { userId, clientId }`); joins through Project to filter to the matched client and returns only `clientVisible = true`.
- `listToday(userId, now)` — cross-project aggregation for the Today view: in_progress, due today (timezone-aware), overdue, next 7 days.
- `create(userId, input)` — insert with computed position.
- `update(userId, id, input)` — `updateMany` pattern.
- `setStatus(userId, id, status)`.
- `setPosition(userId, id, status, position)` — recomputes monotonic positions.
- `delete(userId, id)`.

The position recomputation strategy: when a task moves, the action layer fetches the target column's tasks ordered by current position, splices the moved task in at the new index, and writes back positions in fixed increments (e.g., 1000, 2000, 3000) to avoid frequent rewrites. A periodic compaction is not necessary at v1 scale.

## Validation Rules

- **Title.** 1–200 characters, trimmed. Required.
- **Description.** 0–4000 characters; markdown.
- **Status.** `TaskStatus` enum, restricted to `todo | in_progress | done` in the action layer (`cancelled` only writable through a future migration).
- **Due date.** Optional. If set, stored as a UTC instant; the user's timezone is applied at display time only.
- **Position.** Computed; never accepted from client input. The reorder action takes a `targetIndex` instead.
- **Client visible.** Boolean. Default `false` (client only sees tasks the freelancer explicitly opts in).

## Permissions and Tenant Isolation

Standard. All reads and writes through `tasks.repo.ts` with `userId`. The portal repo path uses `(userId, clientId)`; tasks join through the parent project's `clientId` to enforce the client scope.

A two-user isolation test asserts: user A cannot read or write user B's tasks; the cross-project Today view does not surface user B's tasks; portal task listing for user A's client X does not surface user A's client Y tasks.

## Audit and Notifications

Audit actions: `task.created`, `task.status-changed`, `task.deleted`. Title or description edits do not write a separate audit. The audit registry shape:

- `task.created`: `{ projectId, title }`.
- `task.status-changed`: `{ from, to }`.
- `task.deleted`: `{}`.

No notifications fire from task events.

## Emails Sent

None from this module.

## Background Jobs

None scheduled. The Today view computes filters at read time; there is no precomputed digest in v1.

## Edge Cases and Decisions

- **Drag a task to the same column at the same position.** No-op. The action returns success without writing.
- **Two tasks with identical positions after a race.** Tolerated. The next reorder rewrites positions in the affected column. Sort order between identical-position rows falls back to `createdAt`.
- **Task with a `dueDate` set in a different timezone than the user's current.** The stored value is a UTC instant; the Today view computes "today" in the user's `defaultTimezone`. A user who travels and changes timezone in settings will see the same tasks shift their grouping accordingly.
- **A task is `done`, then dragged back to `todo`.** Allowed. `completedAt` is cleared. No history of completion is preserved (audit captures the transition).
- **Deleting a task with time entries.** Allowed. The time entries' `taskId` is set to `null`; the entries remain attached to the project. The Time tab still shows them with "(deleted task)" as the description fallback.
- **Project archived while tasks exist.** Tasks remain. They appear under the archived project's Tasks tab and do not flow into the Today view (Today filters to active and on-hold projects).
- **Cmd+K creating a task on an archived project.** The project picker hides archived; the user must unarchive first.

## Definition of Done

- All six server actions implemented and typed.
- All three views (list, kanban, calendar) render correctly with empty and populated states.
- The Today view groups tasks correctly across multiple projects in the user's timezone.
- The position-recomputation strategy is covered by a Vitest test that drags a task across many positions and asserts monotonic uniqueness.
- A two-user isolation test for `tasks.repo.ts` covers every function including `listClientVisible` and `listToday`.
- A Playwright test creates a task in one project, sees it on the Today view, drags it to `done`, and verifies the project view reflects the change.
- Screenshots of the project Tasks tab (kanban), `/today`, and the task sheet captured.
