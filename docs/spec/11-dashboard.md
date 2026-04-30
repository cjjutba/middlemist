# Module 11 — Dashboard

## Purpose

The dashboard is the freelancer's home page after sign-in. It answers four questions in order: what am I doing today, what projects are alive, what just happened, and how am I tracking on the obvious metrics. The dashboard is intentionally a list (and a small grid), not a chart-heavy analytics surface. Editorial typography and whitespace beat chart density per the product principles. The dashboard is read-only; every action takes the user into the relevant module's UI.

## In Scope (v1)

- Today section with hero heading, today's tasks, and the running-timer banner.
- Active projects section as a 3-up grid of project cards.
- Recent activity feed sourced from the audit log.
- Quick stats grid: hours this week, outstanding invoices total, proposals pending, overdue invoices count.
- Quick actions row: New proposal, New invoice, New task, Start timer.
- Empty state for the brand-new account.
- 60-second polling for the in-app notification badge (handled by the notifications module; the dashboard hosts the bell icon in the top nav).

## Out of Scope (v1)

- **Customizable widgets.** Cut to v2; the dashboard is fixed.
- **Multi-week trend charts.** Cut to v2.
- **Goal tracking.** Cut to v2.
- **Streaks or gamification.** Cut entirely.
- **Configurable date ranges on the stats grid.** Cut to v2; "this week" is fixed in v1.
- **A real-time activity feed via SSE/websockets.** Cut to v2; the activity strip refreshes on page navigation, and the bell icon polls every 60s.

## Data Model

No new tables. Reads from `Project`, `Task`, `TimeEntry`, `Invoice`, `Proposal`, and `AuditLog`. See `docs/architecture/data-model.md`.

## User Flows

### Happy path (returning freelancer)

1. User signs in. The login action redirects to `/dashboard` (since `User.onboardingDoneAt` is set).
2. The page is a Server Component that calls `dashboardRepo.getDashboardSnapshot(userId)` and renders the sections.
3. Each section renders inline; the page does not block on a single slow query (parallel fetches with `Promise.all`).
4. Clicking a card or row navigates to the relevant module.

### Empty path (just-onboarded freelancer)

1. User completes onboarding without creating a client. They land on `/dashboard`.
2. The page detects no clients and no projects and renders a full-page `{component.empty-state-card}` with a `{component.button-primary}` "Create your first client."

### Skipped-step reminders (post-onboarding)

1. For 7 days after `onboardingDoneAt`, if the user skipped logo upload or first client, an `{component.alert-banner}` (info tone) renders at the top of the dashboard with a CTA to complete the skipped step.

## UI Surfaces

### `/(app)/dashboard`

App shell + max-width 1080px content area. Contents in order:

#### Hero band (Today)

- Page heading "Today" in `{typography.display-md}`.
- Subtitle "Wednesday, April 30, 2026" in `{typography.body-md}` `{colors.muted}`.
- Optional: skipped-step reminder `{component.alert-banner}` (info tone), pending-deletion reminder `{component.alert-banner}` (warning tone), or stale-FX reminder `{component.alert-banner}` (warning tone).

#### Today section

- A `{component.feature-card}` containing today's tasks list. Each row uses the same shape as the Today view in [05-tasks](./05-tasks.md): title, project, due time, status pill. Up to 5 rows; "View all in Today" `{component.button-text-link}` opens `/today`.
- Below it, the running-timer banner if any: a `{component.feature-card}` strip with project + task + elapsed time in `{typography.code}` + stop `{component.button-icon-circular}`.
- If both empty: a small `{component.empty-state-card}` (compact) "Nothing scheduled — pick something to start."

#### Active projects section

- Section heading in `{typography.title-lg}` "Active projects."
- A 3-up grid of `{component.feature-icon-card}` (wraps to 2-up on tablet, 1-up on mobile). Each card matches the project list card shape from [04-projects](./04-projects.md): name, client, status pill, three-stat strip, last-activity caption.
- "View all projects" `{component.button-text-link}` linking to `/projects`.
- Empty state inline: "No active projects yet" with a `{component.button-primary}` "New project."

#### Recent activity section

- Section heading in `{typography.title-lg}` "Recent activity."
- A `{component.feature-card}` with a vertical list of the last 10 events from the audit log (filtered to `proposal.viewed`, `proposal.accepted`, `proposal.declined`, `invoice.viewed`, `invoice.paid`, `invoice.overdue`, `client.magic-link-redeemed`).
- Each row: a small icon at left (icon depends on action), action text in `{typography.body-sm}` ("Acme viewed your proposal 'Website redesign'"), timestamp in `{typography.caption}` `{colors.muted-soft}` ("2 hours ago"), entity link on the right.
- Empty state inline: "No activity yet."

#### Quick stats section

- Section heading in `{typography.title-lg}` "This week at a glance."
- A 4-up grid of small `{component.feature-icon-card}`. Each card has an icon top-left, the stat label in `{typography.caption}` `{colors.muted}`, and the value in `{typography.display-sm}` (or `{typography.title-lg}` for currency strings to keep the digits compact).
- The four cards:
  - **Hours this week** — sum of `TimeEntry.durationSec` for the user's current ISO week. Format `H:MM`.
  - **Outstanding invoices** — sum of `Invoice.total - Invoice.amountPaid` where `status IN ('sent', 'viewed', 'overdue')`, aggregated to `User.defaultCurrency` using the latest FX rates.
  - **Proposals pending** — count of `Proposal.status IN ('sent', 'viewed')`.
  - **Overdue invoices** — count of `Invoice.status = 'overdue'`. Card uses an emphasized accent (border in `{colors.warning}`) when count > 0.

#### Quick actions row

- A horizontal row of `{component.button-secondary}` buttons: New proposal, New invoice, New task, Start timer. On mobile, wraps to two rows of two.
- Each button opens the relevant create modal or navigates to the create route.

### Empty state

- For brand-new accounts (no clients, no projects), the entire page is replaced with a centered `{component.empty-state-card}`:
  - Heading "Let's set up your first engagement" in `{typography.display-md}`.
  - Body in `{typography.body-md}` `{colors.body}`: "Add a client, then start a project. Everything else flows from there."
  - Two CTAs: `{component.button-primary}` "Add a client" → `/clients/new`, `{component.button-text-link}` "Skip for now."

States:

- Loading: skeleton variants of each section render in parallel; no page-level spinner.
- Stale-FX warning: when `FxRate.fetchedAt` for the user's defaultCurrency pairs is older than 48 hours, an `{component.alert-banner}` (warning) appears at the top.

## Server Actions

None. The dashboard is read-only.

## Repository Functions

In `src/lib/repositories/dashboard.repo.ts`:

- `getDashboardSnapshot(userId, now)` — composes calls to other repos in parallel and returns a single typed snapshot:

  ```ts
  type DashboardSnapshot = {
    todayTasks: Task[];
    runningTimer: TimeEntry | null;
    activeProjects: ProjectCard[];
    recentActivity: AuditLog[];
    stats: {
      hoursThisWeekSec: number;
      outstandingInvoiceTotal: { amount: Decimal; currency: Currency };
      proposalsPendingCount: number;
      overdueInvoiceCount: number;
    };
    fxStaleAt: Date | null; // the oldest fx rate fetched timestamp the dashboard depends on
    skippedOnboardingHints: string[];
  };
  ```

The function fans out to:

- `tasksRepo.listToday(userId, now)` for today and in-progress tasks.
- `timeEntriesRepo.findRunning(userId)` for the running timer.
- `projectsRepo.list(userId, { status: ['active', 'on_hold'] })` for active projects (with derived stats per project).
- `auditRepo.listForActivity(userId, { limit: 10, actions: [...] })` for the activity feed.
- `timeEntriesRepo.sumWeekly(userId, now)` for hours this week.
- `invoicesRepo.aggregateOutstanding(userId, baseCurrency)` for the outstanding total.
- `proposalsRepo.countPending(userId)` for proposals pending.
- `invoicesRepo.countOverdue(userId)` for overdue invoices.
- `fxRepo.getOldestFetchedAt(currencyPairs)` for the stale-FX banner.

Each sub-repo function is built per-module; the dashboard repo composes.

## Validation Rules

Not applicable — the dashboard performs no writes.

## Permissions and Tenant Isolation

Standard. Every sub-repo call passes `userId`. The dashboard repo never accepts data from input.

A two-user isolation test asserts: `getDashboardSnapshot` for user A never returns user B's tasks, projects, activity, or aggregated stats.

## Audit and Notifications

The dashboard does not write audit entries (read-only). The bell icon in the top nav (hosted by the dashboard's app shell, not the dashboard itself) drives the in-app notification feed; see [14-in-app-notifications](./14-in-app-notifications.md).

## Emails Sent

Not applicable.

## Background Jobs

Not applicable. The stats are computed at read time. The FX rates are refreshed by the `fx.refresh` cron (in [09-invoices](./09-invoices.md) and `docs/architecture/fx-and-currency.md`).

## Edge Cases and Decisions

- **No projects, but a client exists.** The empty-state full-page card does not show; the dashboard renders all sections with empty inlines (today is empty, active projects is "No active projects," activity is empty, stats all zero).
- **All sections empty.** The full-page `{component.empty-state-card}` shows for brand-new accounts (no clients). Otherwise the inline empty states render section by section.
- **Outstanding total in mixed currencies.** Aggregated to `User.defaultCurrency` using the latest `FxRate` snapshot. The card shows the converted total in the user's default currency; hovering or tapping the card opens a `{component.tooltip}` with a per-currency breakdown.
- **A user changes their default timezone mid-day.** The "today" boundary recomputes. Tasks that were "today" might shift to "yesterday" or "tomorrow" instantly.
- **Heavy account (many invoices, many time entries).** The aggregations are SQL-side (sum, count) so they remain fast. The today and activity queries cap at small limits; the dashboard render does not iterate over thousands of rows.
- **Stale FX (>48h).** The banner surfaces. Stats still render with the stale rate; the banner is the disclosure.

## Definition of Done

- The page is a Server Component that loads in a single round trip with parallel sub-queries.
- Every section renders correctly for empty, partial, and populated state.
- The full-page empty state shows only when the account has no clients.
- The skipped-step reminder banners surface correctly for 7 days after onboarding completion.
- The 4-up stats card grid matches the design tokens; the warning border on overdue > 0 is implemented.
- A two-user isolation test on `dashboard.repo.ts` covers `getDashboardSnapshot`.
- A Playwright test signs in, asserts each section renders, and verifies that clicking through Quick Actions opens the right modals/routes.
- Screenshots of the populated dashboard, the empty state, and the stale-FX banner state captured.
