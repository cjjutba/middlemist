import type { Currency, Project, ProjectStatus } from '../../src/lib/prisma';
import { projectsRepo } from '../../src/lib/repositories/projects.repo';

let projectCounter = 0;

export type CreateProjectOverrides = {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  currency?: Currency;
};

export async function createTestProject(
  userId: string,
  clientId: string,
  overrides: CreateProjectOverrides = {},
): Promise<Project> {
  projectCounter += 1;
  return projectsRepo.create(userId, {
    clientId,
    name: overrides.name ?? `Test Project ${projectCounter}`,
    currency: overrides.currency ?? 'USD',
    ...(overrides.description !== undefined ? { description: overrides.description } : {}),
    ...(overrides.status !== undefined ? { status: overrides.status } : {}),
  });
}
