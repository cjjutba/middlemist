# Incident runbook

When something is broken in production, this document is the first stop. Each section is a checklist for a specific failure mode. The flow at the top is the meta-runbook; the scenario-specific checklists below cover the failure modes most likely to happen at v1 scale. Postmortems for every Sev1 and Sev2 incident go into the postmortem template at the bottom of this file.

## Severity

Three levels.

**Sev1 — drop everything.** Complete outage (the application is unreachable or every authenticated route returns 5xx) or active data loss (a destructive operation is in progress against production). Response time: minutes. Acceptable interruption: any.

**Sev2 — within 24 hours.** A major feature is broken for all users (proposals do not send, invoices do not save, login is partially broken). Response time: hours. Acceptable interruption: planned breaks in the operator's day.

**Sev3 — within a week.** A minor or single-user issue. A regression that affects a small surface but does not block the product. Response time: days. Acceptable interruption: regular work cadence.

A condition starts at the highest severity it could reasonably be and de-escalates as facts arrive. "The site might be down" starts as a Sev1 until a check confirms it is reachable.

## Incident flow

```
detect → declare → contain → fix → verify → postmortem
```

**Detect.** The first signal: an alert email (Sentry, Resend, uptime monitor), a user report by email, the operator's own observation. The signal does not have to be precise; "something is off" is enough to start.

**Declare.** The operator records the start time, the severity, and the apparent symptom. v1 has no incident tracker; a single line in a `~/.notes/incidents.md` file (or its equivalent) captures the timestamp and the symptom. The declaration matters because the postmortem timeline starts here.

**Contain.** Stop the bleed before fixing. Examples: pause Inngest crons if a cron is the cause; flip the application into maintenance mode if a page is leaking; rotate `AUTH_SECRET` if a credential is suspected leaked. Containment is reversible; fixing is not.

**Fix.** Apply the actual remedy. A code change, a config flip, a data restore, a provider rotation.

**Verify.** Hit `/api/health`. Sign in. Open a public proposal. Send a test email. Trigger a known cron. The verification list is short but specific enough to confirm the fix held.

**Postmortem.** Within 48 hours of resolution, write the postmortem (template at the bottom of this file). Even for incidents the operator believes were trivial, the timeline and the action items are the artifact that improves next-time response.

## Common scenarios

### Site down

**Symptom.** Uptime monitor flagged 3 consecutive failures. Health check returns 5xx or times out.

**Checklist:**

1. Open Vercel status page (`https://vercel-status.com`). If Vercel is degraded, this is platform-level; wait and monitor.
2. Open Neon status (`https://neonstatus.com`). If Neon is degraded, the database is unreachable; the app will fail. Wait and monitor.
3. Recent deploys: _Vercel → Project → Deployments_. If a deploy landed within the last 30 minutes, suspect it.
   - **Action:** Promote the previous deployment via _Promote to Production_. Takes seconds.
4. Vercel function logs: _Project → Logs_. Filter `level=error`. The most recent errors point at the cause.
5. If the last deploy is older than the symptom and Vercel/Neon are healthy, the cause is likely runtime: the database is full, a connection limit hit, a hung function consuming the concurrency budget.

### DB down or slow

**Symptom.** `/api/health` returns 503. Vercel logs show Prisma timeouts or `Can't reach database`.

**Checklist:**

1. Neon dashboard → Operations. Recent query duration spike?
2. Connection count near the cap?
3. Active queries: _Neon → Branch → SQL Editor → `SELECT _ FROM pg_stat_activity`*. Long-running queries are visible. Kill stuck queries with `SELECT pg_cancel_backend(pid)`.
4. Recent migration: did one apply that introduced a missing index?
5. Storage limit reached? (Free tier 0.5 GB; the dashboard shows usage.)
6. **Action paths:**
   - Storage full → upgrade plan or vacuum (rare in v1).
   - Connection cap hit → rotate the connection-pooler URL (Neon's pooled connection string handles serverless scenarios better than the direct URL).
   - Slow query → identify the offending route, fix the query (often an N+1; see `docs/engineering/performance.md`).

### Email not sending

**Symptom.** A `proposal.sent` event ran successfully (Inngest dashboard shows green) but the recipient did not receive the email. Or `Client.emailValid` is false unexpectedly. Or Resend's dashboard shows a spike in bounces.

**Checklist:**

1. Resend dashboard → _Logs_. Filter by `to` or by recent timestamps. Status of the relevant send?
   - `delivered` → email is fine; recipient may have it in spam.
   - `bounced` → check the bounce reason. The `Client.emailValid` flag should already be false; if not, the webhook may have failed.
   - `queued` for an extended time → Resend is degraded.
2. Check Resend status (`https://resend.com/status`).
3. DKIM/SPF/DMARC: verify in Resend dashboard → Domain. If a record drifted (DNS changes), authentication fails and major providers (Gmail, Microsoft) bounce or quarantine.
4. API key valid? An expired or revoked `RESEND_API_KEY` returns 401 from Resend, which is logged at error.
5. **Action paths:**
   - Bounce on `Client.email` → notify the freelancer in-app; ask them to update the address. The webhook handler does this automatically; if not, it is a webhook bug to fix.
   - Domain reputation problem → check Resend's reputation page; consider warming up gradually if a sending pattern changed.
   - Resend down → wait. The Inngest function will retry on the provider's recovery.

### FX API down

**Symptom.** The FX refresh cron fails. New currency conversions fall back to the cached rate (acceptable) or fail with a `INTEGRATION_EXCHANGERATE` error (not acceptable for the manual-refresh path).

**Checklist:**

1. Check `exchangerate.host` status (their status page or just a curl).
2. The FX service caches the most recent rate per currency pair (see `docs/architecture/fx-and-currency.md`). Stale rates are tolerable for hours; the freelancer's invoice will compute against the last known rate.
3. **Action paths:**
   - Provider down for hours → the cached rate is the production source. New invoices use the cached rate; the freelancer is unaware.
   - Provider down for days → consider switching providers. v1 has no fallback provider; v2 will list one.

### File uploads failing

**Symptom.** Upload requests return 5xx. UploadThing dashboard shows quota or auth issues.

**Checklist:**

1. UploadThing dashboard → Quota. Free tier limit hit?
2. UploadThing status (`https://status.uploadthing.com`).
3. `UPLOADTHING_TOKEN` valid? An expired token fails every upload; the env reader does not catch a _valid-shape but inactive_ token, only a missing one.
4. UploadThing's `f.middleware` rejecting the upload? Logs in Vercel show the rejection reason (file too large, MIME not allowed, ownership check failed).
5. **Action paths:**
   - Quota → upgrade plan or cleanup unused files via the soft-delete cron.
   - UploadThing down → degrades the upload UX; the rest of the application is unaffected. Inform users in-app.

### Login broken

**Symptom.** Users cannot log in. The login form returns "Incorrect email or password" for known-good credentials, or the page errors out entirely.

**Checklist:**

1. Auth.js logs in Vercel: filter for the `[next-auth]` prefix. Recent error?
2. `AUTH_SECRET` set? An empty or wrong-length value fails the env-reader schema, which fails the build. If the build is up but login fails, suspect a stale `AUTH_SECRET` (a deploy that did not pick up the new value).
3. Database: can the app read `User`? `SELECT count(*) FROM "User"` from Neon's SQL editor.
4. Recent migration that touched `User`? A column drop that the code still references would crash at session-callback time.
5. **Action paths:**
   - Stale secret → trigger a redeploy with the correct value.
   - Schema drift → roll back the migration (PITR if necessary).
   - Auth.js bug → check the Auth.js GitHub for an open issue matching the symptom.

### Inngest jobs not running

**Symptom.** A scheduled cron does not appear to have run, or its result is not visible. Or a freelancer-triggered event (proposal sent) does not produce an email.

**Checklist:**

1. Inngest dashboard → Functions. Last run timestamp for the affected function.
2. Recent function deployments? The Vercel deploy registers the new function set with Inngest at first request; if the deploy failed mid-way, registration may be partial.
3. Queue depth: a stuck function with backed-up retries shows as a high depth. A function that is repeatedly failing on the same input (poison message) eventually dead-letters; the dashboard shows it.
4. `INNGEST_SIGNING_KEY` mismatched? If Inngest's signature does not validate at `/api/inngest`, every webhook fails with 401.
5. **Action paths:**
   - Poison message → fix the input, replay (or delete the dead-lettered run if the data is stale).
   - Function not registered → re-deploy.
   - Inngest down → wait. Their queue persists; events delivered late are processed when the service recovers.

### Public proposal/invoice link 404

**Symptom.** A freelancer reports their client clicked the proposal link and got a 404 page.

**Checklist:**

1. Was the public token regenerated? Check `AuditLog` for `proposal.regenerated-token` rows. If the freelancer regenerated the token, the old URL stops working.
2. Is the proposal archived or expired? `/p/[token]` returns 404 for `archived` status (see `docs/security/authorization.md`).
3. Is the database reachable? A 404 from a missing row vs. a 5xx from a query failure look different in the route handler.
4. Did a recent deployment affect the public route? Check Vercel logs.
5. **Action paths:**
   - Regenerated token → resend the link. The freelancer can copy the new URL from the proposal page.
   - Archived/expired status → ask the freelancer if they meant to expire it; if not, transition the status back.

## Postmortem template

Within 48 hours of resolution:

```
# Postmortem: <date> <short-description>

## Severity
Sev<1|2|3>

## Summary
One paragraph: what broke, who was affected, how long.

## Timeline (UTC)
12:34  - first signal (alert / user report)
12:36  - declared as Sev<n>
12:42  - hypothesis: <X>
12:51  - applied fix: <Y>
12:55  - verified resolved
14:00  - postmortem started

## Root cause
What actually went wrong, in one or two paragraphs. Not "the bug was bad code"; specifically which code, which condition, which data.

## What worked
What detection/diagnosis/fix steps went well.

## What didn't
What was slow, missing, or misleading.

## Action items
- [ ] (owner: cj) Add a regression test for the path that broke.
- [ ] (owner: cj) Update the runbook section X to mention Y.
- [ ] (owner: cj) Add an alert for the condition that took 20 minutes to spot.

## Followups
Anything not in scope for action items but worth recording.
```

The format is the same regardless of severity. A Sev3 postmortem is shorter; a Sev1 postmortem is longer; both have the same sections.

Postmortems live in `docs/ops/postmortems/` (a folder created on first incident; not pre-populated). One file per incident, named `<YYYY-MM-DD>-<slug>.md`.

## Communication

v1 has no status page. For incidents that affect users:

- **Sev1.** Email impacted clients directly. The operator can identify "impacted" by the audit log (recent activity from those users) or by user reports. The email is brief, calm, and direct: what broke, what is happening, when to expect resolution. Inter is the rendered HTML font; no marketing language; no apology theatre.
- **Sev2.** In-app banner on the affected route, plus an email to known-affected users if the incident is long.
- **Sev3.** Resolved silently or noted in a release-note style update.

A status page (Statuspage, Better Stack) is v2 work. For v1, direct communication is faster and the user count is small enough that one-off emails are operationally trivial.

The communication tone matches the design system: direct, calm, no marketing copy. Body text in Inter at `{typography.body-md}`, headlines in Inter Display at `{typography.display-md}`. Links use `{colors.brand-accent}` `#3b82f6` per `docs/design/component-patterns.md`.
