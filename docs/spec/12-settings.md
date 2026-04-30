# Module 12 — Settings

## Purpose

All user-configurable settings live under `/(app)/settings`, organized into seven sub-pages: Profile, Business, Email, Reminders, Branding, Data, and Account. Each sub-page is a focused form on one concept; there is no kitchen-sink settings page in v1. The settings module is the home of cross-cutting configuration: business identity that flows into invoices and proposals, email customization scaffolding (the actual template editor lives in [15-email-customization](./15-email-customization.md)), the reminder schedule for invoice cron, and the danger-zone account actions.

## In Scope (v1)

- Seven sub-routes under `/(app)/settings`: profile, business, email, reminders, branding, data, account.
- Profile: name, email change (with re-verification), password change, default timezone.
- Business: business name, business address, business tax ID, default currency, payment instructions (markdown).
- Email: from-name, reply-to, signature (markdown), per-template subject and body customization (UI scaffolding; full template detail in [15-email-customization](./15-email-customization.md)).
- Reminders: per-user invoice reminder schedule (`InvoiceReminderConfig`).
- Branding: logo upload, signature image upload (used on signed proposals). The accent color is fixed in v1 and not editable.
- Data: export bundle (JSON), revoke client portal sessions, regenerate all public tokens (one-shot panic action).
- Account: danger zone — request account deletion, cancel account deletion, sign out everywhere.
- Re-run onboarding from Profile.

## Out of Scope (v1)

- **Webhook configuration.** Cut to v2.
- **API keys.** Cut to v2; there is no public API in v1.
- **Third-party integrations (Slack, Discord, Calendar).** Cut to v2.
- **Custom email-sending domain.** Cut to v2; sending is from `noreply@middlemist.app` with the freelancer's name.
- **Billing / subscription.** Cut entirely; the product is free in v1.
- **Per-freelancer accent color.** Cut to v2 (overrides any earlier mention; the Cal.com-aligned visual system locks accent to `{colors.primary}`).
- **Two-factor authentication settings.** Cut to v2.
- **Per-client email override.** Cut to v2.

## Data Model

Uses `User`, `EmailSettings`, `InvoiceReminderConfig`. See `docs/architecture/data-model.md`.

A new column on `User`: `paymentInstructionsMd: String?` (markdown source for the payment instructions block on invoices). Added by this module's migration if not already present.

## User Flows

### Profile sub-page

1. User navigates to `/(app)/settings/profile`. Form pre-filled with current values.
2. Editable: `name`, `defaultTimezone` (`{component.select}` from IANA list).
3. Email change has its own section: a `{component.text-input}` for new email + `{component.button-primary}` "Verify and change." Calls `requestEmailChange`.
4. Password change has its own section: current password, new password, confirm new password. Calls `changePassword`.
5. "Run onboarding again" `{component.button-secondary}` resets `User.onboardingDoneAt` and routes to `/onboarding`.

### Business sub-page

1. `/(app)/settings/business`. Form fields: `businessName`, `businessAddress` (multi-line `{component.textarea}`), `businessTaxId`, `defaultCurrency` (`{component.select}` from supported set), `paymentInstructionsMd` (`{component.textarea}` rendering markdown).
2. Submit calls `updateBusiness`. Writes audit `user.business-updated` (combined audit row, not per-field).

### Email sub-page

1. `/(app)/settings/email`. From-name, reply-to, signature (markdown).
2. Per-template customization: a list of customizable templates (proposal-sent, invoice-sent, invoice-reminder, update-posted, magic-link). Each template row links to its detail page (handled by [15-email-customization](./15-email-customization.md)).
3. Submit calls `updateEmailSettings`.

### Reminders sub-page

1. `/(app)/settings/reminders`. Two arrays of integers: `daysBeforeDue` (default `[3]`), `daysAfterDue` (default `[1, 7, 14]`). Toggle `isEnabled` for the whole reminder system.
2. UI: each array is a chip-row of integer pills with an inline "Add day" `{component.button-text-link}`; clicking a pill removes it. A `{component.toggle-switch}` at the top controls `isEnabled`.
3. Submit calls `updateReminderConfig`.

### Branding sub-page

1. `/(app)/settings/branding`. Two `{component.file-upload-zone}` zones: one for logo (PNG/JPG/SVG, max 2 MB, max 2000x2000), one for signature image (PNG/JPG, max 1 MB, max 800x300).
2. Each upload immediately writes the URL to the user. Removal clears the URL and triggers the orphaned-files job to clean up.
3. A note in `{typography.body-md}` `{colors.muted}`: "Accent color is fixed at near-black to keep the visual system consistent across all surfaces. Per-freelancer accents are not configurable in v1."

### Data sub-page

1. `/(app)/settings/data`. Three actions:
   - **Export data** `{component.button-secondary}`: triggers `exportData` action which assembles a JSON bundle and emails it as an attachment to the user. The bundle includes all owned rows (clients, projects, tasks, time entries, updates, proposals, invoices) with sensitive fields redacted (no `passwordHash`, no public tokens beyond what the user already has).
   - **Revoke all client portal sessions** `{component.button-secondary}` (with confirm `{component.modal}`): sets `sessionExpiresAt = now` on every `ClientPortalSession` for the user. Active client sessions are logged out on next request.
   - **Regenerate all public tokens** (panic action) `{component.button-danger}` (with strong confirm `{component.modal}`): regenerates `Project.publicToken`, `Proposal.publicToken`, and `Invoice.publicToken` in a single transaction. All currently shared URLs stop working.

### Account sub-page (danger zone)

1. `/(app)/settings/account`. Two actions:
   - **Sign out everywhere** `{component.button-secondary}`: invalidates all sessions for the user (rotates `auth_invalidated_at` so existing cookies fail).
   - **Delete account** `{component.button-danger}` (with strong confirm modal): calls `requestAccountDeletion`. See [01-auth-and-account](./01-auth-and-account.md).
2. If `User.deletedAt` is set, this section instead shows "Pending deletion" with a `{component.button-secondary}` "Cancel deletion" calling `cancelAccountDeletion`.

## UI Surfaces

### Settings shell

- App shell + a settings-specific layout: a left sub-nav (210px wide) using `{component.app-sidebar}`-shape items (active item style with `{colors.primary}` left bar and bold `{typography.body-md}`; inactive items in `{colors.muted}`).
- Right side: max-width 720px content area on `{colors.canvas}`.
- The settings layout is a Next.js layout (`/settings/layout.tsx`) shared across the seven sub-routes.

Each sub-page renders one or more `{component.feature-icon-card}` sections. Section headers in `{typography.title-md}`. Field labels in `{typography.caption}` `{colors.muted}` (uppercase, sentence-case alternative acceptable). Fields in their respective design components. Each section ends with a `{component.button-primary}` "Save" right-aligned at the section's bottom.

### Sub-page-specific components

- **Reminders chip-row.** Custom composite using `{component.badge-pill}` shapes; clicking removes; an inline `{component.button-text-link}` adds. The "Add day" prompts a small `{component.text-input}` for the integer.
- **Branding upload zones.** `{component.file-upload-zone}` with previews (avatar shape for logo, narrow image for signature).
- **Per-template list.** A list of small `{component.feature-icon-card}` rows on the email settings page, each linking to `/(app)/settings/email/[templateKey]` (per [15-email-customization](./15-email-customization.md)).

States: each form has form-level error banners and field-level error captions, the same patterns used throughout the app.

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `updateProfile` | `updateProfileSchema` (name, defaultTimezone) | `{ ok: true, data: User }` | Updates user. |
| `requestEmailChange` | `{ newEmail }` | `{ ok: true }` | Sends verify email to new address. (Detail in [01-auth-and-account](./01-auth-and-account.md).) |
| `verifyEmailChange` | `{ token }` | `{ ok: true }` | Applies email change. |
| `changePassword` | `{ currentPassword, newPassword }` | `{ ok: true }` | Verifies current; updates hash; invalidates other sessions. |
| `updateBusiness` | `updateBusinessSchema` | `{ ok: true, data: User }` | Updates business fields. |
| `updateEmailSettings` | `updateEmailSettingsSchema` (from-name, reply-to, signature) | `{ ok: true, data: EmailSettings }` | Upserts `EmailSettings`. |
| `updateEmailTemplate` | `updateEmailTemplateSchema` (templateKey, subject, body) | `{ ok: true }` | Per-template overrides. (Detail in [15-email-customization](./15-email-customization.md).) |
| `updateReminderConfig` | `{ isEnabled, daysBeforeDue, daysAfterDue }` | `{ ok: true, data: InvoiceReminderConfig }` | Upserts reminder config. |
| `updateBranding` | `updateBrandingSchema` (logoUrl, signatureUrl) | `{ ok: true }` | Updates `User.logoUrl`, `User.signatureUrl`. |
| `revokeAllPortalSessions` | `{}` | `{ ok: true, data: { revoked: number } }` | Sets `sessionExpiresAt = now` on all sessions for user. |
| `regenerateAllPublicTokens` | `{}` | `{ ok: true, data: { projects, proposals, invoices } }` | New nanoid for every owned public token in a transaction. Writes audit `user.tokens-regenerated`. |
| `signOutEverywhere` | `{}` | `{ ok: true }` | Rotates session secret for the user; current session is also invalidated. |
| `exportData` | `{}` | `{ ok: true }` | Assembles JSON bundle; emails to user. Rate-limited 3/hour per user. |
| `requestAccountDeletion` / `cancelAccountDeletion` | covered in [01-auth-and-account](./01-auth-and-account.md). |

## Repository Functions

The settings module re-uses repos from other modules:

- `users.repo.ts`: `update`, `setPaymentInstructions`, `setLogo`, `setSignature`, `regenerateAllTokens` (transaction-aware).
- `email-settings.repo.ts`: `findByUserId`, `upsert`.
- `invoice-reminder-config.repo.ts`: `findByUserId`, `upsert`.
- `client-portal-sessions.repo.ts`: `expireAllForUser`.

The `regenerateAllTokens` function is a single Prisma transaction that iterates the three tables and updates `publicToken` per row. Returns the count per type.

## Validation Rules

- **Name.** 1–80 characters.
- **Default timezone.** Validated against `Intl.supportedValuesOf("timeZone")`.
- **Default currency.** Supported set.
- **Business name / address / tax ID.** As in [01-auth-and-account](./01-auth-and-account.md).
- **Payment instructions.** 0–4000 characters; markdown.
- **From-name.** 1–80 characters.
- **Reply-to.** Optional email format.
- **Signature.** 0–1000 characters; markdown.
- **Reminder days arrays.** Integers between 1 and 60. Max 5 entries each. No duplicates.
- **Logo upload.** PNG/JPG/SVG; max 2 MB; max 2000x2000.
- **Signature image upload.** PNG/JPG; max 1 MB; max 800x300.

## Permissions and Tenant Isolation

Standard. Every action is `withAuth`-wrapped; every read is keyed by `userId`. The settings sub-routes all sit under `/(app)/settings` so middleware applies the auth gate.

A two-user isolation test for each repository function used here. The `regenerateAllTokens` function in particular: the transaction must only touch rows where `userId = caller`; an isolation test inserts data for users A and B, runs the action for A, and asserts B's tokens are unchanged.

## Audit and Notifications

Audit actions: `user.profile-updated`, `user.business-updated`, `user.email-settings-updated`, `user.reminder-config-updated`, `user.branding-updated`, `user.tokens-regenerated`, `user.signed-out-everywhere`, `user.exported-data`, `user.password-changed` (already in 01), `user.email-changed` (already in 01), `user.account-deletion-requested` (already in 01), `user.account-deletion-cancelled` (already in 01).

No in-app notifications fire from settings actions.

## Emails Sent

- `email-verify.tsx` on email change.
- The data-export bundle is sent as an attachment via `sendEmail` from a route handler that assembles the JSON. Rate-limited.

## Background Jobs

- The export bundle is assembled in an Inngest function `user.export-data` (event-driven) so the action returns quickly while the assembly + email happen in the background. The action emits the event and returns `{ ok: true }` immediately; the user receives the email when the job completes.

## Edge Cases and Decisions

- **Email change to the same address.** No-op; the action returns success without sending another verify email.
- **Email change to an address already in use by another user.** Refused with `EMAIL_TAKEN`.
- **Reminder config with `isEnabled = false`.** The reminder cron skips the user entirely. Re-enabling resumes from the next eligible day per the schedule.
- **Reminder days = empty arrays.** Equivalent to `isEnabled = false` in practice; the cron has nothing to fire on. Allowed but the UI surfaces a hint.
- **Logo upload of an unsupported MIME type.** UploadThing rejects at the upload boundary; the form surfaces the error.
- **`regenerateAllTokens` with thousands of rows.** A single transaction at v1 scale is fine. A future ADR may switch to chunked batches if a user's row count exceeds a threshold.
- **`signOutEverywhere` invalidates the current session.** Yes; the user is redirected to `/login` immediately. The action returns success but the next request fails the cookie check.
- **Editing the signature image while a proposal has been signed already.** The signed proposal's `acceptanceSignatureName` is the legal record; the rendered signature image is decorative and historical. Updating the user's signature image does not retroactively change any rendered PDFs (PDFs are regenerated on demand from the current signature URL; rendered-and-saved PDFs would be stale, but v1 does not store rendered PDFs).
- **Rate-limit on data export.** 3/hour per user. The action returns `RATE_LIMITED` if exceeded; the form surfaces a "try again in N minutes" message.

## Definition of Done

- All seven sub-routes implemented with the right form fields and validation.
- Settings layout shared across sub-routes with the active sub-nav item correctly highlighted.
- All settings server actions typed end-to-end and covered by validation tests.
- Two-user isolation tests for `regenerateAllTokens`, `revokeAllPortalSessions`, and the user-scoped upserts.
- The export-data Inngest job is unit-tested with a fixture user; the bundle JSON shape is asserted.
- A Playwright e2e test exercises a settings change (e.g., update business name), reload the page, and assert the new value persists.
- A second Playwright test runs the regenerate-all-tokens action and asserts that previously-stored proposal/invoice URLs return the "no longer available" page.
- Screenshots of each sub-page captured.
