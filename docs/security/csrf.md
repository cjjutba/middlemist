# CSRF

Cross-site request forgery is the attack where a third-party site convinces a logged-in user's browser to make a state-changing request against the application's session cookie. v1 relies on three defenses: Next.js 15's built-in Origin/Referer check on Server Actions, the `sameSite=lax` cookie posture, and signature verification on webhook endpoints. There is no separate CSRF token in v1; it is not needed.

## Server Actions

Next.js 15 includes built-in CSRF protection on Server Actions. The framework verifies the `Origin` header matches the request's host on every Server Action POST. A missing or mismatched origin returns 403 before the action handler runs. This makes a cross-site form submission unable to invoke a Server Action even if the attacker's site can read the form's HTML.

Server Actions are the only mutation entry points the application exposes (with two exceptions: webhook endpoints, covered below; and the public proposal accept POST, covered below). All `useFormState` and manual fetch invocations of Server Actions go through this check automatically; there is no opt-out and no way to disable it for "convenience" routes.

The Auth.js session cookie is configured with `sameSite=lax` (see `docs/security/authentication.md`). Modern browsers refuse to attach the cookie to cross-site form posts; the only requests that include the cookie are first-party navigations and same-origin XHR. This is the primary line of defense; the framework's Origin check is the second.

## Public POST endpoints

Two POST routes are reachable without a session cookie:

- **Proposal accept** at `/p/[token]/accept`. The body carries `signatureName` and `signatureEmail`; the response transitions the proposal to `accepted` and writes audit.
- **Invoice viewed-tracking** at `/api/track/invoice/[token]/view`. A small POST sent by client-side script when the public invoice page renders, used to record audit even if the page was opened via a no-JS PDF reader. v1 may skip this route depending on whether the GET-side tracking already covers it.

These routes need their own CSRF posture because there is no session cookie to defend.

**Defense for proposal accept:**

1. **Token in the URL.** The token is a 21-character `nanoid`, ~126 bits of entropy. An attacker who does not have the token cannot construct the URL.
2. **Origin header check on POST.** The route handler verifies `request.headers.get("origin")` matches the application's own host. A cross-origin POST is rejected with 403.
3. **Rate limit per token + IP.** 30 requests per minute per (token, IP) tuple. An attacker with the token cannot mass-submit accept attempts.
4. **State-machine guard.** The accept action checks the current status and refuses if the proposal is already `accepted`, `declined`, `expired`, or `archived`. Even a successful CSRF can fire only one accept against any given proposal.
5. **Audit log entry with IP and user agent.** Every accept writes to `AuditLog`. A coerced acceptance is detectable post-hoc.

```typescript
// src/app/p/[token]/accept/route.ts
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { proposalsRepo } from '@/lib/repositories/proposals.repo';
import { acceptProposalSchema } from '@/lib/schemas/proposal.schema';

const APP_HOST = new URL(env.NEXT_PUBLIC_APP_URL).host;

function isValidOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).host === APP_HOST;
  } catch {
    return false;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const h = await headers();
  if (!isValidOrigin(h.get('origin'))) {
    return Response.json({ ok: false, error: 'BAD_ORIGIN' }, { status: 403 });
  }

  const { token } = await params;
  const body = await req.json().catch(() => null);
  const parsed = acceptProposalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
  }

  // ... rate-limit, state check, mutation, audit
}
```

The Origin check is the cheapest, most reliable mitigation for unauthenticated mutations. It does not require any browser cooperation beyond what every modern browser already does (set the Origin header on cross-origin POST). A CLI client that omits the header is rejected; a CLI client that forges the header is the same threat as a logged-in attacker, which the rate limit and state-machine guard address.

## API routes

The `/api/inngest`, `/api/uploadthing`, and `/api/email/webhook` route handlers receive POSTs from external providers. Each one verifies a provider-specific signature before doing anything.

### Inngest

Inngest signs every webhook with `INNGEST_SIGNING_KEY`. The Inngest Next.js SDK handles signature verification automatically when the route handler is wired through `serve`:

```typescript
// src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { fnSendProposal, fnSendInvoice /* ... */ } from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [fnSendProposal, fnSendInvoice /* ... */],
});
```

The SDK rejects requests with a missing or invalid signature and returns 401. The application code never sees an unsigned webhook.

### UploadThing

UploadThing's `createRouteHandler` handles its own auth-and-signature flow:

```typescript
// src/app/api/uploadthing/route.ts
import { createRouteHandler } from 'uploadthing/next';
import { uploadRouter } from './core';

export const { GET, POST } = createRouteHandler({ router: uploadRouter });
```

The `f.middleware` block on each upload context (see `docs/architecture/file-uploads.md`) verifies the user's session before the upload is accepted; the upload-completion webhook is signed by UploadThing and verified by their SDK.

### Resend bounce webhook

Resend signs each webhook with `RESEND_WEBHOOK_SECRET` using HMAC-SHA256. Verification is explicit:

```typescript
// src/app/api/email/webhook/route.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { handleResendEvent } from '@/lib/email/webhook-handler';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('resend-signature');
  if (!signature) return new Response('missing signature', { status: 401 });

  const expected = createHmac('sha256', env.RESEND_WEBHOOK_SECRET).update(body).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return new Response('bad signature', { status: 401 });
  }

  const event = JSON.parse(body);
  await handleResendEvent(event);
  return new Response('ok');
}
```

`timingSafeEqual` runs in constant time so signature verification does not leak information through timing. The body is read as a string, not pre-parsed, so the signature is computed over exactly what the provider sent.

## Cookies

Every Middlemist cookie sets `sameSite=lax`. Lax is the right pick for v1: it blocks cross-site form posts (the CSRF threat) while still permitting first-party top-level navigations to attach the cookie (which login redirects, OAuth flows in v2, and email-link landings need). `Strict` would also block links from emails or from the marketing site, which would create UX bugs without buying meaningful additional security.

Auth.js sets `sameSite=lax` by default for the session cookie; the explicit configuration in `src/lib/auth/config.ts` makes the choice visible in code review.

The portal cookie (issued at magic-link redemption) uses the same posture.

## Forbidden patterns

**Disabling CSRF on a route handler "for convenience."** The Origin check is a one-line addition and the cost is negligible. There is no route that legitimately needs to accept arbitrary cross-origin POST without authentication.

**Accepting state-changing requests via GET.** Every state change is a POST. GET handlers read; they do not write. Cross-site image tags and prefetch links can fire GETs without the user's consent, so a GET that mutates is a CSRF vector by design. Public proposal view writes one audit row on GET (`proposal.viewed`); that single mutation is intentional and acceptable because it records the fact of the read, not a state change with operational consequences.

**Trusting custom request headers as proof of intent.** A header like `X-Requested-With: XMLHttpRequest` was once treated as a CSRF defense. Modern browsers send it freely, and modern attackers know to set it. Origin and same-site cookies are the actual defenses; a custom header is decoration.

## What CSRF v2 will look like

If v2 adds a JSON-body API authenticated by an `Authorization` header (e.g., for a desktop client, mobile app, or third-party integration), CSRF stops being a concern for those routes — the header is set programmatically, not by the browser, and the cookie is not used. Web routes continue to rely on Server Actions and same-site cookies. No double-submit-token scheme is planned.
