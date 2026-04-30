# Module 07 — Updates

## Purpose

Updates are per-project status notes — the freelancer's running monologue to the client. The freelancer posts a progress note, a blocker, a milestone, or a casual note; the client reads it inside the portal as a clean, designed feed; optionally, the post triggers an email so the client does not have to keep checking. The point of updates is not internal record-keeping (that is what tasks and time are for); the point is the client-facing narrative of the engagement. Tiptap powers the rich text. The same editor data renders both the in-app view and the email.

## In Scope (v1)

- Create, edit (within 24h), pin, unpin, and delete an update.
- Tiptap rich text body with heading, bold, italic, lists, link, code, blockquote, and inline image (UploadThing).
- Per-update category: `progress`, `blocker`, `milestone`, `note`.
- Per-update `notifyClient` toggle that fires the `update.posted` Inngest event and emails the client.
- One pinned update at a time per project (pinning a new update unpins the old).
- File attachments via UploadThing (`update-attachments` context).
- Per-project visibility through the existing `clientVisible` model: all updates are visible to the client by default in v1.

## Out of Scope (v1)

- **Client comments.** Cut to v2; the client portal is read-only.
- **Reactions / acknowledgments.** Cut to v2.
- **Scheduled publishing.** Cut to v2; updates publish immediately on submit.
- **Update templates.** Cut to v2; saved blocks for proposals do not extend here.
- **Mention or @-tagging.** Cut entirely; one user per account.
- **Tables in the editor.** Cut to v2; the editorial layout would not look right with rough tables.
- **Drafts as a separate state.** Cut to v2; an update is either posted or not yet created.

## Data Model

Uses `Update` and `UpdateAttachment` (see `docs/architecture/data-model.md`). Relevant columns on `Update`: `id`, `userId`, `projectId`, `title`, `bodyJson` (Tiptap document), `bodyHtml` (server-rendered, sanitized), `isPinned`, `emailSentAt`. A `category` enum column is added by this module's migration if not already present (`progress | blocker | milestone | note`, default `progress`).

`UpdateAttachment` carries `id`, `updateId`, `url`, `filename`, `sizeBytes`, `mimeType`.

## User Flows

### Create

1. From the project Updates tab, the user clicks `{component.button-primary}` "New update." A `{component.sheet-right}` opens with the editor.
2. Sheet contents:
   - Title `{component.text-input}` at the top in `{typography.title-md}` font.
   - Category `{component.select}` with the four categories.
   - Body: a Tiptap editor with a fixed toolbar at the top (heading, bold, italic, list, link, code, image upload).
   - Attachments: `{component.file-upload-zone}` accepting multiple files; uploaded files render below as `{component.feature-icon-card}` rows with name + size + remove.
   - Notify client `{component.toggle-switch}`. Default `true` for `progress` and `milestone`, default `false` for `blocker` and `note`.
   - Pin `{component.toggle-switch}`. Default `false`.
3. Submit calls `createUpdate`. The action validates input, server-renders `bodyHtml` from `bodyJson` (using a sanitizing pipeline; see `docs/architecture/email-system.md`), inserts the row, links attachments, and (if `notifyClient`) emits `update.posted` Inngest event.
4. The sheet closes and the new update appears at the top of the feed (or pinned if `pinned`).

### Edit (within 24 hours of creation)

1. From an update's `{component.dropdown-menu}`, the user clicks "Edit." The same sheet opens pre-filled.
2. After 24 hours, the action returns `{ ok: false, error: "EDIT_WINDOW_CLOSED" }`; the menu hides Edit.
3. Edits do not re-fire the `update.posted` event; the email is sent once on initial creation if `notifyClient` was true.

### Pin

1. The user clicks "Pin" in the menu. The action `pinUpdate` sets `isPinned = true` on this update and `false` on any other pinned update for the same project, in a single transaction.
2. The pinned update floats to the top of the feed with a subtle accent border in `{colors.primary}` left edge and a `{component.status-pill}` "Pinned" tag.

### Delete

1. From the menu, the user clicks "Delete." A `{component.modal}` confirms.
2. The action removes the update; the cascade rule removes the attachments. Files in UploadThing are not deleted by the action; the orphaned-files job (see `docs/architecture/file-uploads.md`) cleans them up.

## UI Surfaces

### Project Updates tab

- Top bar: `{component.button-primary}` "New update," and a `{component.nav-pill-group}` filtering "All / Progress / Blocker / Milestone / Note."
- Feed: a vertical stack of `{component.client-portal-update-card}` items. Each card shows:
  - Header row: category `{component.status-pill}` (color tone matches category), pinned badge if applicable, posted date in `{typography.caption}` `{colors.muted-soft}`, actions `{component.dropdown-menu}` (Edit if within 24h, Pin/Unpin, Delete).
  - Title in `{typography.title-md}`.
  - Body rendered from `bodyHtml` inside a `<div>` styled with the editorial Tiptap output styles (Inter, paragraph spacing, list indentation).
  - Attachments rendered as a grid of small `{component.feature-icon-card}` rows beneath the body.
- Empty state: `{component.empty-state-card}` ("No updates yet on this project").

### Client portal — same content, read-only

The client portal renders the same `{component.client-portal-update-card}` shape with the actions menu removed. Pinned card stays at the top with the same accent border. The portal feed surface is described fully in [10-client-portal](./10-client-portal.md).

### Editor sheet

`{component.sheet-right}` (right-side slide-in, ~640px wide). The editor area uses Tiptap with a sticky toolbar; toolbar buttons are `{component.button-icon-circular}` (small size). Tiptap's bubble menu is disabled in v1; the fixed toolbar covers everything.

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `createUpdate` | `createUpdateSchema` (projectId, title, category, bodyJson, attachments, notifyClient, pinned) | `{ ok: true, data: { id } }` | Server-renders `bodyHtml`; inserts; if `pinned`, unpins others; if `notifyClient`, emits `update.posted`. Writes `update.posted` audit. |
| `editUpdate` | `editUpdateSchema` (id + partials) | `{ ok: true, data: Update }` | Refuses outside 24h window. Re-renders `bodyHtml`. Writes `update.edited` audit. |
| `deleteUpdate` | `{ id }` | `{ ok: true }` | Removes update and attachments. Writes `update.deleted` audit. |
| `pinUpdate` | `{ id }` | `{ ok: true }` | Sets `isPinned = true`; unpins others on same project. Writes `update.pinned` audit. |
| `unpinUpdate` | `{ id }` | `{ ok: true }` | Sets `isPinned = false`. Writes `update.unpinned` audit. |

## Repository Functions

In `src/lib/repositories/updates.repo.ts`:

- `findById(userId, id)` — single update with attachments.
- `listByProject(userId, projectId, { category? })` — sorted with pinned first, then `createdAt` desc.
- `listForPortal(ctx, projectId)` — used by portal repo (`ctx = { userId, clientId }`); same shape, scoped through project's `clientId`.
- `create(userId, input)` — insert; renders `bodyHtml`.
- `edit(userId, id, input)` — `updateMany` with the 24h window check.
- `pin(userId, id)` — transaction: unpins others on the same project, pins this one.
- `unpin(userId, id)`.
- `delete(userId, id)`.

The Tiptap-to-HTML render uses the shared sanitizer in `src/lib/rich-text/render.ts` so the same output renders the in-app view, the portal view, and the email.

## Validation Rules

- **Title.** 1–200 characters, trimmed. Required.
- **Category.** Enum, required, default `progress`.
- **Body.** Tiptap JSON document, validated against the allowed schema (heading 2–4, paragraph, bold, italic, link, list, code, blockquote, image). Maximum serialized length 200 KB.
- **Attachments.** Max 10 per update. Per-file size and MIME constraints enforced by UploadThing config (`update-attachments` context: PDF, PNG, JPG, MP4 up to 50 MB).
- **Notify client.** Boolean. Default depends on category.
- **Pinned.** Boolean.

## Permissions and Tenant Isolation

Standard. All reads and writes through `updates.repo.ts` with `userId`. The portal path uses `(userId, clientId)` and joins through `Project` to enforce client scope.

A two-user isolation test asserts: user A cannot read or write user B's updates; the portal listing for user A's client X does not surface user A's client Y updates.

The Tiptap renderer is a permitted user of `dangerouslySetInnerHTML` (one of two whitelisted in `CLAUDE.md`). The renderer module sanitizes the HTML at the server boundary using `isomorphic-dompurify` with a strict allowlist; the sanitized output is what gets stored as `bodyHtml`. The browser renders the already-sanitized HTML directly.

## Audit and Notifications

Audit actions: `update.posted`, `update.edited`, `update.deleted`, `update.pinned`, `update.unpinned`.

Audit metadata for `update.posted`: `{ projectId, sentEmail: boolean, attachmentCount }`.

No in-app notifications fire from update events (these are author-initiated actions; the freelancer does not need to be notified about their own posts).

## Emails Sent

- `update-posted.tsx` to the client when `notifyClient = true`. Per-template subject and body customizable via `EmailSettings` (see [15-email-customization](./15-email-customization.md)).

The email contains the update's title, body, attachments-as-links (not inline files), and a link to the client portal page for that project.

## Background Jobs

- `update.posted` Inngest event handler:
  1. Loads the update, the project, the client, and the freelancer's email settings.
  2. Renders subject and body with variables (`{client_name}`, `{project_name}`, `{freelancer_name}`, `{view_link}`).
  3. Calls `sendEmail` with idempotency key `update-posted:<updateId>`.
  4. On success, sets `Update.emailSentAt = now`.
  5. Errors retry per Inngest defaults; after final failure, the freelancer sees an in-app notification "Email failed for the latest update."

No cron jobs.

## Edge Cases and Decisions

- **Edit window expiry mid-edit.** If the user opens the edit sheet within 24h but submits 5 minutes after the window closes, the action enforces the window at write time and rejects. The UI surfaces the error and offers to copy the body content for a new update.
- **Pin a different update while one is pinned.** Single transaction handles both: unpin old, pin new. If the transaction fails, neither change applies.
- **Notify client toggle changed from off to on after creation.** Not supported in v1. The `notifyClient` decision is taken at create time. To send a missed email, the freelancer creates a new update referencing the prior one.
- **Email send fails permanently (e.g., the client's email is invalid).** The audit row records the attempt; `Update.emailSentAt` stays null. The bounce flag (`Client.emailValid`) flips on hard bounce; subsequent updates skip the send.
- **Update with no body, only an attachment.** Allowed if title is present. The body Tiptap document can be empty (a single empty paragraph).
- **An attachment fails to upload but the user submits anyway.** The form blocks submit until all uploads complete or the user removes the failed file.

## Definition of Done

- All five server actions implemented and typed.
- The Tiptap editor renders with the fixed toolbar, no bubble menu, and the sanitizer applied at the server boundary.
- The `update-posted` email pipeline sends and sets `emailSentAt` on success.
- A two-user isolation test for `updates.repo.ts` covers every function including the portal listing.
- A Vitest test exercises the 24-hour edit window with a mocked clock.
- A Playwright test posts an update with `notifyClient = true`, asserts the email was queued (mocked at the boundary), and asserts the portal feed renders the update.
- Screenshots of the project Updates tab, the editor sheet, and the rendered update card captured.
