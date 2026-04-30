# Module 09 — Invoices

## Purpose

Invoices are the second-largest module in v1 and the close of the engagement loop: a project ends with one or more invoices billed to the client, the client pays (tracked manually since v1 has no payment processor), and the engagement closes. Multi-currency is non-negotiable (the primary user works with international clients in PHP, USD, EUR, GBP, AUD, CAD). Public viewer at `/i/[token]`. PDF export. Reminder cron with per-user schedule. Manual mark-as-paid. Sequential invoice numbering per user, per year. FX rate snapshot at issue time.

## In Scope (v1)

- Create, edit, send, mark-paid, void, and (drafts only) delete invoices.
- Multi-currency: PHP, USD, EUR, GBP, AUD, CAD.
- Sequential invoice numbering: `INV-YYYY-NNN` per user per year, monotonic, resets January 1.
- Line items added manually, pulled from time entries, or pulled from a proposal's pricing block.
- FX rate snapshot at issue time, recorded in `Invoice.fxRateToBase`.
- Public viewer at `/i/[token]` rendering the invoice read-only with branded layout.
- PDF export server-side via `@react-pdf/renderer`.
- Reminder emails before and after due date per `InvoiceReminderConfig`.
- Manual mark-as-paid with `paymentMethod` capture.
- Regenerate public token.
- Per-line tax rate (single tax rate per line; tax total per invoice is the sum).

## Out of Scope (v1)

- **Payment processing (Stripe / Lemon Squeezy / PayMongo).** Cut to v2.
- **Recurring invoices.** Cut to v2.
- **Partial payments / payment installments.** The `amountPaid` column exists in the schema but the v1 UI only marks fully paid.
- **Credit notes.** Cut to v2.
- **Multi-currency dashboard aggregation beyond simple sum.** Dashboard sums by base currency using the most recent FX rate; per-engagement aggregation in original currency only.
- **Late fees.** Cut to v2.
- **Invoice attachments.** Cut to v2; the invoice itself is the document.
- **Per-line discounts as a separate field.** Cut to v2; v1 lets the freelancer add a "discount" line item with a negative `unitPrice`.
- **Multi-language invoice templates.** Cut to v2; English only.

## Data Model

Uses `Invoice` and `InvoiceLineItem` (see `docs/architecture/data-model.md`). Relevant `Invoice` columns: `id`, `userId`, `clientId`, `projectId`, `number`, `status`, `publicToken`, `issueDate`, `dueDate`, `currency`, `notes`, `subtotal`, `taxAmount`, `total`, `amountPaid`, `paidAt`, `sentAt`, `viewedAt`, `voidedAt`, `lastReminderAt`. Unique constraint on `(userId, number)`.

A new column on `Invoice`: `fxRateToBase: Decimal(18,8)` (snapshot of the exchange rate from `currency` to the user's `defaultCurrency` at issue time). Added by this module's migration if not already present.

A new column on `Invoice`: `paymentMethod: String?` (free-text on mark-as-paid: "bank transfer," "Wise," "PayPal," etc.). Added by this module's migration.

`InvoiceLineItem` columns: `id`, `invoiceId`, `description`, `quantity`, `unitPrice`, `total`, `position`, `timeEntryId?`, `savedPricingItemId?`. A new column: `taxRate: Decimal(5,4)` (e.g., 0.12 for 12% VAT). Default 0.

## User Flows

### Create

1. From `/(app)/invoices`, the user clicks `{component.button-primary}` "New invoice." A `{component.modal}` (md) opens.
2. The user picks a client (required), an existing project (required; required because the FK is `Restrict`), an issue date (default today), and a due date (default issue date + 14 days). Currency defaults from the project; cannot be changed after creation.
3. Submit calls `createInvoice`. The action computes the next number for `(userId, currentYear)`, generates `publicToken`, snapshots the FX rate from `FxRate(currency, user.defaultCurrency)`, and inserts the row with `status = draft`.
4. Routes to `/(app)/invoices/[id]/edit`.

### Edit

1. The editor at `/(app)/invoices/[id]/edit` shows the invoice metadata (read-only number, editable issue/due dates, editable notes) and a list of line items.
2. Each line item is an `{component.invoice-line-item-row}` with description, quantity, unit price, tax rate, total. Reorder via drag handles.
3. Three add buttons: "Add line item" (manual), "Pull from time entries" (opens a `{component.modal}` listing billable un-invoiced entries for the project; checkbox selection; bulk-add as one or many lines), "Pull from proposal pricing" (opens a `{component.modal}` listing the project's accepted proposal's pricing rows; bulk-add).
4. Auto-save on debounce; recomputes `subtotal`, `taxAmount`, and `total` server-side.
5. The header has `{component.button-primary}` "Send invoice" enabled once at least one line item exists.

### Send

1. From the editor header, "Send invoice" opens a `{component.modal}` with email subject/body preview from `EmailSettings`, the recipient address, and the due date.
2. Submit calls `sendInvoice`. The action transitions status to `sent`, sets `sentAt = now`, emits `invoice.sent` Inngest event, writes audit. The handler sends the `invoice-sent` email.

### Public view (`/i/[token]`)

1. Same flow as the proposal public viewer at the platform level (rate-limited, token lookup, audit on view).
2. The page renders the invoice with a branded shell (described in UI Surfaces).
3. Audit `invoice.viewed`; Inngest sets `viewedAt` if null and notifies the freelancer.

### Mark paid

1. From the invoice detail page, `{component.button-primary}` "Mark as paid" opens a `{component.modal}` with a date picker (default today) and a `{component.text-input}` for `paymentMethod`.
2. Submit calls `markInvoicePaid`. The action sets `status = paid`, `paidAt`, `paymentMethod`, `amountPaid = total`. Writes audit. Emits `invoice.paid`.
3. The freelancer gets an in-app notification (their own action — but the email goes out as a paid receipt-style notification to the client too via the `invoice-paid.tsx` template).

### Void

1. From the detail page actions menu, "Void invoice." A `{component.modal}` confirms.
2. Action sets `status = void`, `voidedAt = now`. Writes audit. The public link still resolves but renders a "void" banner.

### Overdue (cron)

1. The `invoices.check-overdue` cron (daily 00:30 UTC) finds `status IN ('sent', 'viewed') AND dueDate < now`.
2. For each, transitions to `overdue`. Writes audit `invoice.overdue`. Emits notification but no email.

### Reminders (cron)

1. The `invoices.send-reminders` cron (daily 09:00 UTC, in the user's timezone) finds invoices eligible for a reminder per the user's `InvoiceReminderConfig` (`daysBeforeDue` and `daysAfterDue` arrays).
2. For each, sends `invoice-reminder.tsx` email, sets `lastReminderAt = now`, writes audit `invoice.reminder-sent`.
3. Each reminder is idempotent on `(invoiceId, calendarDate)` to avoid double-sends if the cron runs twice in a day.

### Regenerate public token

Same pattern as proposals: action `regenerateInvoiceToken`, writes audit.

### Delete (drafts only)

From the editor menu, "Delete" — confirms and removes the row (cascade clears line items). Refused on non-draft.

## UI Surfaces

### `/(app)/invoices` — list

- Page heading "Invoices" in `{typography.display-md}`.
- Top bar: `{component.nav-pill-group}` "All / Draft / Sent / Paid / Overdue / Void"; right side `{component.button-primary}` "New invoice."
- A `{component.data-table}` with columns Number (`{typography.code}`) / Client / Project / Status / Issue / Due / Total (`{typography.code}` tabular) / Actions.
- Above the table, a row of summary `{component.feature-icon-card}` (small) for "Outstanding total," "Overdue total," "Draft count" — currency aggregated to user's base currency using the latest FX.
- Empty state: `{component.empty-state-card}`.

### `/(app)/invoices/[id]/edit` — editor

App shell + max-width 880px content area.

- Header: invoice number `{typography.code}` `{colors.muted}`; status `{component.status-pill}`; right-side action row with "Send invoice," "Preview," and a `{component.dropdown-menu}` for "Mark as paid / Void / Regenerate token / Delete (drafts only)."
- Metadata band: a `{component.feature-icon-card}` with issue date `{component.date-picker}`, due date `{component.date-picker}`, notes `{component.textarea}`.
- Line items: a `{component.data-table}` with `{component.invoice-line-item-row}` rows. Columns: Description, Qty, Unit Price, Tax %, Total. Drag handle on the left, remove button on the right.
- Below: three action buttons "Add line item" / "Pull from time" / "Pull from proposal."
- Right-aligned `{component.invoice-totals-stack}`: subtotal / tax / total. Total in `{typography.display-sm}`.

### `/(app)/invoices/[id]` — detail (read-only) page

Used after sending. Mirrors the public viewer's layout but inside the app shell and with the freelancer's action menu.

### Public `/i/[token]` — client viewer

- Outer shell: `{colors.canvas}` background, max-width 880px content column centered. Page padding `{spacing.xl}` top, `{spacing.section}` bottom.
- Top band: invoice number in `{typography.code}` `{colors.muted}`; issue date and due date right-aligned in `{typography.caption}`; `{component.status-pill}` showing current status.
- Two-column header: freelancer's logo + business details (left, from `User.businessName`, `User.businessAddress`, `User.businessTaxId`); bill-to block (right, from `Client.name`, `Client.companyName`, `Client.address`, `Client.taxId`).
- Line items: a `{component.data-table}` with `{component.invoice-line-item-row}` rows in read-only mode. Borderless. Header row in `{typography.caption}` `{colors.muted}` uppercase. Cells in `{typography.body-md}`. Numeric columns use tabular nums.
- Below the table: `{component.invoice-totals-stack}` right-aligned. Subtotal / Tax / Total. Total in `{typography.display-sm}`.
- Notes block (if present) below the totals in `{typography.body-md}` `{colors.body}`.
- Payment instructions block (if `User.paymentInstructions` is set in settings) below notes.
- "View as PDF" `{component.button-secondary}` linking to `/api/pdf/public/invoice/[token]`.
- Footer: `{component.footer}` (dark surface) carrying the freelancer's wordmark and "Powered by Middlemist."

For `paid`, `void`, or `overdue` statuses: a banner `{component.alert-banner}` at the top of the column ("Paid on April 25" / "This invoice has been voided" / "Past due — please remit"). Status is non-actionable from the public side; there is no "mark paid" button in v1.

## Server Actions

| Action                           | Input                                                                | Output                                     | Side effects                                                                                               |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `createInvoice`                  | `createInvoiceSchema` (clientId, projectId, issueDate?, dueDate?)    | `{ ok: true, data: { id } }`               | Computes number; generates token; snapshots FX; inserts. Writes audit.                                     |
| `updateInvoice`                  | `updateInvoiceSchema` (id + partials)                                | `{ ok: true, data: Invoice }`              | Updates fields. Recomputes totals if line items changed.                                                   |
| `sendInvoice`                    | `{ id }`                                                             | `{ ok: true, data: Invoice }`              | Transitions to `sent`; emits `invoice.sent`. Writes audit.                                                 |
| `markInvoicePaid`                | `markPaidSchema` (id, paidAt?, paymentMethod?)                       | `{ ok: true, data: Invoice }`              | Status → `paid`. Sets `paidAt`, `paymentMethod`, `amountPaid = total`. Writes audit. Emits `invoice.paid`. |
| `voidInvoice`                    | `{ id }`                                                             | `{ ok: true }`                             | Status → `void`. Sets `voidedAt`. Writes audit.                                                            |
| `regenerateInvoiceToken`         | `{ id }`                                                             | `{ ok: true, data: { newToken } }`         | New nanoid(21); writes audit.                                                                              |
| `addInvoiceLineItem`             | `addLineItemSchema`                                                  | `{ ok: true, data: InvoiceLineItem }`      | Inserts; recomputes totals.                                                                                |
| `updateInvoiceLineItem`          | `updateLineItemSchema`                                               | `{ ok: true, data: InvoiceLineItem }`      | Updates; recomputes totals.                                                                                |
| `removeInvoiceLineItem`          | `{ id }`                                                             | `{ ok: true }`                             | Removes; recomputes totals. Clears `TimeEntry.invoicedLineItemId` if applicable.                           |
| `pullInvoiceFromTimeEntries`     | `{ invoiceId, timeEntryIds, groupBy?: "task" \| "day" \| "single" }` | `{ ok: true, data: { lineItemsCreated } }` | Bulk-create line items from selected time entries; sets `TimeEntry.invoicedLineItemId`.                    |
| `pullInvoiceFromProposalPricing` | `{ invoiceId, proposalId }`                                          | `{ ok: true, data: { lineItemsCreated } }` | Reads proposal's pricing block; bulk-creates line items.                                                   |
| `deleteInvoice`                  | `{ id }`                                                             | `{ ok: true }`                             | Allowed only on `draft`. Cascades line items.                                                              |

## Repository Functions

In `src/lib/repositories/invoices.repo.ts`:

- `findById(userId, id)` with line items.
- `findByPublicToken(token)` — non-tenant.
- `list(userId, { status?, clientId?, projectId? })`.
- `getNextNumber(userId, year)` — selects the max sequence for the year and returns `INV-YYYY-NNN` formatted.
- `create(userId, input)` — generates number, token, FX snapshot.
- `update(userId, id, input)`.
- `setStatus(userId, id, status, transitionData)`.
- `regeneratePublicToken(userId, id)`.
- `getOverdueCandidates(now)` — non-tenant; cron path.
- `getReminderCandidates(now, configsByUserId)` — non-tenant; cron path.
- `setReminderSent(invoiceId)` — marks `lastReminderAt = now`.
- `delete(userId, id)` — `deleteMany` with `{ id, userId, status: 'draft' }`.

In `src/lib/repositories/invoice-line-items.repo.ts`:

- `findById(userId, id)` — joins through Invoice for tenancy check.
- `listByInvoice(userId, invoiceId)`.
- `create(userId, invoiceId, input)`.
- `update(userId, id, input)`.
- `delete(userId, id)`.
- `recomputeTotals(userId, invoiceId)` — sums line items, applies tax, writes back to Invoice.

## Validation Rules

- **Number.** Format `INV-YYYY-NNN`. Computed; not accepted from client input.
- **Issue date.** Required. Must not be in the future at create time (warning, not error). Editable until sent.
- **Due date.** Required. Must be `>= issueDate` at create time.
- **Currency.** Required at create. Not editable after create.
- **Notes.** 0–2000 characters; markdown source.
- **Line item description.** 1–500 characters.
- **Line item quantity.** `Decimal(10,2)`, > 0.
- **Line item unit price.** `Decimal(12,2)`. Can be negative (for discount lines) or zero.
- **Line item tax rate.** `Decimal(5,4)`, between 0 and 1 (so 0.12 = 12%). Default 0.
- **Status transitions:**

  | From    | To allowed                                  |
  | ------- | ------------------------------------------- |
  | draft   | sent, void, deleted                         |
  | sent    | viewed (system), paid, overdue (cron), void |
  | viewed  | paid, overdue (cron), void                  |
  | overdue | paid, void                                  |
  | paid    | (terminal)                                  |
  | void    | (terminal)                                  |

## Permissions and Tenant Isolation

Standard for authenticated paths. Public viewer takes a token; lookup is by `publicToken` only. Public route does not allow any state change in v1 (no public mark-paid).

A two-user isolation test asserts: user A cannot read or write user B's invoices or line items; `findByPublicToken` returns user B's invoice only for user B's exact token; the unique constraint `(userId, number)` allows the same number string for two different users (tested with both creating `INV-2026-001`).

## Audit and Notifications

Audit actions: `invoice.created`, `invoice.sent`, `invoice.viewed`, `invoice.marked-paid`, `invoice.marked-void`, `invoice.overdue`, `invoice.regenerated-token`, `invoice.reminder-sent`.

In-app notifications (bell icon): `invoice.viewed`, `invoice.marked-paid`, `invoice.overdue`.

## Emails Sent

- `invoice-sent.tsx` to client on `invoice.sent`.
- `invoice-viewed.tsx` to freelancer on first `invoice.viewed`.
- `invoice-reminder.tsx` to client on each reminder fire (idempotent per day per invoice).
- `invoice-paid.tsx` to freelancer (and optionally to client as a receipt) on `invoice.marked-paid`.

The invoice-sent and invoice-reminder templates have customizable subject and body via `EmailSettings`.

## Background Jobs

- `invoice.sent` event handler: send `invoice-sent` email.
- `invoice.viewed` event handler: set `viewedAt` if null; freelancer email + notification.
- `invoice.paid` event handler: freelancer email + notification; optional client receipt.
- `invoices.check-overdue` cron (daily 00:30 UTC).
- `invoices.send-reminders` cron (daily 09:00 UTC user-local; computed via `User.defaultTimezone`).
- `fx.refresh` cron (06:00 UTC daily) refreshes `FxRate`. Not strictly part of this module but invoices depend on it; see `docs/architecture/fx-and-currency.md`.

## PDF generation

`/api/pdf/public/invoice/[token]` (route handler), public, rate-limited. Renders via `@react-pdf/renderer`. Template lives in `src/lib/pdf/templates/Invoice.tsx`. Uses ink (`#111111`), Inter Display for the title, Inter for body, JetBrains Mono for the invoice number and line item amounts. Page numbers, business name, and tax ID in the footer.

The freelancer's authenticated path at `/api/pdf/invoice/[id]` returns the same PDF for preview.

## Edge Cases and Decisions

- **First invoice of the year.** `getNextNumber(userId, 2026)` returns `INV-2026-001`. The numbering is per `(userId, year)`; two users on the same day both get `INV-2026-001`.
- **Concurrent invoice creation race.** Two `createInvoice` calls in the same millisecond could each compute the same next number. Mitigation: the unique constraint `(userId, number)` will fail one of the inserts; the action retries with the next number on the unique violation. A simple advisory lock or sequence per (user, year) is a v2 hardening.
- **Currency mismatch between project and pull-from-time-entries.** Time entries do not carry their own currency; the invoice's currency is used. The freelancer is responsible for ensuring rate consistency.
- **Pull from proposal pricing where the proposal currency does not match the invoice currency.** Refused at the action layer with `{ ok: false, error: "CURRENCY_MISMATCH" }`. The freelancer must create the invoice in the proposal's currency or convert manually.
- **FX rate is stale (older than 48h).** The dashboard surfaces a warning. Invoice creation still snapshots whatever rate is in `FxRate`. The audit metadata for `invoice.created` records the rate's `fetchedAt`.
- **Mark-as-paid on a `draft` invoice.** Refused; the status table forbids `draft → paid` directly. The user must first send.
- **Void a paid invoice.** Refused; `paid` is terminal. Use a credit-note workflow (cut to v2) for v1 the freelancer can void only non-paid invoices.
- **Overdue cron fires twice for the same invoice.** Idempotent: the cron filters on `status IN ('sent', 'viewed')` and the first fire transitions to `overdue`; the second fire's filter excludes the row.
- **Reminder cron in the user's timezone with DST.** `User.defaultTimezone` is the source of truth; the cron computes "09:00 local" by checking the offset for each user. Twice-yearly DST transitions may shift the local fire by an hour but the daily idempotency on `(invoiceId, calendarDate)` prevents duplicate sends.
- **Editing an invoice after sending.** Allowed for notes and dates; refused for line items, currency, or recipient. The UI grays out forbidden fields and shows a banner explaining why.

## Definition of Done

- All thirteen server actions implemented and typed.
- The numbering, FX snapshot, and totals recomputation logic all covered by Vitest tests.
- A two-user isolation test for `invoices.repo.ts` and `invoice-line-items.repo.ts` covers every function.
- The status-transition table is exhaustively tested (every disallowed transition returns `INVALID_TRANSITION`).
- The reminder cron is unit-tested with a mocked clock and a fixture user with a non-default reminder schedule.
- The PDF render produces a snapshot that matches a fixture for each of the six supported currencies.
- A Playwright e2e test creates an invoice, sends it, opens the public URL in a clean browser context, marks it paid in the freelancer view, and asserts the public URL now shows the paid banner.
- The customizable email pipeline picks up overrides from `EmailSettings`.
- Screenshots of the editor, the public viewer (with realistic line items), the mark-paid modal, the rendered PDF, and a paid-state public view captured.
