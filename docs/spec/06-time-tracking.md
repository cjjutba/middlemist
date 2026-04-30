# Module 06 — Time Tracking

## Purpose

Track time spent on a project (and optionally on a specific task within the project), so that hours roll into invoices and so that the freelancer has a record of where the week went. The model is one running timer at a time per user. Manual entries are also allowed for retroactive logging. Per-project visibility controls whether the client portal sees time at all. The weekly summary view aggregates hours by project with a simple, hand-built bar chart that does not pull in a chart library.

## In Scope (v1)

- Start a timer on a project (and optional task). One running timer per user at any moment.
- Stop a running timer.
- Create a manual time entry (date, start/end times or duration, description, billability).
- Edit and delete time entries.
- Per-project `timeVisibleToClient` toggle.
- Weekly summary view at `/(app)/time` with a project-grouped table and a small SVG bar chart.
- Persistent running-timer strip in the app shell when a timer is running.
- Pulling time entries into invoice line items (handled by [Invoices](./09-invoices.md), but the source-of-truth listing lives here).

## Out of Scope (v1)

- **Billable rates per task.** Cut to v2; the project carries one currency, no rate; the invoice picks up a unit price at line-item creation.
- **Idle detection (auto-pause).** Cut to v2.
- **Calendar integration (Google / Outlook).** Cut to v2.
- **Pomodoro timers and auto-suggestion.** Cut to v2.
- **Multi-user time entries.** Cut entirely.
- **Per-project rate variation across phases.** Cut to v2; can be modeled with line-item description for v1.

## Data Model

Uses `TimeEntry` (see `docs/architecture/data-model.md`). Relevant columns: `id`, `userId`, `projectId`, `taskId` (nullable), `description`, `startedAt`, `endedAt`, `durationSec`, `isBillable`, `invoicedLineItemId` (set when the entry is converted to a line item; prevents double-billing).

A new column on `Project`: `timeVisibleToClient: Boolean @default(false)`. Added by this module's migration if not already present.

## User Flows

### Start a timer

1. From a project's Time tab, the user clicks `{component.button-primary}` "Start timer." A small inline form prompts for an optional task and an optional description.
2. The action `startTimer` checks if any timer is already running for the user. If so, it returns `{ ok: false, error: "TIMER_ALREADY_RUNNING" }` with the running entry's id; the UI prompts the user to stop the existing timer first.
3. If no running timer, the action inserts a new `TimeEntry` with `startedAt = now`, `endedAt = null`, `description` optional. Returns the entry.
4. The persistent running-timer strip appears below the top nav across the app, ticking the elapsed time client-side.

### Stop a running timer

1. From the strip's stop `{component.button-icon-circular}` (or from the project Time tab), the user clicks stop.
2. The action `stopTimer` looks up the running entry, sets `endedAt = now`, computes `durationSec`, and returns the entry.
3. The strip disappears.

### Create a manual entry

1. From the project Time tab, the user clicks `{component.button-secondary}` "Add manual entry." A `{component.modal}` (sm) opens.
2. Fields: date, start time, end time (or alternately a duration in HH:MM), description, task picker, billable toggle.
3. Submit calls `createManualEntry`. The action validates input, computes duration if given start/end, and inserts.

### Edit / delete

1. Each row in the project Time tab list has an actions `{component.dropdown-menu}` with Edit and Delete.
2. Edit opens the same modal pre-filled. Delete confirms via a `{component.modal}`.

### Toggle per-project client visibility

1. From the project Overview tab's Settings card, a `{component.toggle-switch}` "Show time to client" controls whether the client portal sees the Time section.
2. The action `setProjectTimeVisibility` updates `Project.timeVisibleToClient`.

## UI Surfaces

### Persistent running-timer strip

A `{component.feature-card}` strip rendered as a sticky bar below the top nav across all `(app)` routes when a timer is running. Contents:

- Left: project name (linking to project) in `{typography.body-sm}`, optional task title below in `{typography.caption}` `{colors.muted}`.
- Center: elapsed time in `{typography.code}` `{typography.title-md}` (HH:MM:SS), updated client-side on a 1-second interval.
- Right: stop `{component.button-icon-circular}`.

The strip uses `{colors.surface-card}` background, hairline `{colors.hairline}` bottom border, no shadow. It compresses to a single line on narrow viewports.

### `/(app)/projects/[id]/time` — project Time tab

- Top bar: `{component.button-primary}` "Start timer" (or "Stop timer" if one is running on this project), and `{component.button-secondary}` "Add manual entry."
- A `{component.data-table}` with columns Date / Start / End / Duration (`{typography.code}` tabular nums) / Task / Description / Billable / Actions.
- Footer row: total duration for the visible range in `{typography.code}` `{typography.title-md}`.
- Filter row above the table: date range `{component.date-picker}`, billable filter `{component.select}`.
- Empty state: `{component.empty-state-card}` ("No time logged yet on this project").

### `/(app)/time` — weekly summary

- Page heading "Time" in `{typography.display-md}`.
- Top bar: week navigator (left/right `{component.button-icon-circular}` and a centered `{component.button-text-link}` showing the current week range "Apr 28 – May 4"). A `{component.select}` switches between Week / Month grouping.
- A small SVG bar chart, hand-built (no chart library), rendering one bar per project with the bar value as that project's total hours in the period. Bars use `{colors.primary}` fill at full opacity. Y-axis is implicit; the bar's hour count renders in `{typography.caption}` `{colors.muted}` to the right of each bar. Max bar width: 480px.
- Below the chart: a `{component.data-table}` of entries grouped by project with collapsible groups. Group header rows show project name + total duration; expanding shows individual entries.
- Empty state: `{component.empty-state-card}` ("No time logged this week").

## Server Actions

| Action                     | Input                                  | Output                                                                                           | Side effects                                                               |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `startTimer`               | `{ projectId, taskId?, description? }` | `{ ok: true, data: TimeEntry } \| { ok: false, error: "TIMER_ALREADY_RUNNING", runningEntryId }` | Inserts a `TimeEntry` with `endedAt = null`.                               |
| `stopTimer`                | `{}`                                   | `{ ok: true, data: TimeEntry }`                                                                  | Sets `endedAt` and `durationSec` on the user's running entry.              |
| `createManualEntry`        | `manualEntrySchema`                    | `{ ok: true, data: TimeEntry }`                                                                  | Inserts a complete entry. Writes `time-entry.created` audit.               |
| `updateEntry`              | `updateEntrySchema`                    | `{ ok: true, data: TimeEntry }`                                                                  | Updates an entry. Disallowed if `invoicedLineItemId` is set. Writes audit. |
| `deleteEntry`              | `{ id }`                               | `{ ok: true }`                                                                                   | Removes an entry. Disallowed if `invoicedLineItemId` is set. Writes audit. |
| `setProjectTimeVisibility` | `{ projectId, visible }`               | `{ ok: true }`                                                                                   | Toggles `Project.timeVisibleToClient`.                                     |

## Repository Functions

In `src/lib/repositories/time-entries.repo.ts`:

- `findRunning(userId)` — returns the user's running entry or null. Used by the action layer to enforce the one-running rule and by the app shell to render the strip.
- `findById(userId, id)`.
- `listByProject(userId, projectId, { from?, to?, billable? })`.
- `listForInvoiceCandidates(userId, projectId)` — billable, not yet invoiced, within an optional date range. Used by the invoice "pull from time" UI.
- `listForWeek(userId, weekStart, weekEnd)` — for the weekly summary; returns entries grouped by project for the chart and table.
- `create(userId, input)` — insert.
- `update(userId, id, input)` — `updateMany` pattern; refuses if `invoicedLineItemId IS NOT NULL`.
- `delete(userId, id)` — `deleteMany`; refuses if invoiced.
- `markInvoiced(userId, ids[], lineItemId)` — used at invoice creation time to flip `invoicedLineItemId`.
- `clearInvoiced(userId, ids[])` — used when an invoice is voided or the line item is removed.

## Validation Rules

- **`startedAt` and `endedAt`.** UTC instants. If both set, `endedAt > startedAt`. Maximum entry length 24 hours (entries longer than 24 hours are flagged as suspicious; the manual-entry form rejects them, and the timer auto-stops via the daily timer-watchdog cron — see Background Jobs).
- **`durationSec`.** Non-negative integer. Required for entries with both `startedAt` and `endedAt` (computed automatically). Required for manual entries entered as duration-only (start = `today 00:00`, end = `today 00:00 + duration` for storage, with a flag).
- **`description`.** 0–500 characters.
- **`isBillable`.** Boolean; defaults to `true`.
- **Task FK.** If set, the task must belong to the same project (validated at the action layer).

## Permissions and Tenant Isolation

Standard. All reads and writes through the repo with `userId`. The client portal's time view path uses `(userId, clientId)` and additionally checks `Project.timeVisibleToClient = true` before listing entries.

A two-user isolation test asserts: user A cannot start, stop, edit, delete, or see user B's entries; the running-timer query for user A does not return user B's running entry.

## Audit and Notifications

Audit actions: `time-entry.created`, `time-entry.updated`, `time-entry.deleted`, `time-entry.invoiced` (when an entry is converted to a line item). Timer start/stop are not audited individually — the resulting `time-entry.created` (on stop) covers the lifecycle.

No notifications fire from time events.

## Emails Sent

None from this module.

## Background Jobs

- `timer.watchdog` cron (hourly): finds running timers older than 24 hours, auto-stops them at the 24-hour mark, and writes an audit entry. The freelancer is shown a `{component.alert-banner}` on next login.
- `time-entries.daily-tally` cron (daily 00:30 UTC): not in v1; reserved for future totals materialization. Not implemented.

## Edge Cases and Decisions

- **User starts a timer, closes the laptop, opens it the next day.** The strip computes elapsed from the server's `startedAt`, so it reflects accurately. The watchdog cron may have stopped the timer at the 24h mark; if so, the strip is gone and the entry shows as completed.
- **Clock change (DST).** All timestamps are UTC. Display in the user's timezone handles DST; the entry's stored duration is unaffected by the user's timezone changes.
- **A timer is running on project A, the user wants to start on project B.** Refused with `TIMER_ALREADY_RUNNING`. The UI offers a one-click "Stop and switch" that calls stop then start in sequence.
- **Edit an entry that has been invoiced.** Refused. The action returns `{ ok: false, error: "ENTRY_INVOICED" }`. To edit, the freelancer must first remove the entry from the invoice (which clears `invoicedLineItemId`) or void the invoice.
- **Delete a project that has time entries.** Project module's `Restrict` cascade prevents this when invoices reference the project; for projects without invoices, the cascade rule is `cascade` (time entries removed with project). UI prefers archive.
- **Manual entry crossing midnight.** Stored as a single entry with `startedAt` on day N and `endedAt` on day N+1. The week view splits the duration across days; day N gets the time before midnight, day N+1 gets the time after.

## Definition of Done

- All six server actions implemented and typed.
- The one-timer-at-a-time invariant enforced by both the action layer and a Vitest test.
- The persistent running-timer strip renders correctly across `(app)` routes and disappears when stopped.
- The weekly summary chart renders correctly for empty, single-project, and multi-project weeks.
- A two-user isolation test for `time-entries.repo.ts` covers every function.
- The watchdog cron is unit-tested with a mocked clock advancing past 24 hours.
- A Playwright test starts a timer, navigates around the app verifying the strip persists, stops it, and asserts the entry appears in the weekly summary.
- Screenshots of the project Time tab and `/time` captured.
