import type { z } from 'zod';
import { isAppError } from '../utils/errors';
import { auth } from './index';

/**
 * Server-action wrapper. The standard entry point for every authenticated
 * action in src/actions/.
 *
 * Per docs/engineering/server-actions.md:
 *  1. Extract userId from the Auth.js session (return UNAUTHENTICATED if missing).
 *  2. Validate the raw input with the provided zod schema.
 *  3. Call the handler with (userId, parsed input).
 *  4. Catch any throw and convert to a discriminated ActionResult envelope.
 *
 * userId is NEVER accepted from client input. The wrapper is the single
 * place it enters an action. Forms cannot pass it.
 *
 * Stack traces never reach the UI: AppError throws are translated to their
 * `code`; bare-Error throws with a string `code` (used by repos for
 * cross-tenant misses like CLIENT_NOT_FOUND) are forwarded; anything else
 * is logged server-side and surfaced as UNEXPECTED.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: z.ZodIssue[] };

export function withAuth<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (userId: string, input: TInput) => Promise<TOutput>,
): (rawInput: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput: unknown) => {
    const session = await auth();
    if (!session?.user?.id) {
      return { ok: false, error: 'UNAUTHENTICATED' };
    }

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? 'INVALID_INPUT';
      return { ok: false, error: first, issues: parsed.error.issues };
    }

    try {
      const data = await handler(session.user.id, parsed.data);
      return { ok: true, data };
    } catch (e) {
      if (isAppError(e)) {
        return { ok: false, error: e.code };
      }
      if (e instanceof Error) {
        const codeField = (e as unknown as { code?: unknown }).code;
        if (typeof codeField === 'string') {
          return { ok: false, error: codeField };
        }
      }
      if (e instanceof Error) {
        // Repository-style bare Error('CODE') — message IS the code.
        if (/^[A-Z][A-Z0-9_]+$/.test(e.message)) {
          return { ok: false, error: e.message };
        }
      }
      // Unknown throw — log server-side, surface a generic code.
      // Sentry capture lands in a later week; for now stderr is sufficient.
      console.error('server action failed:', e);
      return { ok: false, error: 'UNEXPECTED' };
    }
  };
}
