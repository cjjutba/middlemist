import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env';

/**
 * Verification and password-reset tokens are signed JWTs (HS256, AUTH_SECRET).
 *
 * No token table is used. Per docs/security/authentication.md and
 * docs/spec/01-auth-and-account.md, single-use is enforced by:
 *
 *   - email-verify: redeeming sets User.emailVerifiedAt; the second click
 *     finds it already set and treats the link as already-redeemed.
 *
 *   - password-reset: each successful reset bumps User.passwordVersion;
 *     the second click finds payload.passwordVersion no longer matches
 *     the row and is rejected.
 *
 * AUTH_SECRET rotation invalidates every outstanding token of either kind.
 */

const secret = new TextEncoder().encode(env.AUTH_SECRET);

const VERIFY_TTL = '24h';
const RESET_TTL = '1h';

type EmailVerifyPayload = { purpose: 'email-verify'; userId: string; email: string };
type PasswordResetPayload = {
  purpose: 'password-reset';
  userId: string;
  passwordVersion: number;
};

export async function signEmailVerifyToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ purpose: 'email-verify', userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(VERIFY_TTL)
    .sign(secret);
}

export async function verifyEmailVerifyToken(token: string): Promise<EmailVerifyPayload> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  if (payload['purpose'] !== 'email-verify') {
    throw new Error('WRONG_PURPOSE');
  }
  const userId = payload['userId'];
  const email = payload['email'];
  if (typeof userId !== 'string' || typeof email !== 'string') {
    throw new Error('MALFORMED_PAYLOAD');
  }
  return { purpose: 'email-verify', userId, email };
}

export async function signPasswordResetToken(
  userId: string,
  passwordVersion: number,
): Promise<string> {
  return new SignJWT({ purpose: 'password-reset', userId, passwordVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(RESET_TTL)
    .sign(secret);
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetPayload> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  if (payload['purpose'] !== 'password-reset') {
    throw new Error('WRONG_PURPOSE');
  }
  const userId = payload['userId'];
  const passwordVersion = payload['passwordVersion'];
  if (typeof userId !== 'string' || typeof passwordVersion !== 'number') {
    throw new Error('MALFORMED_PAYLOAD');
  }
  return { purpose: 'password-reset', userId, passwordVersion };
}
