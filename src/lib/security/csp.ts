import { env } from '../env';

/**
 * Content-Security-Policy header.
 *
 * Tight policy aligned with docs/security/xss-and-sanitization.md.
 *
 * Note on script-src: docs envision per-request nonces, but Next.js 16's
 * nonce wiring through React Server Components is still moving. v1 ships
 * with `'unsafe-inline'` for scripts (and `'unsafe-eval'` for dev HMR) and
 * tightens to a nonce-based policy in a later week when a stable Next nonce
 * pattern is in place. This is a documented, intentional deviation, not an
 * accident.
 *
 * connect-src enumerates the third-party origins the app talks to:
 *   - Resend's API (transactional email)
 *   - Plausible (analytics)
 *   - Inngest (event API + dev server)
 *   - In dev, Mailpit/Inngest dev server on localhost
 *
 * img-src restricts images to UploadThing's CDN (utfs.io) plus self/data/blob.
 * frame-ancestors 'none' blocks clickjacking.
 */
export function buildCsp(): string {
  const isDev = env.NODE_ENV !== 'production';

  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (isDev) scriptSrc.push("'unsafe-eval'"); // HMR / Turbopack
  scriptSrc.push('https://plausible.io');

  const connectSrc = [
    "'self'",
    'https://api.resend.com',
    'https://plausible.io',
    'https://api.inngest.com',
  ];
  if (isDev) {
    // Inngest dev server, Vercel-style HMR sockets, etc.
    connectSrc.push('http://localhost:8288', 'ws://localhost:*');
  }

  const directives: string[] = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://utfs.io`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src ${connectSrc.join(' ')}`,
    `frame-ancestors 'none'`,
    `frame-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ];
  if (!isDev) {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}

/**
 * Standard set of security response headers for HTML responses.
 * X-Frame-Options is redundant with frame-ancestors but kept for
 * older-browser coverage.
 */
export function buildSecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security':
      env.NODE_ENV === 'production' ? 'max-age=31536000; includeSubDomains' : '',
  };
}
