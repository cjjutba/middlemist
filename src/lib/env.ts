import { z } from 'zod';

/**
 * Single source of truth for environment variables.
 *
 * Every env var the app reads must be declared here. Direct process.env.X
 * access elsewhere is forbidden (a future lint rule will enforce this).
 *
 * Validation runs once at module load. A malformed env crashes the app at
 * startup with a clear zod error message — that's intentional. Missing
 * required env in production should not be silent.
 *
 * The schema is split into server-only and public (NEXT_PUBLIC_) per
 * docs/security/secrets-and-env.md. Server secrets are parsed only on the
 * server (typeof window === 'undefined') so they never leak into the
 * browser bundle. Public values are listed by literal so the Next.js
 * bundler can inline them on the client.
 *
 * Cloud-provider secrets (Resend, UploadThing, Upstash, Sentry, etc.) are
 * marked optional because local dev runs against Mailpit + ioredis +
 * Inngest dev mode and doesn't need real provider credentials. Production
 * deployments must set them; the integration code in src/lib/email/,
 * src/lib/ratelimit.ts, etc. throws clearly when called without its
 * credential.
 */

// ─── server-only secrets ──────────────────────────────────────────────────

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Auth.js
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_URL: z.string().url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Email — production sender (Resend); local dev uses SMTP fallback
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('hello@middlemist.app'),

  // Email — local dev SMTP (Mailpit)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1026),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('hello@middlemist.local'),

  // Background jobs
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_DEV: z.coerce.boolean().default(false),

  // File uploads (UploadThing v7)
  UPLOADTHING_TOKEN: z.string().optional(),
  UPLOADTHING_SECRET: z.string().optional(),

  // Rate limiting — Upstash in production
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Rate limiting — local Redis (ioredis)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Cron
  CRON_SECRET: z.string().optional(),

  // FX
  EXCHANGERATE_HOST_KEY: z.string().optional(),

  // Observability — server runtime
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Dev-only override; rejected at runtime if set in production
  DISABLE_RATE_LIMITS: z.coerce.boolean().default(false),
});

// ─── public (NEXT_PUBLIC_) values ─────────────────────────────────────────
// Listed by literal so the Next.js bundler inlines them on the client.

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL: z.string().url().default('https://utfs.io'),
});

// ─── parse ────────────────────────────────────────────────────────────────

const isServer = typeof window === 'undefined';

/**
 * Treat empty-string env values as undefined. The .env.example template
 * leaves cloud-provider keys as `KEY=` (empty), and `z.string().url()`
 * rejects '' before `.optional()` can ignore it. Coercing '' → undefined
 * lets optional URL fields stay clean for local dev.
 */
function coerceEmptyToUndefined(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === '' ? undefined : value;
  }
  return out;
}

const cleanedEnv = coerceEmptyToUndefined(process.env);

const serverParsed = isServer
  ? serverSchema.safeParse(cleanedEnv)
  : { success: true as const, data: {} as z.infer<typeof serverSchema> };

const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL: cleanedEnv['NEXT_PUBLIC_APP_URL'],
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: cleanedEnv['NEXT_PUBLIC_PLAUSIBLE_DOMAIN'],
  NEXT_PUBLIC_SENTRY_DSN: cleanedEnv['NEXT_PUBLIC_SENTRY_DSN'],
  NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL: cleanedEnv['NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL'],
});

if (!serverParsed.success) {
  console.error('❌ Invalid server environment variables:');
  console.error(serverParsed.error.flatten().fieldErrors);
  throw new Error('Invalid server environment variables');
}

if (!clientParsed.success) {
  console.error('❌ Invalid public environment variables:');
  console.error(clientParsed.error.flatten().fieldErrors);
  throw new Error('Invalid public environment variables');
}

// Production guard: DISABLE_RATE_LIMITS must never be true in production runtime.
// Skipped during `next build` page collection (NEXT_PHASE === 'phase-production-build')
// because that phase loads .env.local locally even though NODE_ENV=production.
const isBuildPhase = process.env['NEXT_PHASE'] === 'phase-production-build';
if (
  isServer &&
  !isBuildPhase &&
  serverParsed.data.NODE_ENV === 'production' &&
  serverParsed.data.DISABLE_RATE_LIMITS
) {
  throw new Error('DISABLE_RATE_LIMITS must not be true when NODE_ENV=production');
}

export const env = {
  ...serverParsed.data,
  ...clientParsed.data,
} as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;

// ─── derived flags ────────────────────────────────────────────────────────

/**
 * When true, the app sends mail through the local Mailpit SMTP server via
 * nodemailer. When false, the app uses Resend's API. The toggle is
 * "is RESEND_API_KEY present?" rather than NODE_ENV so a developer can
 * opt into testing real Resend in dev by setting the key.
 */
export const isUsingLocalSmtp = !env.RESEND_API_KEY;

/**
 * Rate limits are disabled in dev by default unless the developer opts in.
 * Production always runs with rate limits on (the production guard above
 * rejects DISABLE_RATE_LIMITS=true at startup).
 */
export const rateLimitsEnabled = env.NODE_ENV === 'production' || !env.DISABLE_RATE_LIMITS;
