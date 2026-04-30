import { env } from '../env';

const APP_HOST = (() => {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).host;
  } catch {
    return 'localhost:3000';
  }
})();

/**
 * Verify a request's Origin matches the application's host.
 *
 * Used on public POST endpoints (proposal accept, etc.) per
 * docs/security/csrf.md. Server Actions have built-in Origin checks; this
 * helper is for non-action routes that read from public clients.
 *
 * Compares hosts (not full origins) so the protocol/port flexibility we
 * accept on Vercel preview deploys works; the threat model is "different
 * site posting against us," which the host check fully addresses.
 */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === APP_HOST;
    } catch {
      return false;
    }
  }
  // Some browsers omit Origin on same-origin POSTs; fall back to Referer.
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === APP_HOST;
    } catch {
      return false;
    }
  }
  return false;
}
