# Secrets and environment

Every credential, API key, and signing secret the application needs is delivered as an environment variable. Production and preview values live in Vercel; development values live in `.env.local`. Validation runs at startup; a missing or malformed secret fails the build before traffic reaches the app.

## Storage

**Production and preview.** Vercel project environment variables, scoped per environment (Production, Preview, Development). Each variable's scope is explicit and visible in the Vercel UI. Preview deployments run with their own copy of every secret; this means a preview pull request never reads production credentials, which is the right posture for solo-dev review work.

**Development.** A `.env.local` file in the project root. The file is git-ignored. The `.env.example` file (committed) is the template every new clone copies and fills in.

There is no `.env`, `.env.development`, or `.env.production` checked in. Next.js treats `.env.local` as the local source of truth in development; in production, only the Vercel environment is read.

## Categories

### Server-only secrets

Never exposed to the client. No `NEXT_PUBLIC_` prefix. Reading any of these from a client component is a build-time error in the Next.js bundler.

| Variable                   | Purpose                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`              | Auth.js session signing key. Used to sign and verify the session JWT, the email verification token, and the password reset token. |
| `DATABASE_URL`             | Postgres connection string for the Neon branch this environment uses.                                                             |
| `RESEND_API_KEY`           | Outbound email send.                                                                                                              |
| `RESEND_WEBHOOK_SECRET`    | Verification of Resend bounce/complaint webhooks.                                                                                 |
| `UPLOADTHING_SECRET`       | Server-side UploadThing API authorization.                                                                                        |
| `UPLOADTHING_TOKEN`        | Token for the UploadThing v7 SDK.                                                                                                 |
| `UPSTASH_REDIS_REST_URL`   | Upstash REST endpoint for rate-limit reads/writes.                                                                                |
| `UPSTASH_REDIS_REST_TOKEN` | Auth token for Upstash REST.                                                                                                      |
| `INNGEST_EVENT_KEY`        | Outbound event signing for the Inngest client.                                                                                    |
| `INNGEST_SIGNING_KEY`      | Inbound webhook signature verification for Inngest.                                                                               |
| `SENTRY_DSN`               | Sentry ingestion endpoint (server-side).                                                                                          |
| `SENTRY_AUTH_TOKEN`        | Sentry source-map upload during build.                                                                                            |
| `EXCHANGERATE_HOST_KEY`    | API key for `exchangerate.host`.                                                                                                  |
| `CRON_SECRET`              | Bearer token verifying that a cron-triggered request came from Vercel's scheduler.                                                |
| `DISABLE_RATE_LIMITS`      | Development-only override; the env reader rejects this in production.                                                             |

### Public values

Exposed to the client. The `NEXT_PUBLIC_` prefix is mandatory; the bundler inlines these into the JavaScript that ships to the browser.

| Variable                             | Purpose                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                | The application's canonical origin (e.g., `https://middlemist.app`). Used to construct absolute URLs in emails, OG tags, and the Origin check on public POST routes. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`       | The domain Plausible analytics tracks under.                                                                                                                         |
| `NEXT_PUBLIC_SENTRY_DSN`             | Sentry ingestion endpoint (client-side, separate project from server-side to avoid cross-runtime quota).                                                             |
| `NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL` | Public origin for UploadThing-served files (used by the rich-text image-host allowlist).                                                                             |

A value without `NEXT_PUBLIC_` is _server-only_. A value with the prefix is _visible to anyone who views the page source_. Mistaking the two is a leak: a server-only value with the public prefix would be inlined into the bundle and shipped to every visitor.

## Naming rule

Server secrets must NOT start with `NEXT_PUBLIC_`. Public values MUST start with `NEXT_PUBLIC_`. The rule is mechanical and the env reader enforces it: a variable in the server-secret schema that begins with `NEXT_PUBLIC_` throws at startup.

```typescript
// src/lib/env.ts
import { z } from 'zod';

const serverSchema = z.object({
  AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_WEBHOOK_SECRET: z.string().min(1),
  UPLOADTHING_SECRET: z.string().min(1),
  UPLOADTHING_TOKEN: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  EXCHANGERATE_HOST_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(32),
  DISABLE_RATE_LIMITS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL: z.string().url(),
});

const isServer = typeof window === 'undefined';

const serverEnv = isServer ? serverSchema.parse(process.env) : ({} as never);
const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL: process.env.NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL,
});

if (isServer && serverEnv.NODE_ENV === 'production' && serverEnv.DISABLE_RATE_LIMITS === 'true') {
  throw new Error('DISABLE_RATE_LIMITS must not be true in production');
}

export const env = { ...serverEnv, ...clientEnv } as typeof serverEnv & typeof clientEnv;
```

The reader is the single import point for environment variables: `import { env } from "@/lib/env"`. The forbidden-patterns section of `CLAUDE.md` makes any other `process.env.*` access a CI failure.

## Rotation

**`AUTH_SECRET`.** Rotation invalidates every existing session in one shot (every JWT signed with the old secret fails verification). The rotation runbook is documented in `docs/ops/incident-runbook.md`. The cost: every freelancer and every active portal session is logged out. Reserved for credential-compromise events.

**Provider keys.** `RESEND_API_KEY`, `UPLOADTHING_TOKEN`, `INNGEST_SIGNING_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `EXCHANGERATE_HOST_KEY`. Rotated through the provider's UI: generate a new key, set it in Vercel, redeploy, then revoke the old key in the provider's dashboard. There is a window during which both keys are valid; choose this rather than the reverse order to avoid a downtime spike during rotation.

**`CRON_SECRET`.** Rotated by setting a new value in Vercel and redeploying. Active cron schedules continue to work because Vercel reads the new value before sending the next scheduled invocation.

**`DATABASE_URL`.** Rotated through Neon by resetting the role's password and updating the connection string. Connection-pool clients reconnect with the new credential at the next request; in-flight requests fail. Reserved for credential-compromise events.

A rotation runbook listing every provider, the steps, and the expected blast radius is part of `docs/ops/incident-runbook.md`. v2 will automate the rotation; v1 is manual and documented.

## Local dev

`.env.local` is git-ignored. `.env.example` is committed and is the template:

```
# Server-only
AUTH_SECRET=
DATABASE_URL=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
UPLOADTHING_SECRET=
UPLOADTHING_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
SENTRY_DSN=
EXCHANGERATE_HOST_KEY=
CRON_SECRET=

# Public
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=middlemist.app
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL=https://utfs.io
```

A `pre-commit` hook (or a manual check during code review) catches the rare accidental commit of `.env.local`. The git-ignored entry covers the common case.

For dev databases, two options:

- A separate Neon branch for development. This is the recommended path; it is identical to production in shape and the connection string drops in.
- A local Postgres via Docker (`docker compose up`). Useful for offline work; the schema is bootstrapped with `pnpm db:migrate`.

## Vercel

Configuration lives at _Project Settings → Environment Variables_. Each variable is set per environment with the appropriate scope checkboxes (Production / Preview / Development).

Production and Preview should differ on the values that drive _which database, which email provider account, which Redis, which UploadThing project_ the app talks to:

- `DATABASE_URL` (production and preview should use separate Neon branches; preview shares one branch across all preview deploys but is separate from production).
- `RESEND_API_KEY` (a sandbox key for preview if available; otherwise the same key, with bounce-handling on a per-environment Resend domain).
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (separate Redis instance per environment so a preview deploy's traffic does not eat production's rate-limit budget).

Production and Preview share most other secrets (`AUTH_SECRET`, `INNGEST_SIGNING_KEY`, `EXCHANGERATE_HOST_KEY`) because the difference is not meaningful at v1 scale.

## Discovery and audit

To audit which secrets the application reads, search for the import `from "@/lib/env"`. The reader's schema is the canonical list. Any secret not in the schema is unused (or, more concerning, a direct `process.env.*` read that bypassed the central reader; these should not exist).

A standalone script can dump the schema's keys:

```bash
node -e "const {env}=require('./src/lib/env'); console.log(Object.keys(env).sort().join('\n'))"
```

The list comes back sorted; comparing it to the Vercel environment-variable inventory tells the operator if any secret is set in Vercel but not consumed (orphan) or consumed but not set (unused or about-to-fail).

## v2

Automated rotation: a script that walks the provider list, generates new keys, updates Vercel, redeploys, and revokes old keys, with an audit log of every rotation. v1 is manual; the audit lives in the operator's git commit history and the relevant runbook entry.
