/**
 * Application-level error classes.
 *
 * Layer conventions per docs/engineering/error-handling.md:
 * - Repository: returns null on read miss; throws bare Error('CODE') on
 *   mutation miss. Service translates to typed errors.
 * - Service: throws typed errors (NotFoundError, ConflictError,
 *   ValidationError, ForbiddenError, IntegrationError).
 * - Server action wrapper: catches every throw via isAppError + bare-Error
 *   code parsing; converts to discriminated ActionResult.
 * - UI: maps result.error code to user-facing string via friendlyMessage().
 */

export class AppError extends Error {
  readonly code: string;
  readonly statusHint: number;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    message?: string,
    opts: { statusHint?: number; meta?: Record<string, unknown> } = {},
  ) {
    super(message ?? code);
    this.name = this.constructor.name;
    this.code = code;
    this.statusHint = opts.statusHint ?? 400;
    if (opts.meta !== undefined) {
      this.meta = opts.meta;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string = 'NOT_FOUND', message?: string) {
    super(code, message, { statusHint: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(code: string = 'CONFLICT', message?: string) {
    super(code, message, { statusHint: 409 });
  }
}

export class ValidationError extends AppError {
  constructor(code: string = 'VALIDATION', message?: string, meta?: Record<string, unknown>) {
    super(code, message, { statusHint: 400, ...(meta ? { meta } : {}) });
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string = 'FORBIDDEN', message?: string) {
    super(code, message, { statusHint: 403 });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMITED', 'Slow down a little.', {
      statusHint: 429,
      meta: { retryAfter },
    });
  }
}

export class IntegrationError extends AppError {
  constructor(provider: string, cause?: unknown) {
    super(`INTEGRATION_${provider.toUpperCase()}`, `Provider ${provider} call failed.`, {
      statusHint: 502,
      meta: { provider, cause: cause instanceof Error ? cause.message : String(cause) },
    });
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** User-facing copy for known error codes. Centralized to keep wording consistent. */
const friendly: Record<string, string> = {
  UNAUTHENTICATED: 'Please log in and try again.',
  RATE_LIMITED: "You're moving fast. Try again in a few seconds.",
  UNEXPECTED: 'Something went wrong on our side. Try again, or reach out if it keeps happening.',
  VALIDATION: 'Please check your inputs and try again.',

  // Auth
  EMAIL_TAKEN: 'An account with that email already exists.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  INVALID_TOKEN: 'This link is invalid or has expired.',

  // Resource not-found
  CLIENT_NOT_FOUND: 'That client no longer exists.',
  PROJECT_NOT_FOUND: 'That project no longer exists.',
  PROPOSAL_NOT_FOUND: 'That proposal no longer exists.',
  INVOICE_NOT_FOUND: 'That invoice no longer exists.',
  USER_NOT_FOUND: 'That account no longer exists.',
};

export function friendlyMessage(code: string): string {
  return friendly[code] ?? 'Something went wrong. Please try again.';
}
