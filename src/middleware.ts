import { NextResponse, type NextRequest } from 'next/server';
import { auth } from './lib/auth';
import { limits, type LimitName, type LimitResult } from './lib/ratelimit';
import { buildSecurityHeaders } from './lib/security/csp';

/**
 * Edge-equivalent middleware. Runs in the Node runtime (see config.runtime
 * below) so ioredis works for local rate-limit testing; Upstash REST works
 * here too for production.
 *
 * Three responsibilities, in order:
 *  1. IP-based rate limits on auth + public-link routes per
 *     docs/security/rate-limiting.md.
 *  2. Auth gate for /(app)/* routes — redirect to /login when no session.
 *  3. Security response headers (CSP, X-Frame-Options, etc.) on every
 *     non-static response.
 */

// Authenticated app prefixes. Hitting any of these without a session
// redirects to /login?callbackUrl=<path>.
const AUTH_REQUIRED_PREFIXES = [
  '/dashboard',
  '/today',
  '/clients',
  '/projects',
  '/proposals',
  '/invoices',
  '/time',
  '/settings',
  '/onboarding',
];

function isAuthRequired(pathname: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return '0.0.0.0';
}

/** Map a request path to the rate-limit rule it should hit, if any. */
function rateLimitFor(pathname: string, method: string): LimitName | null {
  // POST to the credentials callback IS the login submission. Apply loginIp
  // here so brute-force attempts are throttled.
  if (pathname === '/api/auth/callback/credentials' && method === 'POST') {
    return 'loginIp';
  }
  if (pathname === '/login') return 'loginIp';
  if (pathname === '/signup') return 'signupIp';
  if (pathname === '/forgot-password') return 'forgotPasswordIp';
  if (pathname.startsWith('/reset-password/')) return 'resetPasswordIp';
  if (pathname.startsWith('/verify-email/')) return 'verifyEmailIp';
  if (pathname.startsWith('/p/') || pathname.startsWith('/i/')) return 'publicView';
  return null;
}

function rateLimited(result: LimitResult): NextResponse | null {
  if (result.success) return null;
  return new NextResponse('Too many requests', {
    status: 429,
    headers: { 'Retry-After': String(result.retryAfterSeconds) },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Rate limits
  const rule = rateLimitFor(pathname, request.method);
  if (rule) {
    const ip = getClientIp(request);
    // Public-view is keyed on token + IP to avoid one shared link locking
    // out a whole NAT (per docs/security/rate-limiting.md).
    const key = rule === 'publicView' ? `${pathname}:${ip}` : ip;
    const result = await limits[rule].limit(key);
    const blocked = rateLimited(result);
    if (blocked) return blocked;
  }

  // 2) Auth gate
  if (isAuthRequired(pathname)) {
    const session = await auth();
    if (!session?.user?.id) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3) Security headers on the forwarded response
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(buildSecurityHeaders())) {
    if (value) response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Node runtime: middleware needs ioredis (Node net) for the local rate-limit
  // backend. Upstash REST works here too.
  runtime: 'nodejs',
  // Match everything except Next internals, static assets, and static files.
  // We DO match /api/auth/* so the credentials-callback POST flows through.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
};
