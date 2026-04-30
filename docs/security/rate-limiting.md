# Rate limiting

Rate limits exist for two reasons: to bound how fast an attacker can probe authentication, public links, and recovery endpoints; and to bound how much of one tenant's behavior can spike provider costs (Resend send count, exchange-rate API calls) or Vercel concurrency. v1 uses Upstash Ratelimit because it is serverless-native, fast on the Edge, and free at this volume.

## Provider

Upstash Ratelimit, backed by Upstash Redis. The free tier covers v1 send volume comfortably. The library exposes sliding-window and fixed-window strategies; v1 uses sliding window for everything (smoother behavior at boundary moments).

```typescript
// src/lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const limits = {
  loginIp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "rl:login-ip",
    analytics: true,
  }),
  loginEmail: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "rl:login-email",
  }),
  publicView: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:public-view",
  }),
  portalRedeem: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "rl:portal-redeem",
  }),
  serverActionDefault: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:action-default",
  }),
  emailSend: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:email-send",
  }),
  fileUpload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 h"),
    prefix: "rl:file-upload",
  }),
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:search"),
  }),
};
```

The prefix on each limiter prevents key-collision: a user id used as a key for `serverActionDefault` cannot collide with the same string used as a key for `search`.

## Where limits are applied

Two layers, picked per rule by what the limit's key is.

**Middleware (Edge)** for IP-based limits on the public surface. The Edge runtime has no Prisma but has Upstash REST access. Middleware is the right place for `/login`, `/signup`, `/forgot-password`, `/p/[token]`, `/i/[token]`, and `/portal/[token]`. Failing requests return 429 directly from middleware without ever reaching a route handler.

**Server action wrapper** for `userId`-based limits on authenticated routes. The wrapper extracts `userId` from the session, applies the relevant limit, and either continues or returns a `RATE_LIMITED` result envelope. Failing requests return a 200 with `{ ok: false, error: "RATE_LIMITED", retryAfter }`; the UI surfaces a friendly message.

**Route handlers (Node)** for the few routes that fall outside both: webhooks (which are signature-verified instead) and the few JSON APIs the portal calls (which use `PortalContext` for the limit key).

## Rules table

| Endpoint / Action                            | Limit | Window | Key                | Layer         |
| -------------------------------------------- | ----- | ------ | ------------------ | ------------- |
| `/login`                                     | 5     | 10 min | IP                 | middleware    |
| `/login` (per email)                         | 5     | 10 min | email              | server action |
| `/signup`                                    | 5     | 10 min | IP                 | middleware    |
| `/forgot-password`                           | 5     | 10 min | IP                 | middleware    |
| `/forgot-password` (per email)               | 3     | 1 hour | email              | server action |
| `/reset-password/[token]`                    | 5     | 10 min | IP                 | middleware    |
| `/verify-email/[token]`                      | 10    | 10 min | IP                 | middleware    |
| Resend verification email                    | 5     | 1 hour | email              | server action |
| `/p/[token]` and `/i/[token]`                | 30    | 1 min  | token + IP         | middleware    |
| `/api/pdf/public/{proposal,invoice}/[token]` | 30    | 1 min  | token + IP         | middleware    |
| `/portal/[token]` redemption                 | 10    | 1 min  | IP                 | route handler |
| Portal magic-link request action             | 5     | 1 min  | IP                 | server action |
| Server actions (default)                     | 60    | 1 min  | userId             | server action |
| Email-sending actions                        | 10    | 1 hour | userId             | server action |
| Resend invoice reminder action               | 5     | 1 hour | userId + invoiceId | server action |
| File upload actions                          | 30    | 1 hour | userId             | server action |
| Search action                                | 60    | 1 min  | userId             | server action |
| FX manual refresh action                     | 1     | 5 min  | userId             | server action |

A few notes on choices.

**Login per email and per IP.** Per-email throttling defends a specific account from credential stuffing. Per-IP throttling defends the auth surface from a single attacker testing many emails. Both run on the same request; the stricter of the two governs.

**Public-view limit keyed on token + IP.** A shared link (think email forwarded inside a 50-person company) should not lock out the whole NAT after 30 requests in a minute. Including the token in the key isolates one heavily-shared link from the others.

**Email-send limit per user.** Ten per hour is generous for the v1 freelance pattern (a few proposals and invoices per day). The limit catches an account that has been compromised and is being used to spray phishing through the freelancer's `Reply-To`.

**FX manual refresh.** The cached daily rate (see `docs/architecture/fx-and-currency.md`) is the production source. A manual refresh is a debug feature; one per five minutes per user is enough.

## 429 response shape

Middleware (Edge) returns 429 with a `Retry-After` header.

```typescript
// src/middleware.ts (excerpt)
import { NextResponse, type NextRequest } from 'next/server';
import { limits } from '@/lib/ratelimit';

export async function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';

  if (req.nextUrl.pathname === '/login') {
    const result = await limits.loginIp.limit(ip);
    if (!result.success) {
      return new NextResponse(null, {
        status: 429,
        headers: { 'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString() },
      });
    }
  }
  // ... other paths

  return NextResponse.next();
}
```

Server actions return a typed envelope rather than a 429 (the wire is a 200 either way; the discriminated union is what tells the UI to show a "slow down" toast).

```typescript
// src/lib/auth/with-auth.ts (excerpt; rate-limit branch)
const rl = await limits.serverActionDefault.limit(userId);
if (!rl.success) {
  return {
    ok: false,
    error: 'RATE_LIMITED',
    retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
  };
}
```

The UI surfaces a friendly message: "You're moving fast. Try again in a few seconds." The toast uses Inter at `{typography.body-md}` against `{colors.canvas}` with a 1px border in `{colors.border}` (per `docs/design/component-patterns.md`). Stack traces and provider details are not surfaced.

A 429 from middleware is logged at `info` level. The audit log does _not_ receive a row for rate-limit hits — they are too noisy and too rarely useful to keep in the operational record.

## Bypass

Never in production. In development, set `DISABLE_RATE_LIMITS=true` (read by `src/lib/env.ts`) to short-circuit `limits.*.limit()` to always-success. The env reader fails the build if `DISABLE_RATE_LIMITS=true` is set in production via Vercel.

```typescript
// src/lib/ratelimit.ts (excerpt)
const disabled = env.DISABLE_RATE_LIMITS === 'true';

function limited(rl: Ratelimit) {
  return {
    async limit(key: string) {
      if (disabled) return { success: true, reset: 0, remaining: Number.MAX_SAFE_INTEGER };
      return rl.limit(key);
    },
  };
}
```

## Edge cases

**Shared IPs.** Offices, schools, mobile carriers, and corporate VPNs share an outbound IP across many users. The IP-based limits are deliberately generous (5 per 10 min for auth, 30 per minute for public views) so a normal day at a co-working space does not trip them. The per-email and per-userId limits tighten the budget on a specific account.

**Burst right at the boundary.** Sliding-window strategy avoids the "exactly at second 0" amplification that a fixed window has. A user who hits 5 logins at 9:59:59 and 5 more at 10:00:01 still trips the limit because the window slides; the count is "5 in the last 10 minutes" not "5 in the current minute bucket."

**Distributed attacker.** A botnet rotating across many IPs sidesteps IP-based limits. The per-email limit on `/login` catches credential stuffing against a known address. There is no per-account-creation rate (a botnet can register many fake accounts), but signup writes audit `user.signup` and the operator can detect a spike in the audit query during incident response.

**Webhook flood.** Inngest, UploadThing, and Resend webhooks are signature-verified, not rate-limited. A flood of unsigned requests is rejected at the signature check before hitting the rate limit; a flood of correctly-signed requests would only come from the provider, which has its own outbound rate limits.

**Race against the limit.** Two concurrent requests in the same millisecond can both succeed if the limit is at the boundary (the increment is not atomic across REST calls). The slop is bounded by the request count and is acceptable for v1; a determined attacker cannot use this slop to exceed a meaningful multiple of the configured limit.

**Cron-driven actions.** The `invoices.send-reminders` cron iterates over invoices and dispatches individual `invoice.reminder` events through Inngest. The cron runs server-side without a session and does not pass through the server-action rate limit. The `emailSend` provider rate-limit (10/hour/user) does apply, because reminder dispatch goes through `sendEmail` for each address. A user with 50 overdue invoices on the same day has their reminder send capped at 10; the rest are scheduled for the next hour by Inngest's queue.

## Audit

Rate-limit hits are not written to `AuditLog`. They are logged at `info` with structured fields `{ rule, key, ip, userId, retryAfter }`. The structured logger goes to Vercel's stdout capture and to Sentry breadcrumbs (without payload). A spike of 429s is visible in Vercel logs and in Upstash's analytics dashboard, both of which suffice for v1 incident response.
