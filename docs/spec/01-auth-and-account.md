# Module 01 — Auth and Account

## Purpose

The freelancer's gate to the product. Email-and-password authentication, email verification before any data is created, password reset by emailed token, profile editing, password change, email change with re-verification, and account deletion with a 30-day grace period and a JSON export bundle. There is no OAuth, no magic-link login for the freelancer, and no two-factor authentication in v1. This module is the first thing built because nothing else is exercisable without it.

## In Scope (v1)

- Sign up with email and password.
- Email verification by single-use token, 24-hour expiry.
- Login with email and password (verification gate refuses unverified accounts).
- Forgot-password flow: request a reset, redeem the token, set a new password, invalidate all sessions.
- Account profile (name, business name, business address, business tax ID, logo, signature image, default currency, default timezone).
- Password change from settings (requires current password).
- Email change from settings: enter new email, verify by token, only then is the change applied.
- Account deletion: soft-delete with a 30-day grace, scheduled hard-delete, JSON export bundle emailed at request time, cancelable during the grace period.

## Out of Scope (v1)

- **Two-factor authentication.** Cut to v2 because solo accounts on a portfolio product do not have the threat model that justifies the friction.
- **OAuth (Google, GitHub).** Cut to v2 to avoid the per-provider configuration and brand-policy review for a portfolio launch.
- **Magic-link login for the freelancer.** Cut to v2; clients use magic links, freelancers use a real password.
- **Multi-user team accounts.** Cut entirely (`docs/product/v2-wishlist.md`); the data model has no concept of teammates.
- **Session management UI.** Cut to v2; sessions are one-per-account in v1.
- **Login-throttling lockout UI.** Coarse rate limits exist (Upstash) but there is no per-account lockout view.

## Data Model

Uses `User` (see `docs/architecture/data-model.md`). Relevant columns: `id`, `email`, `emailVerifiedAt`, `passwordHash`, `name`, `businessName`, `businessAddress`, `businessTaxId`, `logoUrl`, `signatureUrl`, `defaultCurrency`, `defaultTimezone`, `onboardingDoneAt`, `deletedAt`. No new tables for v1 verification/reset tokens; tokens are signed payloads (JWT-shaped) rather than stored rows.

## User Flows

### Sign up

1. User opens `/signup`. Form requests email, password, name.
2. User submits. The `signup` server action validates the input, hashes the password (bcrypt cost 12), creates the `User` row, and emits the `user.signup` Inngest event.
3. The Inngest handler sends the `email-verify` email with a signed token (24-hour expiry, single-use).
4. The action returns success and the page renders a "check your email" view (`{component.empty-state-card}` shape, `{typography.display-md}` heading, `{typography.body-md}` instructions).
5. User clicks the link in the email. The route handler at `/verify-email/[token]` validates the token, sets `User.emailVerifiedAt = now`, and redirects to `/onboarding`.
6. **Error path (token expired):** the page renders an "expired" state with a `{component.button-primary}` to request a new verification email. Clicking calls `requestEmailVerification`, which checks rate limits, re-issues a new token, and emails it.

### Login

1. User opens `/login`. Form requests email and password.
2. User submits. The `login` server action looks up the user, verifies the password against `passwordHash`, and (if `emailVerifiedAt` is null) returns `{ ok: false, error: "EMAIL_NOT_VERIFIED" }`. The page surfaces the error and offers to resend the verification email.
3. On success, the action issues an Auth.js session cookie (JWT, 30-day rolling expiry) and redirects to `/dashboard` (or `/onboarding` if `User.onboardingDoneAt` is null).
4. **Error path (wrong password):** the action returns `{ ok: false, error: "INVALID_CREDENTIALS" }` without distinguishing wrong-email from wrong-password. The page surfaces a generic "incorrect email or password" message. After three failures from the same IP within five minutes, the rate limiter returns 429 and the page surfaces a "too many attempts" message.

### Forgot password

1. User opens `/forgot-password`, enters email, submits. The `requestPasswordReset` action always returns success regardless of whether the email exists (no enumeration). If the email matches a user, a signed reset token (1-hour expiry, single-use) is issued and emailed via the `password-reset` template.
2. User clicks the link to `/reset-password/[token]`. The page validates the token's signature and expiry on the server.
3. User enters a new password and submits. The `resetPassword` action verifies the token again, updates `passwordHash`, invalidates all existing sessions for the user (rotates the session secret or marks an `auth_invalidated_at` timestamp checked on every session lookup), and redirects to `/login`.
4. **Error path (token reused or expired):** the page renders an "expired" state with a link back to `/forgot-password`.

### Account deletion

1. User opens `/(app)/settings/account`, scrolls to the Delete Account section, and clicks the danger button (`{component.button-danger}`). A `{component.modal}` confirms.
2. The `requestAccountDeletion` action sets `User.deletedAt = now + 30 days` (the scheduled hard-delete date), emits `user.deletion-requested`, and emails the user a JSON export bundle. The next login warns the user that the account is scheduled for deletion and offers to cancel.
3. User can cancel during the grace period via `cancelAccountDeletion`, which clears `deletedAt`.
4. After 30 days, the `users.hard-delete` Inngest cron processes any user whose `deletedAt` is in the past and cascades the delete (Prisma cascades remove all per-tenant rows).

### Profile and password change

1. User opens `/(app)/settings/profile` or `/(app)/settings/account`. Profile fields render in a single column inside a `{component.feature-icon-card}` section. Change-password fields render in a separate section requiring the current password before the new password is accepted.
2. Submit calls `updateProfile` or `changePassword`. The latter verifies the current password before hashing and storing the new one, then invalidates all sessions other than the current one.

## UI Surfaces

All auth pages share a centered narrow column (max-width 400px), `{colors.canvas}` background, the wordmark at the top in `{typography.title-lg}`, the page heading in `{typography.display-md}`, supporting copy in `{typography.body-md}` `{colors.body}`. Form fields use `{component.text-input}` (full width on auth pages). Primary action is `{component.button-primary}` (full width). Bottom of every auth page: `{component.button-text-link}` for the alternate flow ("Already have an account? Sign in"). Footer is `{component.footer}` (dark surface) on auth pages.

| Route | Access | Key elements |
|---|---|---|
| `/signup` | Public | Email, password, name fields; submit; link to login. Empty state on success ("check your email"). |
| `/login` | Public | Email, password; submit; link to signup; link to forgot password. Surfaces "verify email" prompt if applicable. |
| `/verify-email/[token]` | Public | Server-validated landing; redirects to onboarding on success; "expired" state with resend button on failure. |
| `/forgot-password` | Public | Email field; always returns success view to prevent enumeration. |
| `/reset-password/[token]` | Public | New password and confirm fields; submit redirects to login. "Expired" state on invalid token. |
| `/(app)/settings/account` | Authenticated | Profile section, password change section, email change section, danger zone (delete account). |

States to handle:

- **Loading.** Submit buttons disable and show a spinner via `{component.button-primary[loading]}`.
- **Error.** Form-level errors render in a `{component.alert-banner}` above the form. Field-level errors render under the input in `{typography.caption}` `{colors.error}`.
- **Email verification gate.** The login page surfaces a "verify your email to continue" `{component.alert-banner}` with a resend `{component.button-text-link}`.
- **Pending deletion.** The dashboard top of every page renders a `{component.alert-banner}` (warning tone) when `User.deletedAt` is set, with a "cancel deletion" `{component.button-secondary}`.

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `signup` | `signupSchema` (email, password, name) | `{ ok: true, data: { id } }` | Creates `User`; emits `user.signup`; sends verify email; writes `user.signup` audit. |
| `requestEmailVerification` | `{ email }` | `{ ok: true }` | Re-issues verification token; sends verify email. Rate-limited 5/hour per email. |
| `verifyEmail` | `{ token }` | `{ ok: true }` | Sets `emailVerifiedAt`; redirects to onboarding. |
| `login` | `loginSchema` (email, password) | `{ ok: true, data: { sessionExpiresAt } }` | Issues session cookie; writes `user.login` audit. |
| `requestPasswordReset` | `{ email }` | `{ ok: true }` | Issues reset token if user exists; sends `password-reset` email. Always returns success. Rate-limited 5/hour per email. |
| `resetPassword` | `{ token, newPassword }` | `{ ok: true }` | Updates `passwordHash`; invalidates all sessions; writes `user.password-changed` audit. |
| `updateProfile` | `updateProfileSchema` | `{ ok: true, data: User }` | Updates non-credential fields. |
| `changePassword` | `{ currentPassword, newPassword }` | `{ ok: true }` | Verifies current password; updates hash; invalidates sessions other than current; writes audit. |
| `requestEmailChange` | `{ newEmail }` | `{ ok: true }` | Sends verify email to new address; does not change email yet. |
| `verifyEmailChange` | `{ token }` | `{ ok: true }` | Updates `User.email`; writes `user.email-changed` audit; invalidates sessions. |
| `requestAccountDeletion` | `{}` | `{ ok: true, data: { deletedAt } }` | Sets `User.deletedAt = now + 30 days`; emails JSON export; writes audit. |
| `cancelAccountDeletion` | `{}` | `{ ok: true }` | Clears `User.deletedAt`. |

## Repository Functions

In `src/lib/repositories/users.repo.ts`:

- `findById(id: string)` — non-tenant lookup; used by session resolver.
- `findByEmail(email: string)` — case-insensitive lookup; used by login and password reset.
- `create(input)` — signup path; sets `passwordHash` and default fields.
- `update(userId, input)` — profile updates; tenancy by self.
- `setPasswordHash(userId, hash)` — password change and reset.
- `setEmailVerifiedAt(userId, at)` — verification flow.
- `setEmail(userId, newEmail)` — email change (after verification).
- `markDeleted(userId, deletedAt)` — schedule hard-delete.
- `clearDeleted(userId)` — cancel deletion.

The Auth.js adapter is the only place outside `users.repo.ts` that touches `User` rows directly; it goes through `auth-adapter.ts` which delegates to the repo.

## Validation Rules

- **Email.** Standard format check; lower-cased and trimmed before insert. Must be unique.
- **Password.** Minimum 12 characters. No maximum (bcrypt truncates above 72 bytes; the form discloses the limit). Common-password blocklist via a static list in `src/lib/auth/common-passwords.ts` (top 1000). Reject if blocklisted.
- **Name.** 1–80 characters, trimmed.
- **Business name.** 0–120 characters.
- **Business address.** 0–500 characters; multi-line allowed.
- **Business tax ID.** 0–50 characters; format-agnostic.
- **Default currency.** ISO-4217 from the supported set (PHP, USD, EUR, GBP, AUD, CAD).
- **Default timezone.** IANA timezone string; validated against `Intl.supportedValuesOf("timeZone")`.

## Permissions and Tenant Isolation

The User table is the root of the multi-tenant tree. Every authenticated session resolves a `userId` and that value flows through `withAuth` into every action. The `users.repo.ts` functions that take a userId verify the row belongs to that userId (which is trivially true because the user is itself); functions that look up by email or by token are not tenant-scoped because they are part of the auth flow.

The verification, reset, and email-change tokens are signed JWT-shape payloads (alg `HS256`, secret from `env.AUTH_SECRET`) rather than database rows. The signature is the access proof; expiry is enforced. Single-use is enforced by including a `User.passwordHash` digest fragment in the password-reset token's payload — once the password changes, prior reset tokens fail signature comparison and cannot be reused.

## Audit and Notifications

Audit actions written: `user.signup`, `user.login`, `user.password-changed`, `user.email-changed`, `user.account-deleted`, `user.account-deletion-cancelled`. None of these surface in the in-app notification feed (no notifications about your own account actions). All include `ip` and `userAgent`.

## Emails Sent

- `welcome.tsx` on `user.signup`.
- `email-verify.tsx` on signup, on email change, and on `requestEmailVerification`.
- `password-reset.tsx` on `requestPasswordReset`.
- A JSON export attachment is sent on `requestAccountDeletion` (template TBD; uses the same `sendEmail` helper).

## Background Jobs

- `user.signup` event fires `send-welcome-email` and `send-verify-email` Inngest functions.
- `users.hard-delete` cron (daily 03:00 UTC) processes users whose `deletedAt` is in the past.

## Edge Cases and Decisions

- **Two users sign up with the same email simultaneously.** The unique constraint on `User.email` causes the second insert to fail with `P2002`; the action returns `{ ok: false, error: "EMAIL_TAKEN" }`. The form surfaces the message.
- **A user verifies an already-verified email.** Idempotent: `setEmailVerifiedAt` is a no-op if already set. The page still redirects to onboarding/dashboard.
- **A user requests password reset twice in quick succession.** Each request issues a fresh token; the older token still validates until its 1-hour expiry. The user can use either; using one does not invalidate the other (single-use is enforced by the password-hash digest fragment, not by tracking issued tokens).
- **A user deletes their account, then signs up with the same email during the grace period.** Refused: the `User` row still exists with `deletedAt` set. The signup action returns `EMAIL_TAKEN`. The user can cancel deletion if they have access to their old account, or wait for hard-delete.
- **Session cookie present after server-side invalidation.** The session resolver checks `User.deletedAt` and an `auth_invalidated_at` field on every request and revokes the cookie if either condition is set after the cookie's issuance time.

## Definition of Done

- All seven server-action paths above implemented and typed end-to-end.
- All validation rules enforced via zod schemas in `src/lib/schemas/auth.schema.ts` shared with client forms.
- `users.repo.ts` written and covered by a two-user isolation test (the test asserts `findByEmail` does not return another user's row when emails differ by case or whitespace, and that `setPasswordHash` for one user does not affect another).
- `password-reset.tsx`, `email-verify.tsx`, and `welcome.tsx` email templates rendered, snapshot-tested, and visible in the React Email preview server.
- `signup-to-onboarding` and `forgot-password-to-reset` Playwright e2e flows green.
- Account deletion grace period exercised in a Vitest test that mocks the cron clock and asserts hard-delete fires after 30 days.
- Screenshots captured of `/signup`, `/login`, `/forgot-password`, and `/(app)/settings/account` for the case study folder.
