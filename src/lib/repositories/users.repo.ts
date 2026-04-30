import { prisma, type Currency } from '../prisma';

/**
 * User repository.
 *
 * The User table is the root of the multi-tenant tree. Per
 * docs/architecture/multi-tenancy.md, every per-tenant repo takes userId
 * as the first arg; for the User repo itself, the userId IS the row's id.
 *
 * findById/findByEmail are NOT tenant-scoped (they are part of the auth
 * flow that resolves who the tenant IS).
 */

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash?: string | null;
};

export const usersRepo = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  /** Case-normalized email lookup. Used by login, signup uniqueness, password reset. */
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  },

  async create(input: CreateUserInput) {
    return prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase().trim(),
        passwordHash: input.passwordHash ?? null,
      },
    });
  },

  /**
   * Set a new password hash AND bump passwordVersion in one update. Bumping
   * the version invalidates every outstanding password-reset JWT for this
   * user (per docs/security/authentication.md). Used for both reset and
   * change flows.
   */
  async setPasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordVersion: { increment: 1 },
      },
    });
  },

  async setEmailVerifiedAt(userId: string, at: Date = new Date()) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: at },
    });
  },

  async setEmail(userId: string, newEmail: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { email: newEmail.toLowerCase().trim() },
    });
  },

  async update(
    userId: string,
    input: Partial<{
      name: string;
      businessName: string | null;
      businessAddress: string | null;
      businessTaxId: string | null;
      logoUrl: string | null;
      signatureUrl: string | null;
      defaultCurrency: Currency;
      defaultTimezone: string;
      onboardingDoneAt: Date | null;
    }>,
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: input,
    });
  },

  async markDeleted(userId: string, deletedAt: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { deletedAt },
    });
  },

  async clearDeleted(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
  },
};
