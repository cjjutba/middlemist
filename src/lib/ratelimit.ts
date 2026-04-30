import { Ratelimit } from '@upstash/ratelimit';
import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';
import { env, rateLimitsEnabled } from './env';

/**
 * Rate limiter abstraction.
 *
 * Production: Upstash REST Redis (serverless-friendly, Edge-safe).
 * Local dev: ioredis against the Docker Redis container.
 * Disabled: returns success unconditionally when DISABLE_RATE_LIMITS=true.
 *
 * Limits and prefixes follow docs/security/rate-limiting.md.
 *
 * Note: middleware imports this. If middleware ever reverts to Edge runtime,
 * the ioredis branch must be guarded behind a runtime check (Edge has no
 * Node net module). For v1, src/middleware.ts opts into the Node runtime so
 * both backends are usable.
 */

export type LimitResult = { success: true } | { success: false; retryAfterSeconds: number };

type Limiter = {
  limit: (key: string) => Promise<LimitResult>;
};

// ─── Upstash backend ──────────────────────────────────────────────────────

function makeUpstashLimiter(prefix: string, count: number, windowSeconds: number): Limiter {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash credentials are required when not using local Redis');
  }
  const redis = new UpstashRedis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(count, `${windowSeconds} s`),
    prefix,
  });
  return {
    limit: async (key) => {
      const r = await rl.limit(key);
      return r.success
        ? { success: true }
        : {
            success: false,
            retryAfterSeconds: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)),
          };
    },
  };
}

// ─── ioredis backend (local dev) ──────────────────────────────────────────

let ioredisClient: IORedis | null = null;
function getIORedis(): IORedis {
  if (!ioredisClient) {
    ioredisClient = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  }
  return ioredisClient;
}

function makeLocalLimiter(prefix: string, count: number, windowSeconds: number): Limiter {
  const redis = getIORedis();
  return {
    limit: async (rawKey) => {
      const key = `${prefix}:${rawKey}`;
      const now = Date.now();
      const windowMs = windowSeconds * 1000;
      const windowStart = now - windowMs;

      // Sliding window via sorted set: insert now, drop entries older than
      // windowStart, count remaining. Approximates Upstash's sliding window.
      const member = `${now}-${Math.random()}`;
      const pipeline = redis.multi();
      pipeline.zadd(key, now, member);
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);
      pipeline.pexpire(key, windowMs * 2);
      const results = await pipeline.exec();
      const card = results?.[2]?.[1] as number | undefined;
      const occurrences = card ?? 0;

      if (occurrences <= count) return { success: true };

      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestScore = oldest.length > 1 ? Number(oldest[1]) : now;
      const retryAfterMs = Math.max(0, windowMs - (now - oldestScore));
      return { success: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    },
  };
}

// ─── factory ──────────────────────────────────────────────────────────────

const NOOP: Limiter = { limit: async () => ({ success: true }) };

function makeLimiter(prefix: string, count: number, windowSeconds: number): Limiter {
  if (!rateLimitsEnabled) return NOOP;
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return makeUpstashLimiter(prefix, count, windowSeconds);
  }
  return makeLocalLimiter(prefix, count, windowSeconds);
}

// ─── canonical limiter set per docs/security/rate-limiting.md ────────────
// Naming follows the docs ("loginIp", "loginEmail", "publicView", etc.).

export const limits = {
  // Middleware (IP-based)
  loginIp: makeLimiter('rl:login-ip', 5, 600),
  signupIp: makeLimiter('rl:signup-ip', 5, 600),
  forgotPasswordIp: makeLimiter('rl:forgot-pwd-ip', 5, 600),
  resetPasswordIp: makeLimiter('rl:reset-pwd-ip', 5, 600),
  verifyEmailIp: makeLimiter('rl:verify-email-ip', 10, 600),
  publicView: makeLimiter('rl:public-view', 30, 60),
  portalRedeem: makeLimiter('rl:portal-redeem', 10, 60),

  // Server actions (per-userId or per-email)
  loginEmail: makeLimiter('rl:login-email', 5, 600),
  forgotPasswordEmail: makeLimiter('rl:forgot-pwd-email', 3, 3600),
  serverActionDefault: makeLimiter('rl:action-default', 60, 60),
  emailSend: makeLimiter('rl:email-send', 10, 3600),
  fileUpload: makeLimiter('rl:file-upload', 30, 3600),
  search: makeLimiter('rl:search', 60, 60),
} as const;

export type LimitName = keyof typeof limits;
