import { hashPassword } from '../../src/lib/auth/password';
import { prisma } from '../../src/lib/prisma';

let userCounter = 0;

export type CreateUserOverrides = {
  email?: string;
  name?: string;
  password?: string;
  /** Schema field is `emailVerifiedAt`. null = unverified. Default = now. */
  emailVerifiedAt?: Date | null;
};

/**
 * Create a verified user with a real bcrypt hash by default. Tests that
 * exercise the email-verification gate should pass `emailVerifiedAt: null`.
 */
export async function createTestUser(overrides: CreateUserOverrides = {}) {
  userCounter += 1;
  const email = overrides.email ?? `user-${Date.now()}-${userCounter}@test.local`;
  const password = overrides.password ?? 'testpassword12';
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      email,
      name: overrides.name ?? `Test User ${userCounter}`,
      passwordHash,
      emailVerifiedAt:
        overrides.emailVerifiedAt === undefined ? new Date() : overrides.emailVerifiedAt,
    },
  });
}
