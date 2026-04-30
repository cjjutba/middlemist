# Monitoring

Six dashboards cover the state of Middlemist in production: Sentry for errors and traces, Plausible for marketing analytics, Vercel Analytics for traffic and real-user perf, Inngest for background jobs, Resend for email deliverability, and Neon for database health. The provider dashboards are checked routinely; alerts arrive by email for the conditions that warrant immediate attention.

## Sentry

**What it captures.** Every unhandled exception in the Node and Edge runtimes, every browser-side error from the client bundle, performance traces sampled at 10% of transactions in production. `AppError` instances raised by the application's business layer are filtered out (see `docs/engineering/error-handling.md`) so the dashboard shows the unexpected throws rather than expected outcomes.

**Setup.** `@sentry/nextjs` integration through the Next.js wizard. The DSN goes into `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser). The Sentry auth token uploads source maps at build time so production stack traces map back to the original TypeScript.

**Alerts.** Two rules:

- **New issue.** Email when a new error fingerprint appears. Default behavior; useful while the product is small. Suppressed for known noise (the rules list grows organically).
- **Error spike.** Email when any single issue exceeds 5 occurrences per hour. Catches a regression that triggers a recurring failure.

Performance alerts (a transaction exceeds a P95 threshold) are not configured in v1; the volume is too low to set a meaningful baseline. Vercel Analytics covers the broader perf picture.

**Reading the dashboard.** Top of the issues feed shows recent unresolved errors. Each issue includes the stack, the user (anonymous user id), the request URL, the breadcrumbs, and the linked release. The `requestId` from `docs/engineering/logging.md` appears in breadcrumbs; cross-referencing to Vercel logs uses the same id.

**Scrubbing.** The `beforeSend` hook removes cookies, scrubs fields named `password`, `token`, `secret`, `authorization`, `cookie`, `passwordHash` from breadcrumbs and request payloads. See `docs/security/data-protection.md`.

## Plausible

**What it captures.** Page views and a small set of custom events on the marketing surface (`/`, `/pricing`, `/about`). Events: `signup_started`, `signup_completed`, `proposal_accepted_public`, `invoice_paid_public`. No PII; no cross-site tracking; no cookies. The script loads only on `(marketing)` routes, never inside `(app)` or the client portal.

**Setup.** The Plausible script tag is conditionally rendered in the `(marketing)` layout. The domain is `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.

**Reading the dashboard.** Daily and weekly traffic, top pages, top referrers, conversion rate from `signup_started` to `signup_completed`. The dashboard is the operator's first stop for "how did the case-study post on X land."

## Vercel Analytics

**What it captures.** Real-user performance metrics (largest contentful paint, first input delay, cumulative layout shift) per page. Traffic by country and device. Vercel function execution times.

**Setup.** Enabled in _Project Settings → Analytics_. No code changes; no environment variables.

**Reading the dashboard.** P75 and P99 of LCP per route. A regression that pushes the dashboard's LCP from 1.4s to 2.2s is visible within an hour. Top slow routes get the next investigation cycle.

**Alerts.** None in v1. The dashboard is checked manually during the build phase; weekly during steady state.

## Inngest

**What it captures.** Every function run, with input payload, retry count, runtime, output (or error). Cron schedules visible at a glance. Function-level views show recent successes, recent failures, and the queue depth.

**Setup.** The Inngest client is configured in `src/lib/inngest/client.ts` with `INNGEST_EVENT_KEY`. The route handler at `/api/inngest` registers every function. The dashboard at `https://app.inngest.com` shows the production environment's runs.

**Alerts.** Email when a function exceeds 5 consecutive failures (the queue is paused after 3 retries by default; consecutive failures means the input itself is bad). Daily summary email of cron runs.

**Reading the dashboard.** _Functions_ lists every registered function. Click a function for its run history. A failed run shows the error and the input; the retry button re-invokes with the same payload. Useful during incident response: a single failed reminder send is fixable in one click.

## Resend

**What it captures.** Outbound email send count, delivery rate, bounce rate, complaint rate. Per-email status (sent, delivered, opened, clicked, bounced).

**Setup.** Domain verification (DKIM, SPF) on `middlemist.app`. The dashboard is at `https://resend.com/emails`.

**Alerts.** Email when bounce rate exceeds 5% over a rolling 24-hour window. Catches a domain reputation problem early.

**Reading the dashboard.** _Logs_ shows individual sends. Filter by `to` to see whether a specific recipient received their email. Filter by status `bounced` to see addresses to follow up on (the bounce webhook also flips `Client.emailValid = false` automatically; the dashboard is the cross-check).

## Neon

**What it captures.** Connection count, query duration P50/P95, storage size, compute time consumed, branch list.

**Setup.** Neon dashboard at `https://console.neon.tech`. No code-side configuration.

**Alerts.** Email when storage approaches the plan's cap (Free tier 0.5 GB, Pro tier higher). Email when compute time approaches the monthly cap on Free tier.

**Reading the dashboard.** _Monitoring → Operations_ shows query duration trends. A regression that introduces an N+1 surfaces as a P95 spike on the affected route. _Branches_ lists every branch; the production and preview branches should be the only long-lived ones, with feature branches deleted after merge.

## Health check

`GET /api/health` returns `200 OK` with a JSON body when the application is reachable and the database responds.

```typescript
// src/app/api/health/route.ts
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok' });
  } catch (e) {
    return Response.json({ status: 'error' }, { status: 503 });
  }
}
```

The route is unauthenticated and rate-limited at 60/minute per IP (in middleware). It is the canonical "is it up" probe. v2 may extend the response to include component-level health (Redis, Inngest, Resend); v1 keeps it simple.

A platform-level uptime check (UptimeRobot, Better Stack, or Vercel's built-in monitor) hits `/api/health` every minute and emails on three consecutive 5xx responses. Free-tier checks are sufficient for v1.

## Alerting v1

Email-based alerting from each provider's dashboard. The operator's email inbox is the single notification surface.

| Source         | Trigger                                | Action                                                     |
| -------------- | -------------------------------------- | ---------------------------------------------------------- |
| Sentry         | New issue                              | Inbox; resolve or suppress within a day.                   |
| Sentry         | Error spike (>5/hour)                  | Inbox; investigate immediately.                            |
| Resend         | Bounce rate > 5% / 24h                 | Inbox; check domain reputation.                            |
| Inngest        | 5 consecutive failures on one function | Inbox; check the function and the input.                   |
| Neon           | Storage cap approaching                | Inbox; consider plan upgrade.                              |
| Uptime monitor | 3 consecutive failed health checks     | Inbox; treat as Sev1 (see `docs/ops/incident-runbook.md`). |
| Vercel         | Build failure on `main`                | Inbox; fix the build.                                      |

There is no PagerDuty, no on-call rotation, no SMS in v1. The operator's email is the single channel; severity is judged by the trigger and by the runbook.

## v2

PagerDuty for Sev1, paging via SMS or push. A status page (Statuspage, Better Stack) for end-user visibility into incidents. Synthetic e2e checks running against production every 5 minutes to catch regressions that pass CI but fail in the production environment. None of these are v1 concerns; the volume does not justify the operational cost.

## User-facing system messages

When the application surfaces a system message to the user (a toast, an empty state, an inline error), the typography uses Inter at `{typography.body-md}` and the color uses `{colors.body}` `#1a1a1a`, with destructive states at `{colors.danger}` per `docs/design/component-patterns.md`. Stack traces are never exposed; the user sees a friendly message via `friendlyMessage(code)` (see `docs/engineering/error-handling.md`).

A user who reports a problem typically gets a quick "got it, looking" reply. The `requestId` they include in the report (or that we ask them for) joins their session to the Sentry issue and the Vercel logs; that join is the fastest path to a root cause.
