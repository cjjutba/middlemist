# Module 15 — Email Customization

## Purpose

Lets the freelancer customize the subject line, body intro, and signature on five outgoing client-facing email templates. The point is to let the freelancer's voice come through without forcing them to learn an HTML editor or to maintain a parallel set of templates. Variables resolve at send time so the same body text adapts to each client and project. Defaults from the template files are used when no override is set.

## In Scope (v1)

- Per-template subject and body overrides for five customizable templates: `proposal/sent-to-client`, `invoice/sent-to-client`, `invoice/reminder`, `update/posted`, `client/magic-link`.
- Global per-user `fromName` (defaults to `User.businessName` or `User.name`).
- Global per-user `replyTo` (defaults to `User.email`).
- Global per-user `signatureMd` (markdown signature appended to the body of every customizable template).
- Variable resolution at render time: `{client_name}`, `{client_company}`, `{project_name}`, `{freelancer_name}`, `{invoice_number}`, `{amount_due}`, `{view_link}`, `{valid_until}`, `{date_sent}`.
- Live preview of the rendered email in a `{component.product-mockup-card}` shape next to the form.
- Restoration to default per template ("Reset to default" `{component.button-text-link}`).

## Out of Scope (v1)

- **Full HTML editing.** Cut to v2; subject and body are markdown source.
- **Custom CSS.** Cut to v2.
- **Per-client overrides.** Cut to v2.
- **A/B testing.** Cut to v2; one template per slot.
- **Multi-language template variants.** Cut to v2; English only.
- **Customizing system templates** (`welcome`, `password-reset`, `email-verify`). These are about the freelancer's own account; they are not customizable by intent.
- **Customizing the email layout (header / logo / footer).** Cut to v2; the layout is shared across templates and pulls from `User.businessName` and `User.logoUrl` automatically.

## Data Model

Uses `EmailSettings` (see `docs/architecture/data-model.md`). Relevant columns: `userId` (unique), `fromName`, `replyTo`, `signatureMd`, plus per-template `*Subject` and `*Body` columns:

- `proposalSentSubject`, `proposalSentBody`.
- `invoiceSentSubject`, `invoiceSentBody`.
- `invoiceReminderSubject`, `invoiceReminderBody`.
- `updatePostedSubject`, `updatePostedBody`.
- `magicLinkSubject`, `magicLinkBody` (these two columns are added by this module's migration if not already present in Wave 1's schema).

Null in any column means "use the system default for this slot." There is no stored "default" column; the defaults live in `src/lib/email/templates/defaults.ts`.

## User Flows

### Edit one template

1. From `/(app)/settings/email`, the user clicks a template row (e.g., "Proposal sent to client"). They land on `/(app)/settings/email/[templateKey]`.
2. The page loads with the current overrides (or defaults if null) pre-filled.
3. Form fields:
   - Subject `{component.text-input}`.
   - Body `{component.textarea}` (markdown source).
   - "Variables" hint panel `{component.feature-icon-card}` showing the available variables for this template.
4. A live preview renders to the right (or below on narrow viewports) inside a `{component.product-mockup-card}` showing the rendered email with sample data.
5. Submit calls `updateEmailTemplate`. The action validates input, writes the override columns, and refreshes the preview.

### Reset to default

1. Each form has a `{component.button-text-link}` "Reset to default" next to the field. Clicking sets the field's value to null on submit, which falls back to the template default at send time.

### Edit signature (separate, global)

1. From `/(app)/settings/email`, the signature lives at the top of the page in its own `{component.feature-icon-card}` section. The field is a `{component.textarea}` (markdown). Submit calls `updateEmailSettings`.

### Edit from-name and reply-to

1. Same page, alongside the signature. Submit also calls `updateEmailSettings`.

## UI Surfaces

### `/(app)/settings/email` (handled also by [12-settings](./12-settings.md))

- Section: "Sender" — `{component.text-input}` for `fromName`, `{component.text-input}` for `replyTo`.
- Section: "Signature" — `{component.textarea}` for `signatureMd`. A live preview block below the field shows the rendered signature.
- Section: "Templates" — a list of small `{component.feature-icon-card}` rows, one per customizable template. Each card shows the template's display name (e.g., "Proposal sent to client"), the current subject (truncated to one line), and a `{component.button-text-link}` "Edit" linking to the per-template page.

### `/(app)/settings/email/[templateKey]`

- Header: breadcrumb "Settings → Email → {template name}" in `{typography.caption}` `{colors.muted}`. Page title in `{typography.display-md}`.
- Two-column layout on wide viewports (form left, preview right). One-column on narrow.
- Form column:
  - Subject field with an inline `{component.button-text-link}` "Reset to default."
  - Body field with the same. Markdown is supported; a small `{typography.caption}` hint sits below the field: "Markdown supported. Use {variables} to insert dynamic values."
  - Variables `{component.feature-icon-card}` lists the variables available for this template (the list varies per template). Each variable is a `{component.kbd-key}`-style chip; clicking inserts it into the field at the cursor.
  - Submit `{component.button-primary}` "Save changes."
- Preview column: a `{component.product-mockup-card}` rendering an email-like surface with the freelancer's logo at top, then the resolved subject in `{typography.title-md}`, then the resolved body, then the signature, all using sample fixture data (a fake client, a fake project) so the variables visually resolve. The preview updates on every keystroke after a 200ms debounce.

States: loading (preview placeholder), error (form-level banner), unsaved-changes warning on navigation away.

## Server Actions

| Action                 | Input                                                | Output                                 | Side effects                                                                            |
| ---------------------- | ---------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `updateEmailTemplate`  | `{ templateKey, subject?, body? }`                   | `{ ok: true }`                         | Writes the override columns; null clears. Writes audit `user.email-template-updated`.   |
| `previewEmailTemplate` | `{ templateKey, subject, body }` (uncommitted draft) | `{ ok: true, data: { html: string } }` | Renders the template with sample fixture data and the supplied subject/body. Read-only. |

The `updateEmailSettings` action (covering fromName, replyTo, signatureMd) is in [12-settings](./12-settings.md).

## Repository Functions

In `src/lib/repositories/email-settings.repo.ts`:

- `findByUserId(userId)` — returns the user's `EmailSettings` row or null.
- `upsert(userId, input)` — upserts on `userId`.
- `getEffectiveTemplate(userId, templateKey)` — returns the effective subject and body for the template: the user's override if set, else the system default. Used by the email send pipeline.

## Validation Rules

- **Subject.** 1–150 characters when set. No HTML. Variables (`{var_name}`) are allowed and pass through to render time.
- **Body.** 0–5000 characters; markdown source. Variables allowed. The renderer sanitizes the markdown output before sending (the markdown-to-HTML pipeline goes through a strict allowlist).
- **Signature.** 0–1000 characters; markdown.
- **From-name.** 1–80 characters.
- **Reply-to.** Optional email format.

## Permissions and Tenant Isolation

Standard. The `EmailSettings` table has a unique constraint on `userId`, so each user has at most one row. All reads and writes go through `email-settings.repo.ts` with `userId`. The send pipeline calls `getEffectiveTemplate(userId, templateKey)` which returns either the user's override or the system default; no cross-tenant lookup is possible.

A two-user isolation test asserts: user A's `EmailSettings` updates do not affect user B's row; `getEffectiveTemplate` returns user-specific overrides.

## Audit and Notifications

Audit: `user.email-template-updated` (metadata: `{ templateKey }`). No notifications.

## Emails Sent

This module does not send emails directly; it configures what other modules send. The send pipeline (in `src/lib/email/send.ts` per `docs/architecture/email-system.md`) consults `getEffectiveTemplate` at render time.

## Background Jobs

None.

## Edge Cases and Decisions

- **Variable that does not apply to the current template.** If a body uses `{invoice_number}` in the `update/posted` template (where invoice number is not part of the context), the variable renders as the literal text `{invoice_number}` to avoid silent errors. The variables hint panel only lists the valid variables per template, so the user is unlikely to type unsupported ones.
- **Empty string vs null in a customization column.** Empty string is treated as "use default." Saving an empty subject does not produce an email with no subject; the system default is used.
- **A template default contains a variable the user removed in the override.** The override wins; the variable is not in the rendered subject/body. This is by design; the user controls the content fully.
- **Markdown that includes an HTML tag.** The renderer's allowlist strips disallowed tags. Allowed: `p`, `br`, `strong`, `em`, `a`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`. Stripped: anything else, including `<script>`, `<iframe>`, `<style>`.
- **Subject with a newline character.** Newlines are stripped before the email is sent (the SMTP standard does not allow them).
- **Preview without saving.** The preview action takes the in-flight draft as input and does not persist anything. The user can experiment freely.
- **Reset to default after a save.** Clearing both subject and body and submitting writes nulls; the next send uses the defaults.
- **Restoring after deleting the override columns from the schema (rare).** A migration that removes a customization column would also need to drop the corresponding template detail page; documented as a v2 concern only.

## Definition of Done

- All five customizable templates have detail pages, each with form + live preview.
- The variable hint panels render the right variables per template (asserted by a Vitest test that compares each template's variable list against the renderer's resolver).
- The send pipeline correctly picks up overrides via `getEffectiveTemplate`.
- The reset-to-default flow nulls the columns and the next send uses defaults (covered by a Vitest test).
- A two-user isolation test for `email-settings.repo.ts` covers `findByUserId`, `upsert`, and `getEffectiveTemplate`.
- A Playwright test edits the proposal-sent template, sends a proposal, and asserts the rendered email body contains the customized text and the resolved variables.
- Screenshots of the email settings index page and at least one per-template detail page (with form + preview side by side) captured.
