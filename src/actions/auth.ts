'use server';

import { z } from 'zod';
import { signIn, signOut } from '@/lib/auth';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import {
  signEmailVerifyToken,
  signPasswordResetToken,
  verifyEmailVerifyToken,
  verifyPasswordResetToken,
} from '@/lib/auth/tokens';
import { sendEmail } from '@/lib/email/send';
import EmailVerify from '@/lib/email/templates/auth/email-verify';
import PasswordReset from '@/lib/email/templates/auth/password-reset';
import { env } from '@/lib/env';
// Direct prisma access here is intentional and temporary; refactored to a
// users.repo.ts in 2C. The lint rule allowlist exempts this file.
import { prisma } from '@/lib/prisma';

/**
 * Auth server actions.
 *
 * Tokens are JWTs signed with AUTH_SECRET (no token table; see
 * docs/spec/01-auth-and-account.md). Single-use:
 *   - email-verify: User.emailVerifiedAt set on first redemption.
 *   - password-reset: User.passwordVersion bumped on first redemption.
 *
 * Anti-enumeration: requestPasswordReset always returns ok regardless of
 * whether the email matches a row.
 */

const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: { code: string; message: string } };

// ─── signup ───────────────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
});

export async function signup(input: z.input<typeof signupSchema>): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION', message: 'Invalid input.' } };
  }
  const validation = validatePassword(parsed.data.password);
  if (!validation.valid) {
    return { ok: false, error: { code: 'VALIDATION', message: validation.message } };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      error: { code: 'EMAIL_TAKEN', message: 'An account with that email already exists.' },
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
    },
    select: { id: true, name: true, email: true },
  });

  const token = await signEmailVerifyToken(user.id, user.email);
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email/${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Verify your Middlemist email',
    react: EmailVerify({ name: user.name, verifyUrl, expiresInHours: VERIFICATION_TTL_HOURS }),
  });

  return { ok: true };
}

// ─── verify email ─────────────────────────────────────────────────────────

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export async function verifyEmail(
  input: z.input<typeof verifyEmailSchema>,
): Promise<ActionResult<{ alreadyVerified: boolean }>> {
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_TOKEN', message: 'Invalid verification link.' } };
  }

  let payload;
  try {
    payload = await verifyEmailVerifyToken(parsed.data.token);
  } catch {
    return {
      ok: false,
      error: { code: 'INVALID_TOKEN', message: 'Verification link is invalid or expired.' },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user) {
    return { ok: false, error: { code: 'INVALID_TOKEN', message: 'Account not found.' } };
  }
  if (user.email !== payload.email) {
    return {
      ok: false,
      error: { code: 'INVALID_TOKEN', message: 'Verification link is no longer valid.' },
    };
  }

  if (user.emailVerifiedAt) {
    return { ok: true, data: { alreadyVerified: true } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });

  return { ok: true, data: { alreadyVerified: false } };
}

// ─── request password reset ──────────────────────────────────────────────

const requestPasswordResetSchema = z.object({
  email: z.string().email().max(254),
});

export async function requestPasswordReset(
  input: z.input<typeof requestPasswordResetSchema>,
): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: true };
  }
  const email = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordVersion: true, emailVerifiedAt: true },
  });
  if (!user || !user.emailVerifiedAt) {
    return { ok: true };
  }

  const token = await signPasswordResetToken(user.id, user.passwordVersion);
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Reset your Middlemist password',
    react: PasswordReset({
      name: user.name,
      resetUrl,
      expiresInHours: RESET_TTL_HOURS,
    }),
  });

  return { ok: true };
}

// ─── reset password ──────────────────────────────────────────────────────

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12).max(128),
});

export async function resetPassword(
  input: z.input<typeof resetPasswordSchema>,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION', message: 'Invalid input.' } };
  }

  const validation = validatePassword(parsed.data.password);
  if (!validation.valid) {
    return { ok: false, error: { code: 'VALIDATION', message: validation.message } };
  }

  let payload;
  try {
    payload = await verifyPasswordResetToken(parsed.data.token);
  } catch {
    return {
      ok: false,
      error: { code: 'INVALID_TOKEN', message: 'Reset link is invalid or expired.' },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, passwordVersion: true },
  });
  if (!user) {
    return { ok: false, error: { code: 'INVALID_TOKEN', message: 'Account not found.' } };
  }
  if (user.passwordVersion !== payload.passwordVersion) {
    return {
      ok: false,
      error: { code: 'INVALID_TOKEN', message: 'Reset link has already been used.' },
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordVersion: { increment: 1 },
    },
  });

  return { ok: true };
}

// ─── login / logout ──────────────────────────────────────────────────────

export async function login(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, error: { code: 'VALIDATION', message: 'Invalid input.' } };
  }
  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN';
    if (message === 'EMAIL_NOT_VERIFIED' || message.includes('EMAIL_NOT_VERIFIED')) {
      return {
        ok: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Verify your email to continue. Check your inbox for the verification link.',
        },
      };
    }
    return {
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
    };
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
