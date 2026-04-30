# Module 14 — In-App Notifications

## Purpose

A bell-icon notification center in the top nav that shows a recent feed of events the freelancer cares about: a client viewed a proposal, a client accepted, a client paid, an invoice went overdue, a magic-link was redeemed. The feed is derived from the audit log filtered to a small allowlist of action names. Read state is tracked in `NotificationRead`. The feed polls every 60 seconds while the tab is visible. There is no realtime in v1.

## In Scope (v1)

- Bell icon in the top nav with a badge dot for the unread count, capped at "9+."
- Click opens a `{component.dropdown-menu}` (notification panel variant) showing the last 20 notifications.
- Per-notification mark-as-read on click and on hover-to-open destination.
- "Mark all as read" button at the top of the panel.
- 60-second polling on the unread count while tab is visible; pause on hidden tab; resume on visible.
- Click navigates to the notification's entity (proposal, invoice, client).
- Notification source: filtered audit log on a fixed allowlist (`proposal.viewed`, `proposal.accepted`, `proposal.declined`, `invoice.viewed`, `invoice.marked-paid`, `invoice.overdue`, `client.magic-link-redeemed`).

## Out of Scope (v1)

- **Real-time websockets / SSE.** Cut to v2; polling is enough.
- **Web push notifications.** Cut to v2.
- **Per-event preferences / opt-out.** Cut to v2; the v1 allowlist is the implicit preference.
- **Email digest of unread.** Cut to v2.
- **Notification channels (Slack, Discord).** Cut to v2.
- **Per-entity mute (e.g., mute this proposal).** Cut to v2.
- **Filtering inside the panel (by type, by client).** Cut to v2.
- **Notification grouping / collapsing similar events.** Cut to v2.

## Data Model

Uses `AuditLog` and `NotificationRead`. See `docs/architecture/data-model.md` and `docs/architecture/audit-log.md`. The notification feed is a query, not a separate table; only the read state is stored.

## User Flows

### View notifications

1. User clicks the bell `{component.button-icon-circular}` in the top nav. The panel opens (anchor on the bell, drops below).
2. The panel fetches the last 20 audit entries matching the allowlist for the user, joined left to `NotificationRead`. Unread rows are visually distinguished.
3. Each row shows action description, entity name, timestamp, and a small status pill where applicable.
4. Hovering a row shows a "↗" hint on the right; clicking opens the entity.

### Mark one read

1. Clicking a row inserts a `NotificationRead` row for `(userId, auditLogId)` and navigates to the entity.

### Mark all read

1. The panel's top has a "Mark all as read" `{component.button-text-link}`. Clicking calls `markAllNotificationsRead`, which inserts `NotificationRead` rows for every unread audit entry in the user's recent allowlist in a single transaction.

### Polling

1. The bell icon is hosted in the app shell, not the panel. A `useEffect` in the client component polls `getUnreadCount` every 60 seconds while `document.visibilityState === "visible"`.
2. On `visibilitychange` to hidden, the polling pauses. On return to visible, an immediate fetch fires before resuming the interval.

## UI Surfaces

### Bell icon (top nav)

- `{component.button-icon-circular}` (bell glyph). Default state: no badge.
- Unread > 0: a small dot in `{colors.brand-accent}` `#3b82f6` overlaid on the icon's top-right. The dot uses the badge style: `9+` rendered in `{typography.caption}` white when count > 9; just a dot for 1–9.

### Notification panel

- A `{component.dropdown-menu}` (panel variant) anchored to the bell icon, ~360px wide, max height ~480px scrolling.
- Top: heading "Notifications" in `{typography.title-md}`, with `{component.button-text-link}` "Mark all as read" right-aligned. A hairline `{colors.hairline}` divider below.
- Body: list of rows. Each row:
  - Left: a small icon mapped to the action type.
  - Middle: action description in `{typography.body-sm}` (e.g., "Acme viewed your proposal 'Website redesign'"), with the entity name bold in `{typography.body-sm}` weight 600.
  - Right: timestamp in `{typography.caption}` `{colors.muted-soft}` ("2h ago"), or for unread rows a small `{colors.brand-accent}` dot.
  - Background: `{colors.canvas}` for read, `{colors.surface-soft}` for unread.
- Empty state: `{component.empty-state-card}` (compact) "No notifications yet."
- Footer of the panel: `{component.button-text-link}` "View all activity" (post-v1 link to a full activity page; in v1 this is a placeholder that scrolls the panel further or is hidden).

States: loading (skeleton rows), error (a small inline error with a retry link), empty (no rows).

### Mobile

- The bell icon is in the top nav at the same position. The panel becomes a full-screen sheet (`{component.sheet-right}` from the right) on mobile breakpoints.

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `getNotifications` | `{ limit?: number }` | `{ ok: true, data: NotificationItem[] }` | Read-only; returns last N matching audit entries with read state. |
| `getUnreadCount` | `{}` | `{ ok: true, data: { count: number } }` | Read-only. The polling target. Capped at "9+" client-side. |
| `markNotificationRead` | `{ auditLogId }` | `{ ok: true }` | Inserts `NotificationRead` (idempotent on the unique constraint). |
| `markAllNotificationsRead` | `{}` | `{ ok: true, data: { marked: number } }` | Inserts read rows for every currently-unread eligible entry in one transaction. |

## Repository Functions

In `src/lib/repositories/notifications.repo.ts`:

- `listForUser(userId, limit)` — joins `AuditLog` to `NotificationRead`, filters to the allowlist of action names, returns the last N rows with `isRead` derived (`nr.id IS NOT NULL`).
- `countUnread(userId)` — count of allowlist entries with no matching `NotificationRead`.
- `markRead(userId, auditLogId)` — insert with `ON CONFLICT DO NOTHING` semantics (the unique constraint absorbs duplicates).
- `markAllRead(userId)` — single transaction inserting read rows for every currently-unread eligible entry up to a cap (e.g., 200, to avoid pathological transactions).

The allowlist is centralized in `src/lib/notifications/allowlist.ts` so both the action and any future filter UI consult the same list:

```ts
export const NOTIFIABLE_ACTIONS = [
  "proposal.viewed",
  "proposal.accepted",
  "proposal.declined",
  "invoice.viewed",
  "invoice.marked-paid",
  "invoice.overdue",
  "client.magic-link-redeemed",
] as const;
```

## Validation Rules

- **Limit.** Integer 1–50, default 20.

## Permissions and Tenant Isolation

Standard. The query joins through `AuditLog.userId = $userId`. Audit entries with `userId IS NULL` (public-link views) are surfaced via a join through the entity table — for example, `proposal.viewed` audits with null `userId` are joined to `Proposal.userId` to scope to the freelancer who owns the proposal.

A two-user isolation test asserts: user A's notification list never includes audit rows whose entity belongs to user B; the unread count reflects only user A's eligible rows; `markAllRead` for user A does not touch user B's read state.

## Audit and Notifications

The notification module does not write audit entries. Reads of notifications and clicks on rows are not audited.

## Emails Sent

None directly. The Inngest event handlers in other modules send emails for the same events that surface as notifications (see [08-proposals](./08-proposals.md) and [09-invoices](./09-invoices.md)).

## Background Jobs

None scheduled. The polling is client-driven.

## Edge Cases and Decisions

- **Audit row with `userId IS NULL` (public-link view).** Surfaced via the entity-table join. The owner is reachable via `Proposal.userId` or `Invoice.userId`.
- **Audit retention compaction.** When the `audit.compact` cron compresses entries older than 90 days, those rows are replaced with summary rows. Compacted rows are not surfaced in the notification feed (the allowlist filters by exact action names; compacted rows have a generic "compacted" action).
- **A row marked read while the panel is open.** The next poll or panel re-open reflects the new state. There is no real-time push.
- **Mark-all-as-read with hundreds of unread.** Capped at 200 in the transaction. The user can run it again for the next batch. In practice this never happens because the panel only surfaces 20.
- **Audit row deletion (e.g., manual cleanup).** The `NotificationRead` row cascades on audit-row delete (Prisma cascade). No orphaned read rows.
- **Polling and Sentry breadcrumbs.** Each unread-count poll is suppressed from breadcrumbs to avoid noise.
- **Browser back/forward navigation.** The bell icon's badge state is sourced from a tiny client store that updates on each successful poll; navigating does not reset it.
- **Notification for the freelancer's own action.** Excluded by definition: the allowlist contains only events that are externally triggered (the client viewed/accepted/declined/paid; the cron flagged overdue). The freelancer's own writes (sending a proposal, marking an invoice paid) do not produce self-notifications.

## Definition of Done

- The bell icon appears in the top nav across all `(app)` routes.
- Polling runs every 60s while visible and pauses on hidden tabs.
- The panel opens, lists the last 20 eligible audit entries, and visually distinguishes unread from read.
- Click-to-open marks the row read and navigates to the entity.
- Mark-all-as-read transacts and updates the panel.
- A two-user isolation test for `notifications.repo.ts` covers `listForUser`, `countUnread`, `markRead`, `markAllRead`.
- A Vitest test asserts the allowlist is the single source of truth for the filter (a regression test fails if the SQL query and the allowlist diverge).
- A Playwright test signs in, triggers a public proposal view (which writes an audit row), polls/refreshes, and asserts the notification appears with unread state.
- Screenshots of the bell icon (with and without unread), the panel (with mixed read/unread rows), and the empty state captured.
