# Module 03 — Clients

## Purpose

Clients are the second-most central object in Middlemist after the project. Every project, proposal, and invoice is addressed to one client. This module manages the client list: creating, editing, archiving, and (rarely) deleting client records, and providing a per-client detail view that summarizes everything attached to that client. The bounce flag (`emailValid`) wired to the Resend webhook lives here too.

## In Scope (v1)

- Create, edit, archive, unarchive, and (with restrictions) delete a client.
- List clients with active/archived toggle and search by name, company, or email.
- Per-client detail page with sub-sections for projects, proposals, invoices, and lifetime totals.
- `emailValid` flag managed by the bounce webhook.
- Per-client default currency (informational; project carries the actual transaction currency).
- Client portal magic-link request from the client detail page (handled by [Client Portal](./10-client-portal.md)).

## Out of Scope (v1)

- **CSV import.** Cut to v2; manual client creation is enough at the volume one freelancer handles.
- **Tags.** Cut to v2; the client list at v1 scale does not need tag-level grouping.
- **Custom fields.** Cut to v2; the fixed schema covers the common needs and avoids a meta-model.
- **Multiple contacts per company.** Cut to v2; v1 treats one email per client. A second contact would be a second client today.
- **Activity timeline per client.** Cut to v2; the per-client audit panel is post-v1. The detail page surfaces only the related entities.

## Data Model

Uses `Client` (see `docs/architecture/data-model.md`). Relevant columns: `id`, `userId`, `name`, `companyName`, `email`, `phone`, `website`, `address`, `taxId`, `notes`, `emailValid`, `preferredCurrency`, `archivedAt`. Foreign keys from `Project`, `Proposal`, `Invoice`, `ClientPortalSession`.

## User Flows

### Create

1. From `/(app)/clients`, the user clicks the `{component.button-primary}` "New client." A `{component.modal}` (size md) opens.
2. The user fills in name (required), email (required), and optional fields. Submit calls `createClient`.
3. The action validates input, writes the row, returns the new id, and the modal closes. The list refreshes via Next's revalidation.
4. **Error path (duplicate email):** the schema does not enforce email uniqueness per user (the user might have two clients at the same domain). The form does not block; the action does not check.

### Edit

1. From a client detail page or the list row's `{component.dropdown-menu}`, the user clicks "Edit." The same modal opens pre-filled.
2. Submit calls `updateClient`. On success, the modal closes and the data refreshes.

### Archive / unarchive

1. From the list or detail page, the user clicks "Archive" in the `{component.dropdown-menu}`. A `{component.modal}` confirms.
2. The action sets `archivedAt = now`. The list refreshes; archived clients only appear under the "Archived" pill of the `{component.nav-pill-group}`.
3. Unarchiving clears `archivedAt`.

### Delete

1. From the detail page, the user clicks "Delete" in the danger zone. A `{component.modal}` confirms.
2. The action attempts the delete. If the client has any projects, proposals, or invoices, the database raises a foreign-key violation; the action catches and returns `{ ok: false, error: "CLIENT_HAS_REFERENCES" }`. The form surfaces a `{component.alert-banner}` instructing the user to archive instead.
3. If the client has only `ClientPortalSession` rows (cascade delete), the delete proceeds.

### Bounce-driven email-invalid flow

1. A client's email hard-bounces in Resend.
2. The webhook handler at `/api/email/webhook` verifies the signature, finds the matching `Client.email`, and sets `emailValid = false`.
3. The next time the user opens this client's detail page, an `{component.alert-banner}` (warning) reads "Email bounced — update before sending." Sending email is blocked at the call site.
4. The user updates the email; the action resets `emailValid = true`.

## UI Surfaces

### `/(app)/clients` — list view

Inside the standard app shell. Contents:

- Page heading "Clients" in `{typography.display-md}`.
- Top bar: `{component.nav-pill-group}` toggling "Active / Archived"; a `{component.text-input}` (search variant) right-aligned that filters by name/company/email; a `{component.button-primary}` "New client."
- Body when there are clients: a `{component.data-table}` with columns Name (avatar + name + company), Email, Recent activity (last project or invoice), Actions (`{component.dropdown-menu}` with Edit / Archive / Delete).
- Body when empty: `{component.empty-state-card}` with an icon, "Add your first client" headline in `{typography.title-lg}`, supporting text, and a `{component.button-primary}` opening the create modal.
- Loading state: skeletons inside the `{component.data-table}` rows.
- Bounce warning: rows where `emailValid = false` show a small `{component.status-pill}` (warning tone) "Email bounced" next to the email column.

### `/(app)/clients/[id]` — detail page

App shell + max-width 880px content area. Contents:

- Header: avatar (initials in a `{component.badge-pill}` with a pastel from the badge palette), client name in `{typography.display-md}`, company name below in `{typography.body-md}` `{colors.muted}`. Action row right-aligned: `{component.button-secondary}` "Edit," `{component.dropdown-menu}` for Archive / Delete / Send portal magic link.
- Section "Contact" inside `{component.feature-icon-card}`: email (with copy button), phone, website, address.
- Section "Projects": list of `{component.feature-icon-card}` (3-up grid) for active projects; archived/completed projects collapsed below a `{component.button-text-link}` "Show 4 archived." Each card uses the same shape as the projects list (see [04-projects](./04-projects.md)).
- Section "Proposals": list rendered as small `{component.feature-icon-card}` rows with status `{component.status-pill}`, total amount in `{typography.code}`, and last update time in `{typography.caption}` `{colors.muted-soft}`.
- Section "Invoices": same shape as proposals; total in invoice currency, status pill (paid / sent / overdue / draft / void).
- Section "Lifetime totals": small grid of `{component.feature-icon-card}` showing total billed, total paid, outstanding (overdue and current). Numbers in `{typography.display-sm}`. Currency aggregations follow `docs/architecture/fx-and-currency.md`.

States: empty sub-sections render an inline `{component.empty-state-card}` (compact variant) with a single CTA ("Create proposal," "Create project," etc.).

### `/(app)/clients/new` — modal route

Modal-as-route (intercepting route pattern). The same `{component.modal}` content as the inline create modal, addressable via direct URL for keyboard navigation and bookmarking. Closing returns to wherever the user came from (or `/clients` as fallback).

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `createClient` | `createClientSchema` | `{ ok: true, data: { id } }` | Inserts client; writes `client.created` audit. |
| `updateClient` | `updateClientSchema` (id + partial fields) | `{ ok: true, data: Client }` | Updates client; resets `emailValid` if email changed. Writes `client.updated` audit. |
| `archiveClient` | `{ id }` | `{ ok: true }` | Sets `archivedAt = now`. Writes `client.archived` audit. |
| `unarchiveClient` | `{ id }` | `{ ok: true }` | Clears `archivedAt`. Writes `client.unarchived` audit. |
| `deleteClient` | `{ id }` | `{ ok: true }` or `{ ok: false, error: "CLIENT_HAS_REFERENCES" }` | Hard-deletes if no FK references exist. Writes `client.deleted` audit. |

`requestClientMagicLink` lives in [10-client-portal](./10-client-portal.md) and is invoked from the client detail page UI.

## Repository Functions

In `src/lib/repositories/clients.repo.ts`:

- `findById(userId, id)` — single client lookup, scoped by userId.
- `list(userId, { search, includeArchived })` — list with optional search and archive filter.
- `listForClientPicker(userId)` — minimal projection (id, name, companyName, defaultCurrency) used in proposal and project create forms; only active clients.
- `create(userId, input)` — inserts with `userId` injected.
- `update(userId, id, input)` — `updateMany` with `{ id, userId }` to keep cross-tenant access a count-zero no-op.
- `archive(userId, id)` — sets `archivedAt`.
- `unarchive(userId, id)` — clears `archivedAt`.
- `delete(userId, id)` — hard delete; throws on FK violation, caught at the action layer.
- `setEmailValid(userId, email, valid)` — used by the bounce webhook handler.

## Validation Rules

- **Name.** 1–120 characters, trimmed. Required.
- **Email.** Standard format. Required. Lower-cased before insert.
- **Company name.** 0–120 characters.
- **Phone.** 0–32 characters; format-agnostic (international).
- **Website.** Optional URL. If provided, validated against a URL schema.
- **Address.** 0–500 characters; multi-line allowed.
- **Tax ID.** 0–50 characters.
- **Notes.** 0–4000 characters; markdown source. Renders as plain markdown on the detail page (no Tiptap here).
- **Country.** ISO-3166-1 alpha-2 from a fixed list. (Not strictly enforced in v1; included in zod as optional with a regex if present.)
- **Default currency.** ISO-4217 from the supported set.

## Permissions and Tenant Isolation

Standard. Every read and write goes through `clients.repo.ts` with `userId`. The bounce webhook is the only path that does not start from a session: it looks up by `email` matched against `Client.email` and updates `emailValid`. The webhook signature is verified from `env.RESEND_WEBHOOK_SECRET`. The lookup matches on email alone, but the only side effect is flipping `emailValid` on the matching row(s); no data leaks.

A two-user isolation test asserts: user A cannot find, update, archive, or delete a client owned by user B; the bounce webhook flag does not cross tenants (a bounce on user A's `info@acme.com` does not flag user B's `info@acme.com`).

## Audit and Notifications

Audit actions: `client.created`, `client.updated`, `client.archived`, `client.unarchived`, `client.deleted`. None of these surface in the in-app notification feed; client mutations are freelancer-initiated and do not warrant a notification.

## Emails Sent

None directly from this module. The client portal magic link is sent from the [Client Portal](./10-client-portal.md) module.

## Background Jobs

None scheduled. The bounce webhook (`/api/email/webhook`) is the only event-driven entry that touches `Client` rows.

## Edge Cases and Decisions

- **Duplicate email per user.** Allowed. The same person at two companies, or two people at the same email account, can both be clients. No uniqueness constraint at the schema or action level.
- **Same email across users.** Allowed by tenancy: each user has their own `Client` row. The bounce webhook flips `emailValid` on every matching row across users (this is intentional; the email itself bounced).
- **Archived clients in the picker.** Hidden. The proposal/project/invoice create forms only see active clients. To address an archived client, unarchive first.
- **Delete with references.** Refused at the action level via the FK violation; the UI nudges the user to archive instead. There is no force-delete in v1.
- **Notes field with very long markdown.** Capped at 4000 characters at the schema layer. The detail page renders it inside a `{component.feature-icon-card}` with `{typography.body-md}`; long notes scroll within the card up to 240px tall.
- **`preferredCurrency` vs project currency.** The client's preferred currency is informational. The project chooses its own currency at creation, defaulting to the client's preferred (if set) or the user's default.

## Definition of Done

- All five server actions implemented and typed end-to-end.
- `clients.repo.ts` covered by a two-user isolation test that exercises every function.
- The list and detail pages render correctly with empty, populated, and bounce states.
- The bounce webhook updates `emailValid` and is unit-tested with a signed payload fixture.
- A Playwright test runs the happy-path: create → edit → archive → unarchive → delete (with no references).
- Screenshots of `/clients`, `/clients/[id]`, and the create modal captured for the case study.
