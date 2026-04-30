import { prisma, type Currency } from '../prisma';

/**
 * Client repository — the canonical multi-tenant repo example.
 *
 * EVERY public function takes userId as its first arg and includes it in
 * every Prisma where clause. This is the load-bearing mechanism of
 * Middlemist's multi-tenancy (docs/architecture/multi-tenancy.md). Direct
 * prisma.client.* access elsewhere is forbidden by ESLint.
 *
 * Two patterns to recognize:
 *  - findFirst({ id, userId }) over findUnique({ id }): cross-tenant
 *    lookups return null instead of leaking another tenant's row.
 *  - updateMany({ id, userId }, data) + count check over update({ id }):
 *    cross-tenant mutations result in count=0 (a no-op) instead of
 *    throwing P2025 (which would leak that the row exists for someone).
 */

export type CreateClientInput = {
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  preferredCurrency?: Currency | null;
};

export type UpdateClientInput = Partial<{
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  preferredCurrency: Currency | null;
}>;

export type ListClientsFilters = {
  search?: string;
  includeArchived?: boolean;
};

export const clientsRepo = {
  async findById(userId: string, id: string) {
    return prisma.client.findFirst({
      where: { id, userId },
    });
  },

  async list(userId: string, filters: ListClientsFilters = {}) {
    return prisma.client.findMany({
      where: {
        userId,
        ...(filters.includeArchived ? {} : { archivedAt: null }),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { companyName: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  },

  async create(userId: string, input: CreateClientInput) {
    return prisma.client.create({
      data: { ...input, userId },
    });
  },

  async update(userId: string, id: string, input: UpdateClientInput) {
    const result = await prisma.client.updateMany({
      where: { id, userId },
      data: input,
    });
    if (result.count === 0) throw new Error('CLIENT_NOT_FOUND');
    const updated = await this.findById(userId, id);
    if (!updated) throw new Error('CLIENT_NOT_FOUND');
    return updated;
  },

  async archive(userId: string, id: string) {
    const result = await prisma.client.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) throw new Error('CLIENT_NOT_FOUND');
  },

  async unarchive(userId: string, id: string) {
    const result = await prisma.client.updateMany({
      where: { id, userId, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    if (result.count === 0) throw new Error('CLIENT_NOT_FOUND');
  },

  /**
   * Hard-delete. Per docs/spec/03-clients.md, delete fails if the client has
   * projects/proposals/invoices (FK Restrict). Caller should catch and
   * surface CLIENT_HAS_REFERENCES so the UI can suggest archive instead.
   */
  async delete(userId: string, id: string) {
    const result = await prisma.client.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new Error('CLIENT_NOT_FOUND');
  },
};
