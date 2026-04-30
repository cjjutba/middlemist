# Data protection

Middlemist holds personally identifiable information (PII) in five entity classes plus the audit log. This document inventories what is stored, how it is encrypted, how it is retained, and how the user can export or delete it. The product is designed for a single-freelancer tenant model, so most operational decisions weight the freelancer's autonomy ("export everything I own," "delete my account on demand") over the third-party data controller responsibilities of larger platforms.

## PII inventory

| Entity                | Field                                                                                                                                                             | Why stored                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `User`                | `email`                                                                                                                                                           | Account identifier and Reply-To on outbound mail.                                                      |
| `User`                | `name`, `businessName`, `businessAddress`, `businessTaxId`                                                                                                        | Rendered on proposals and invoices. The address and tax id are required for compliant invoice records. |
| `User`                | `passwordHash`, `passwordVersion`                                                                                                                                 | Authentication. Never the plaintext password.                                                          |
| `User`                | `logoUrl`, `signatureUrl`                                                                                                                                         | Brand mark and typed signature for proposals.                                                          |
| `Client`              | `name`, `companyName`, `email`, `phone`, `address`, `taxId`                                                                                                       | Recipient details for proposals, invoices, portal magic links.                                         |
| `Proposal`            | `acceptedByName`, `acceptedByEmail`, `acceptedByIp`                                                                                                               | Captured at the moment of acceptance to make the agreement evidentiary.                                |
| `Invoice`             | (no separate PII columns; the bill-to copy is denormalized from `Client` fields when issued so the invoice is self-consistent if the client record changes later) | Audit trail and historical accuracy.                                                                   |
| `ClientPortalSession` | `clientId`, `ip`, `userAgent`                                                                                                                                     | Magic-link binding and audit on redemption.                                                            |
| `AuditLog`            | `userId`, `ip`, `userAgent`, `metadata`                                                                                                                           | Provenance and incident response.                                                                      |

Two values that look like they should be in the inventory and are _not_:

- **Plaintext passwords.** Never stored. Bcrypt hash is the only persistence.
- **Plaintext magic-link tokens.** Never stored. Sha256 hash on `ClientPortalSession.tokenHash`.

## Encryption

**At rest.** Neon encrypts data at rest in the underlying object store (AES-256). Backups inherit the encryption (see `docs/ops/backups.md`). UploadThing encrypts files at rest in their backing R2 bucket. Application-layer field encryption is not used in v1; the threat model does not justify the operational complexity (key management, search ergonomics, migration cost). v2 may introduce field-level encryption for the most sensitive columns (`User.businessTaxId`, `Client.taxId`, `Proposal.acceptedByIp`) once a clearer threat profile emerges from real usage.

**In transit.** TLS at every boundary: the browser to Vercel, Vercel to Neon (Neon enforces TLS), Vercel to Resend, Vercel to UploadThing, Vercel to Inngest, Vercel to Upstash, Vercel to Sentry, Vercel to Plausible. There is no path that crosses the public internet without TLS.

**Cookies.** httpOnly + secure + sameSite=lax. The session JWT is signed with `AUTH_SECRET` (HS256). A tampered cookie fails the signature check; a stolen cookie is bound to the original device's browser only by the browser's same-site policy.

## Backups

PITR through Neon (free tier 7 days, paid tiers up to 30) plus a weekly off-platform `pg_dump` to Cloudflare R2 retained for 12 weeks. Full details in `docs/ops/backups.md`. The backups inherit the encryption posture of their source.

## Deletion

User-initiated deletion runs through a soft-delete + grace-period flow.

1. **Request.** From settings, the user clicks "Delete account." The action sets `User.deletedAt = now`, prepares a JSON export bundle, emits the `user.deletion-requested` Inngest event, and writes audit `user.account-deleted`.
2. **Grace period.** Thirty days. During this window, every login attempt redirects to a "your account is scheduled for deletion; restore?" page with a button to cancel. Cancelling clears `deletedAt` and writes audit `user.deletion-cancelled`.
3. **Hard delete.** A daily cron (`users.purge-deleted`) processes accounts with `deletedAt < now - 30 days`. It runs the cascade:
   - Delete every row in tenant tables owned by `userId` (Prisma's `onDelete: Cascade` on `User` covers most; a few tables have explicit `Cascade` rules in the schema).
   - Trigger `uploadthing.deleteFiles` for every URL in `FileUpload.url` belonging to this user.
   - Delete the `User` row itself.
   - Write a final audit row to a separate `DeletedUserLog` (a tiny table that survives user deletion and records the event for SAR/legal-hold response). The `DeletedUserLog` does not contain PII; it stores `{ deletedAt, userIdHash, dataCategoriesPurged }`.

The cascade is one transaction per user. If any step fails, the cron retries on the next run; the transactional boundary keeps the database from leaving a half-purged state.

There is no "anonymize and keep the audit history" mode. The deletion is total.

## Data export

Two paths.

**Settings → Export data.** A user-initiated action that builds a JSON bundle of every owned row, generates a one-time download URL backed by UploadThing, and emails the URL. The bundle includes every `Client`, `Project`, `Task`, `TimeEntry`, `Update`, `Proposal`, `Invoice`, `EmailSettings`, and `AuditLog` row owned by the user. PDF copies of every proposal and invoice are bundled as separate files. The request is rate-limited to one per day per user.

```typescript
// shape of the JSON bundle
{
  exportedAt: "2026-04-30T12:00:00Z",
  user: { /* PII columns of the User row */ },
  clients: [{ ... }],
  projects: [{ ... }],
  tasks: [{ ... }],
  timeEntries: [{ ... }],
  updates: [{ ... }],
  proposals: [{ ... }],   // includes the rich-text JSON, not just the rendered HTML
  invoices: [{ ... }],
  emailSettings: { ... },
  auditLog: [{ ... }],    // last 90 days, full detail
  files: [{ url, filename, sizeBytes, mimeType, uploadedAt }],
}
```

The download URL is valid for 24 hours and is single-use; after redemption, the bundle is deleted from UploadThing.

**Pre-deletion bundle.** Triggered automatically when the user requests account deletion. The bundle is the same shape as above. The link arrives by email _immediately_ on deletion request (not at the 30-day mark); the user has access to their data even during the grace period.

## Logging hygiene

The `logger` in `src/lib/log.ts` and the Sentry integration both follow a strict hygiene rule.

**Never log:**

- Plaintext passwords.
- Plaintext tokens (magic-link tokens, JWT bodies, public-link tokens). The hash or a redacted "[token]" string is acceptable; the value is not.
- Full email body content. The recipient address may be logged for delivery failures; the body is not.
- Full file contents.
- The `User.passwordHash` even when reading the row in development.

**Acceptable to log:**

- IP and user agent in audit metadata, with retention per the table below.
- User ids (cuid). They are not PII in themselves; they are application identifiers.
- Email addresses in audit and rate-limit metadata. They are PII but they are necessary for incident response and abuse mitigation.
- Provider response codes (Resend status, Upstash limit response, etc.).

The Sentry SDK is configured to scrub fields named `password`, `token`, `secret`, `authorization`, `cookie`, and `passwordHash` from breadcrumbs and from captured event payloads:

```typescript
// src/lib/sentry.ts (excerpt)
import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  beforeSend(event) {
    const scrubs = ['password', 'token', 'secret', 'authorization', 'cookie', 'passwordHash'];
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.headers) {
      for (const k of Object.keys(event.request.headers)) {
        if (scrubs.some((s) => k.toLowerCase().includes(s))) {
          event.request.headers[k] = '[scrubbed]';
        }
      }
    }
    return event;
  },
});
```

## Retention

| Data                                       | Retention                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `AuditLog` (full detail)                   | 90 days                                                                                        |
| `AuditLog` (compacted summary)             | After 90 days, daily summaries; see `docs/architecture/audit-log.md`                           |
| `ClientPortalSession` (consumed)           | Until `sessionExpiresAt`, then deleted by daily cleanup cron                                   |
| `ClientPortalSession` (unconsumed expired) | Deleted by the same cron 24 hours after `magicLinkExpiresAt`                                   |
| Soft-deleted `User`                        | 30 days after `deletedAt`, then hard-deleted by `users.purge-deleted` cron                     |
| Soft-deleted `FileUpload`                  | 30 days after `deletionPendingAt`, then hard-deleted (see `docs/architecture/file-uploads.md`) |
| `DeletedUserLog` (anonymized)              | Indefinite (no PII)                                                                            |
| Outbound email metadata in Resend          | Resend's default retention (their dashboard)                                                   |
| Sentry events                              | Sentry's default retention by plan tier                                                        |

Retention is enforced by daily Inngest cron functions. Each cron writes audit `cron.<name>.run` with a count of rows processed.

## PH considerations

The Philippine Bureau of Internal Revenue (BIR) requires invoice records to be preserved for 10 years. Middlemist's posture:

- **The freelancer is the record-keeper.** Middlemist holds the data while the account is active. The freelancer is responsible for their own offline retention to meet BIR (or any other tax authority's) requirements.
- **JSON export and PDF download** make offline retention mechanical. The freelancer can run the export quarterly, store the JSON and PDFs in their own backup, and meet the BIR rule without depending on Middlemist's continued operation.
- **No tax compliance features in v1.** Middlemist does not file, classify, or report to BIR. It is a record system; the freelancer is the filer.

## EU/UK GDPR-adjacent posture

Middlemist v1 does not have EU/UK clients as the primary audience and does not register as a data controller in those jurisdictions. The product still implements the operational mechanisms a controller would expect:

- **Right to access.** JSON export covers every owned row.
- **Right to delete.** Account deletion removes every owned row after the grace period.
- **Data minimization.** Only the fields used by the product are stored. There are no marketing trackers, no behavioral analytics on authenticated routes, no third-party scripts loaded in `app/(app)`.
- **Purpose limitation.** Data is used for the freelancer's own operations. There is no sharing with third parties beyond the explicit list of providers (Neon, Resend, UploadThing, Inngest, Upstash, Sentry, Plausible) each of which is a processor under the freelancer's data use, not a downstream consumer.
- **Plausible (privacy-friendly analytics).** No cookies, no PII, no cross-site tracking. Used only on the marketing surface; not loaded in `app/(app)` or in client portal routes.

If a user identifies as EU/UK-resident and asks for a Data Processing Addendum (DPA), v1's response is to point to the providers' DPAs and to the freelancer's own data use as the controller. v2 will likely formalize this in a hosted DPA template if the user base warrants.

## v2

App-layer field encryption for the most sensitive columns. An audit-log search UI for the freelancer (read-only). Automated retention enforcement with an admin dashboard showing the next purge cohort and a dry-run preview. A formal DPA available for download. None of these change the v1 posture; they expand on it.
