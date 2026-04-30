# Environment configuration

Environment variables are the single mechanism for configuring Middlemist across environments. The complete inventory lives below, with a short note for each on what it is, where to obtain it, which environments need it, and whether it is server-only or public. The validated env reader (`src/lib/env.ts`) is the canonical loader; see `docs/security/secrets-and-env.md` for the architecture and rotation rules.

## `.env.example`

Committed at the repository root. New contributors copy it to `.env.local` and fill in values from their accounts at each provider.

```
# ─── Server-only ─────────────────────────────────────

# Auth.js session signing key. 32 bytes recommended.
AUTH_SECRET=

# Postgres connection string for this environment.
DATABASE_URL=

# Resend API key for outbound transactional email.
RESEND_API_KEY=

# Resend webhook signing secret for bounce/complaint webhooks.
RESEND_WEBHOOK_SECRET=

# UploadThing v7 token (covers both client and server).
UPLOADTHING_TOKEN=

# UploadThing API secret for legacy/server-side calls.
UPLOADTHING_SECRET=

# Upstash Redis REST endpoint.
UPSTASH_REDIS_REST_URL=

# Upstash Redis REST auth token.
UPSTASH_REDIS_REST_TOKEN=

# Inngest event signing key (outbound).
INNGEST_EVENT_KEY=

# Inngest webhook signing key (inbound).
INNGEST_SIGNING_KEY=

# Sentry DSN (server runtime).
SENTRY_DSN=

# Sentry auth token for source-map uploads at build time.
SENTRY_AUTH_TOKEN=

# exchangerate.host API key.
EXCHANGERATE_HOST_KEY=

# Cron-trigger bearer token. 32 bytes recommended.
CRON_SECRET=

# Development override only. Throws in production.
DISABLE_RATE_LIMITS=

# ─── Public (NEXT_PUBLIC_) ───────────────────────────

# Canonical app origin (used in absolute URLs and Origin checks).
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Plausible analytics domain (matches the site setup).
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=middlemist.app

# Sentry DSN (browser runtime; usually a separate project from server).
NEXT_PUBLIC_SENTRY_DSN=

# UploadThing public URL host (used by the rich-text image-host allowlist).
NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL=https://utfs.io
```

## Per-variable reference

### `AUTH_SECRET`

What it is: the signing key for Auth.js sessions, the email verification token, and the password reset token.

Where to get it: generate locally.

```bash
openssl rand -base64 32
```

Environments: development, preview, production. **Different per environment** — sharing across environments would let a session signed in preview validate in production (and vice versa). Each environment gets its own value.

Server-only. Never commit. Rotation invalidates every existing session globally.

### `DATABASE_URL`

What it is: the Postgres connection string for the environment.

Where to get it: Neon dashboard → Project → Branch → Connection string. Use the connection-pooled URL (`...-pooler.<region>.neon.tech`) for all environments because Vercel functions reconnect on every invocation and pgBouncer-style pooling is required to avoid connection exhaustion.

Environments: development, preview, production. **Different per environment** — production points at the `main` branch, preview at the shared preview branch, development at the dev branch.

Server-only.

### `RESEND_API_KEY`

What it is: API key for Resend's send endpoint.

Where to get it: Resend dashboard → API Keys → Create. For development, create a key restricted to the sandbox sender (so dev sends do not flow to real recipients). For production, create a key with full sending scope.

Environments: development (sandbox key), preview (sandbox key), production (production key).

Server-only.

### `RESEND_WEBHOOK_SECRET`

What it is: shared secret used to verify Resend's webhook signatures.

Where to get it: Resend dashboard → Webhooks → Endpoint → Signing secret.

Environments: production (only). Preview and development do not configure inbound webhooks; bounce events do not fire there. Setting it in preview/development is harmless but unused.

Server-only.

### `UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET`

What they are: UploadThing v7 token and the API secret used by the server SDK.

Where to get them: UploadThing dashboard → API Keys.

Environments: all three. Use a separate UploadThing project per environment to avoid cross-environment file pollution; the production project is the only one with off-platform backups configured (none in v1, but the boundary is set up for v2).

Server-only.

### `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

What they are: the REST endpoint and auth token for Upstash Redis.

Where to get them: Upstash dashboard → Database → REST API.

Environments: all three. **Different per environment** — sharing across environments would let preview rate-limit hits eat production's budget.

Server-only.

### `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

What they are: the outbound event signing key (the application uses it when calling `inngest.send`) and the inbound webhook signing key (Inngest uses it to sign webhook calls into `/api/inngest`).

Where to get them: Inngest dashboard → Manage → Keys.

Environments: development uses the dev event key (Inngest's local dev mode does not require signing); preview and production use distinct keys per Inngest environment.

Server-only.

### `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`

What they are: the server-runtime DSN, the build-time auth token used to upload source maps, and the browser-runtime DSN. The two DSNs typically point at different Sentry projects so the quotas are independent (browser errors and server errors aggregate separately, which is operationally cleaner).

Where to get them: Sentry dashboard → Settings → Auth Tokens (for the auth token); Project Settings → Client Keys (for the DSNs).

Environments: production (and optionally preview). Development does not need them in v1; errors surface in the local console.

Server-only (DSN is technically not secret, but treat it as such; the auth token is secret).

### `EXCHANGERATE_HOST_KEY`

What it is: API key for `exchangerate.host`.

Where to get it: their dashboard.

Environments: production. Preview can share the production key (read-only API, low rate limits do not collide). Development can share or skip; the FX service falls back to a cached rate when the API is unavailable.

Server-only.

### `CRON_SECRET`

What it is: a bearer token Vercel attaches to scheduled invocations, used to verify a request came from Vercel's scheduler rather than from an attacker who guessed the cron URL.

Where to get it: generate locally.

```bash
openssl rand -base64 32
```

Environments: production. Preview and development do not run scheduled crons in v1.

Server-only.

### `DISABLE_RATE_LIMITS`

What it is: a development-only override that short-circuits every Upstash Ratelimit call to always-success.

Where to get it: set to `true` in `.env.local` only. The env reader throws if `NODE_ENV === "production"` and this is `true`.

Environments: development only.

Server-only.

### `NEXT_PUBLIC_APP_URL`

What it is: the canonical origin for the application. Used to construct absolute URLs in emails (the link a recipient clicks), to verify Origin headers on public POST routes, and to provide a base for OG images.

Where to set it: hard-coded per environment.

- Development: `http://localhost:3000`
- Preview: `https://<your-preview-url>.vercel.app` (Vercel substitutes it; or hard-code if a preview-specific custom domain is in use)
- Production: `https://middlemist.app`

Public.

### `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`

What it is: the domain Plausible analytics tracks under.

Where to set it: matches the production domain. Development and preview can leave it set; the Plausible script ignores hits from non-matching origins.

Public.

### `NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL`

What it is: the host where UploadThing serves uploaded files. Used by the rich-text image sanitizer to enforce that user-supplied `<img src>` URLs point at UploadThing only.

Where to set it: `https://utfs.io` (the UploadThing public CDN). If a custom CDN is configured in the UploadThing dashboard, use that host.

Public.

## Generation tips

```bash
# AUTH_SECRET, CRON_SECRET (32 bytes, base64-encoded)
openssl rand -base64 32

# A nanoid for ad-hoc tokens
node -e "console.log(require('nanoid').nanoid(48))"
```

For dev databases, two patterns:

- **Neon dev branch.** Recommended. Same shape as production, drop-in connection string.
- **Local Postgres via Docker.** Useful offline. The `docker-compose.yml` (see `docs/engineering/testing.md`) brings up a Postgres container; bootstrap with `pnpm prisma migrate deploy`.

## Vercel configuration

In *Project → Settings → Environment Variables*, every variable is set with explicit scope checkboxes:

- **Production** — enabled for the values that production reads.
- **Preview** — enabled for preview deploy values (often the same secrets but different `DATABASE_URL`, `UPSTASH_REDIS_*`, and `NEXT_PUBLIC_APP_URL`).
- **Development** — typically not used (`vercel dev` is rarely used in v1; `pnpm dev` reads `.env.local`).

The Vercel UI shows which environments each variable is configured in. A periodic audit (during incident response or quarterly) compares the Vercel inventory against the schema in `src/lib/env.ts`; any orphan or missing variable is reconciled.

## Secrets that must differ per environment

A short list of variables where a shared value would create problems:

- `AUTH_SECRET`. A session signed in preview should not validate in production. Different secrets isolate the two cookie populations.
- `DATABASE_URL`. Production data should not be visible from preview. Separate Neon branches per environment.
- `RESEND_API_KEY`. The development/preview key should be sandbox-restricted (does not deliver to real recipients) so testing does not email actual clients.
- `UPSTASH_REDIS_REST_URL` / `_TOKEN`. Separate Redis instances so preview-environment activity does not consume production's rate-limit budget.
- `UPLOADTHING_TOKEN` / `UPLOADTHING_SECRET`. Separate UploadThing projects so a preview-uploaded file is not addressable from production.

## Secrets that may be shared per environment

- `EXCHANGERATE_HOST_KEY`. Read-only API; sharing across preview and production has no operational impact.
- `SENTRY_DSN` for the server-runtime. Quotas are aggregate; v1 accepts the noise rather than running two Sentry projects.
- `INNGEST_SIGNING_KEY`. Inngest environments are typically separate per Vercel environment; the Inngest cloud picks the right environment from the request, so the signing key is per-environment by configuration even when copy-pasted across the Vercel UI.
