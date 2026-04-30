# Module 02 — Onboarding

## Purpose

A skippable, four-step walkthrough that runs after a user signs up, verifies their email, and lands in the app for the first time. The point is not to teach the product; the point is to make the empty app feel intentional. By the end of onboarding the user has set their business name, optionally uploaded a logo, confirmed a default currency, and optionally created their first client. Each step is centered, narrow, and quiet. None of the steps is required to use the product, and any step can be re-entered later from settings.

## In Scope (v1)

- Trigger detection: a user with no `businessName` and no clients lands on `/onboarding` after sign-in instead of `/dashboard`.
- Four steps: business name, logo upload, default currency, first client.
- A step indicator that shows progress.
- Per-step skip option (advances to the next step without saving the current one).
- Final step marks `User.onboardingDoneAt` and redirects to the dashboard.
- Re-entry from settings via a "Run onboarding again" link.
- Skipped-step reminders on the dashboard for the first 7 days after onboarding completion.

## Out of Scope (v1)

- **Import from other tools.** Cut to v2 because the import surface (CSV from Wave, Notion exports, etc.) is large and would slow shipping.
- **Sample-data option.** Cut because the dashboard's empty state already does this job once the user has dismissed onboarding.
- **Video walkthrough.** Cut to v2 (and the product principles cut video entirely from v1).
- **Multi-user invitations.** Cut entirely; the data model has no concept of teammates.
- **Tour overlays inside the main app surfaces.** Cut to v2; the onboarding flow is its own route, not a series of popovers on top of the dashboard.

## Data Model

Uses `User` (`businessName`, `logoUrl`, `defaultCurrency`, `onboardingDoneAt`) and `Client` (created on the fourth step if the user does not skip it). See `docs/architecture/data-model.md`.

## User Flows

### Happy path

1. After email verification, the user is redirected to `/onboarding`.
2. Step 1: business name. The user enters a business name (or skips). Submit calls `updateBusinessProfile` with the new value and routes to step 2.
3. Step 2: logo. The user uploads a logo via `{component.file-upload-zone}` (UploadThing context `branding`). Submit (or skip) routes to step 3.
4. Step 3: default currency. The user picks one of the six supported currencies. Default is PHP (the primary user's home currency). Submit calls `updateBusinessProfile` and routes to step 4.
5. Step 4: first client. The user fills in name, company, email, and (optional) currency. Submit calls `createClient`. Skip routes to the completion handler.
6. Completion handler: the `completeOnboarding` action sets `User.onboardingDoneAt = now`, redirects to `/dashboard`. The first-time dashboard renders an `{component.alert-banner}` for any skipped step ("You haven't uploaded a logo yet — add one in settings").

### Skip path

1. From any step, clicking the secondary `{component.button-text-link}` "Skip for now" advances without saving the current step's input.
2. If the user reaches step 4 having skipped every prior step, completion still fires; the app records the skipped state and surfaces gentle reminders on the dashboard.

### Re-entry path

1. From `/(app)/settings/profile`, a "Run onboarding again" `{component.button-secondary}` resets `User.onboardingDoneAt` to null and routes to `/onboarding`.
2. The walkthrough re-runs from step 1 with the user's current values pre-filled. Completing it again sets `onboardingDoneAt` again.

### Error path: upload fails on step 2

1. The user picks a logo file. UploadThing rejects it (size or MIME type) and returns an error.
2. The `{component.file-upload-zone}` surfaces the error inline in `{typography.caption}` `{colors.error}`.
3. The user can retry, pick a different file, or skip.

## UI Surfaces

A single route, `/onboarding`, with internal step state (URL params `?step=1..4`). Layout: full-page `{colors.canvas}`, no sidebar, no top nav. A wordmark sits top-left. A `{component.button-text-link}` "Sign out" sits top-right.

The active step renders as a centered `{component.feature-card}` with max-width 480px, padding `{spacing.xl}`, `{rounded.lg}`, hairline border. Above the card sits a `{component.nav-pill-group}` rendering "1 of 4" / "2 of 4" / "3 of 4" / "4 of 4" with the current step active.

Each step's card content:

- **Heading** in `{typography.display-md}`. ("Welcome — what's your business name?")
- **Supporting copy** in `{typography.body-md}` `{colors.body}` (one or two short sentences on what this step is for).
- **Form field(s)** using `{component.text-input}`, `{component.select}`, or `{component.file-upload-zone}` as appropriate.
- **Primary action** `{component.button-primary}` ("Continue") — full width on the card.
- **Secondary action** `{component.button-text-link}` ("Skip for now") — centered below the primary.

The footer is `{component.footer}` (dark surface) on the onboarding route as well, so the page closes the same way every page in the product closes.

States:

- **Loading** (server action in flight): primary button uses the loading variant.
- **Error**: form-level errors render in a `{component.alert-banner}` above the form fields.
- **Empty step (skip)**: the route handler treats skipping the same as submitting an empty payload, which the action layer accepts for partial fields.

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `updateBusinessProfile` | Subset of `User` (businessName, logoUrl, defaultCurrency, etc.) | `{ ok: true, data: User }` | Updates `User`. |
| `completeOnboarding` | `{}` | `{ ok: true }` | Sets `User.onboardingDoneAt = now`; writes audit `user.onboarding-completed`. |

`createClient` (from the Clients module) is reused for step 4 rather than introducing an onboarding-specific create.

## Repository Functions

No new repository functions for this module beyond what `users.repo.ts` and `clients.repo.ts` already provide. The onboarding action layer composes existing repo calls. See [01-auth-and-account](./01-auth-and-account.md) and [03-clients](./03-clients.md) for those.

## Validation Rules

- **Business name.** Optional in onboarding (the user can skip); 1–120 characters when present.
- **Logo upload.** PNG, JPG, or SVG; max 2 MB; max dimensions 2000x2000. Validated in the UploadThing config and re-validated server-side on the URL fetch.
- **Default currency.** Required at the schema level for the User row (so a default is always present); onboarding pre-fills PHP and the user can change it.
- **First client.** Reuses `createClientSchema`. Email is required; everything else is optional.

## Permissions and Tenant Isolation

Onboarding runs only when the user is authenticated. All actions tenant-scope to the calling user via `withAuth`. There is no cross-user concern in this module beyond the standard isolation that the underlying repos enforce.

## Audit and Notifications

Audit actions written:

- `user.onboarding-completed` on `completeOnboarding`.
- `client.created` on the first-client step (from the Clients module's normal flow).
- Profile updates do not write a separate audit entry per field; the User update inside onboarding is treated as a single profile edit.

No notifications fire from onboarding events.

## Emails Sent

None directly from this module. The welcome email is sent on signup (`docs/spec/01-auth-and-account.md`); onboarding does not duplicate it.

## Background Jobs

None. All onboarding writes are synchronous server actions.

## Edge Cases and Decisions

- **User reloads the page mid-onboarding.** The step is encoded in the URL, so a reload returns the user to the same step. Server-side state is whatever the user has saved so far.
- **User completes onboarding, then deletes their first client.** The dashboard's "skipped step" reminders do not re-appear; the reminders trigger only on the original completion state. This is intentional: re-prompting after an explicit delete would feel naggy.
- **User signs up, abandons onboarding for weeks, returns.** They land on `/dashboard` if they had completed onboarding, or `/onboarding` if not. There is no expiry on a half-finished onboarding state.
- **Logo upload succeeds but the URL fetch on save fails.** The action returns an error; the upload is left in UploadThing storage and is cleaned up by the orphaned-files job (see `docs/architecture/file-uploads.md`).
- **The user wants to skip every step and reach the dashboard.** Allowed. Each step's skip action advances; the completion handler still fires on step 4. The dashboard surfaces the skipped-step reminders.

## Definition of Done

- The four onboarding steps render with the correct components from the design system.
- The `completeOnboarding` action sets `onboardingDoneAt` and redirects to the dashboard.
- A user with `onboardingDoneAt` set is never routed to `/onboarding` automatically; only the manual "Run onboarding again" path is allowed.
- The skipped-step reminders surface on the dashboard for the first 7 days after completion.
- A Vitest integration test asserts that the four-step flow with all skips produces a user with `onboardingDoneAt` set and no other writes besides the audit row.
- A Playwright test runs the full happy-path onboarding from sign-in through completion and verifies the dashboard loads.
- Screenshots of all four steps captured for the case study folder.
