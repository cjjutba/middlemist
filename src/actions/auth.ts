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
import type { ActionResult } from '@/lib/auth/with-auth';
import { writeAudit } from '@/lib/audit/write';
import { sendEmail } from '@/lib/email/send';
import EmailVerify from '@/lib/email/templates/auth/email-verify';
import PasswordReset from '@/lib/email/templates/auth/password-reset';
import { env } from '@/lib/env';
import { usersRepo } from '@/lib/repositories/users.repo';

/**
 * Auth server actions. These are NOT withAuth-wrapped because by definition
 * they pre-date the session (signup, login) or operate on a token rather
 * than a session (verify, reset). They return the same ActionResult shape
 * as withAuth-wrapped actions for UI consistency.
 *
 * Token semantics — JWTs signed with AUTH_SECRET, no token table:
 *   - email-verify: User.emailVerifiedAt set on first redemption.
 *   - password-reset: User.passwordVersion bumped on first redemption.
 *
 * Anti-enumeration: requestPasswordReset always returns ok regardless of
 * whether the email matches a row.
 *
 * Audit log: signup writes user.signup; resetPassword writes
 * user.password-changed. requestPasswordReset deliberately does NOT write
 * an audit entry — doing so would let a probing attacker correlate request
 * timing with row existence.
 */

const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

// ─── signup ───────────────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
});

export async function signup(input: z.input<typeof signupSchema>): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION', issues: parsed.error.issues };
  }
  const validation = validatePassword(parsed.data.password);
  if (!validation.valid) {
    return { ok: false, error: 'VALIDATION' };
  }

  const existing = await usersRepo.findByEmail(parsed.data.email);
  if (existing) {
    return { ok: false, error: 'EMAIL_TAKEN' };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await usersRepo.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
  });

  await writeAudit({
    userId: user.id,
    action: 'user.signup',
    entityType: 'user',
    entityId: user.id,
  });

  const token = await signEmailVerifyToken(user.id, user.email);
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/verify-email/${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Middlemist email',
    react: EmailVerify({ name: user.name, verifyUrl, expiresInHours: VERIFICATION_TTL_HOURS }),
  });

  return { ok: true, data: undefined };
}

// ─── verify email ─────────────────────────────────────────────────────────

const verifyEmailSchema = z.object({ token: z.string().min(1) });

export async function verifyEmail(
  input: z.input<typeof verifyEmailSchema>,
): Promise<ActionResult<{ alreadyVerified: boolean }>> {
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  let payload;
  try {
    payload = await verifyEmailVerifyToken(parsed.data.token);
  } catch {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  const user = await usersRepo.findById(payload.userId);
  if (!user) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }
  if (user.email !== payload.email) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  if (user.emailVerifiedAt) {
    return { ok: true, data: { alreadyVerified: true } };
  }

  await usersRepo.setEmailVerifiedAt(user.id);

  return { ok: true, data: { alreadyVerified: false } };
}

// ─── request password reset ──────────────────────────────────────────────

const requestPasswordResetSchema = z.object({ email: z.string().email().max(254) });

export async function requestPasswordReset(
  input: z.input<typeof requestPasswordResetSchema>,
): Promise<ActionResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    // Anti-enumeration: don't reveal validation failure either.
    return { ok: true, data: undefined };
  }

  const user = await usersRepo.findByEmail(parsed.data.email);
  if (!user || !user.emailVerifiedAt) {
    return { ok: true, data: undefined };
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

  return { ok: true, data: undefined };
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
    return { ok: false, error: 'VALIDATION', issues: parsed.error.issues };
  }
  const validation = validatePassword(parsed.data.password);
  if (!validation.valid) {
    return { ok: false, error: 'VALIDATION' };
  }

  let payload;
  try {
    payload = await verifyPasswordResetToken(parsed.data.token);
  } catch {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  const user = await usersRepo.findById(payload.userId);
  if (!user) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }
  if (user.passwordVersion !== payload.passwordVersion) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await usersRepo.setPasswordHash(user.id, passwordHash);

  await writeAudit({
    userId: user.id,
    action: 'user.password-changed',
    entityType: 'user',
    entityId: user.id,
  });

  return { ok: true, data: undefined };
}

// ─── login / logout ──────────────────────────────────────────────────────

export async function login(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, error: 'VALIDATION' };
  }
  try {
    await signIn('credentials', { email, password, redirect: false });
    return { ok: true, data: undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'EMAIL_NOT_VERIFIED' || message.includes('EMAIL_NOT_VERIFIED')) {
      return { ok: false, error: 'EMAIL_NOT_VERIFIED' };
    }
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
