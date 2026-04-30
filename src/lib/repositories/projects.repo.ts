import { type Currency, type Project, type ProjectStatus, prisma } from '../prisma';

/**
 * Project repository — canonical multi-tenant pattern with explicit return types.
 *
 * Per docs/engineering/repository-pattern.md:
 *  - userId is the first arg on every public function
 *  - userId is injected into every Prisma where clause
 *  - Return types are explicit (no implicit Prisma type leakage)
 *
 * Defense-in-depth on create: verifies the clientId belongs to the same user
 * before inserting, so a forged clientId can't attach a project to another
 * tenant's client.
 */

// budgetAmount accepts string|number for ergonomics; Prisma coerces to Decimal.
type DecimalInput = string | number;

export type CreateProjectInput = {
  clientId: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  currency: Currency;
  budgetAmount?: DecimalInput | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
};

export type UpdateProjectInput = Partial<{
  name: string;
  description: string | null;
  status: ProjectStatus;
  currency: Currency;
  budgetAmount: DecimalInput | null;
  startedAt: Date | null;
  endedAt: Date | null;
}>;

export type ListProjectsFilters = {
  status?: ProjectStatus | ProjectStatus[];
  clientId?: string;
  includeArchived?: boolean;
  search?: string;
  limit?: number;
};

export const projectsRepo = {
  async findById(userId: string, id: string): Promise<Project | null> {
    return prisma.project.findFirst({ where: { id, userId } });
  },

  async list(userId: string, filters: ListProjectsFilters = {}): Promise<Project[]> {
    const archivedFilter = filters.includeArchived ? {} : { archivedAt: null };
    const statusFilter = filters.status
      ? Array.isArray(filters.status)
        ? { status: { in: filters.status } }
        : { status: filters.status }
      : {};
    return prisma.project.findMany({
      where: {
        userId,
        ...archivedFilter,
        ...statusFilter,
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      ...(filters.limit ? { take: filters.limit } : {}),
    });
  },

  async listByClient(userId: string, clientId: string): Promise<Project[]> {
    return prisma.project.findMany({
      where: { userId, clientId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async create(userId: string, input: CreateProjectInput): Promise<Project> {
    // Defense-in-depth: confirm the client belongs to this user before
    // creating the project against it.
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, userId },
      select: { id: true },
    });
    if (!client) throw new Error('CLIENT_NOT_FOUND');

    return prisma.project.create({
      data: {
        userId,
        clientId: input.clientId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'active',
        currency: input.currency,
        budgetAmount: input.budgetAmount ?? null,
        startedAt: input.startedAt ?? null,
        endedAt: input.endedAt ?? null,
      },
    });
  },

  async update(userId: string, id: string, input: UpdateProjectInput): Promise<Project> {
    const result = await prisma.project.updateMany({
      where: { id, userId },
      data: input,
    });
    if (result.count === 0) throw new Error('PROJECT_NOT_FOUND');
    const updated = await this.findById(userId, id);
    if (!updated) throw new Error('PROJECT_NOT_FOUND');
    return updated;
  },

  async setStatus(userId: string, id: string, status: ProjectStatus): Promise<Project> {
    return this.update(userId, id, { status });
  },

  async archive(userId: string, id: string): Promise<void> {
    const result = await prisma.project.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) throw new Error('PROJECT_NOT_FOUND');
  },

  async unarchive(userId: string, id: string): Promise<void> {
    const result = await prisma.project.updateMany({
      where: { id, userId, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    if (result.count === 0) throw new Error('PROJECT_NOT_FOUND');
  },
};
