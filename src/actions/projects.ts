'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit/write';
import { withAuth } from '@/lib/auth/with-auth';
import { projectsRepo } from '@/lib/repositories/projects.repo';
import {
  createProjectSchema,
  setProjectStatusSchema,
  updateProjectSchema,
} from '@/lib/schemas/project.schema';

const updateInputSchema = z.object({ id: z.string().min(1) }).and(updateProjectSchema);
const idOnlySchema = z.object({ id: z.string().min(1) });

function toDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toBudget(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export const createProject = withAuth(createProjectSchema, async (userId, input) => {
  const startedAt = toDate(input.startedAt);
  const endedAt = toDate(input.endedAt);
  const budgetAmount = toBudget(input.budgetAmount);
  const project = await projectsRepo.create(userId, {
    clientId: input.clientId,
    name: input.name,
    currency: input.currency,
    description: input.description ?? null,
    ...(input.status ? { status: input.status } : {}),
    ...(budgetAmount !== undefined ? { budgetAmount } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
  });
  await writeAudit({
    userId,
    action: 'project.created',
    entityType: 'project',
    entityId: project.id,
  });
  revalidatePath('/projects');
  return { id: project.id };
});

export const updateProject = withAuth(updateInputSchema, async (userId, input) => {
  const { id, ...rest } = input;
  const project = await projectsRepo.update(userId, id, {
    ...(rest.name !== undefined ? { name: rest.name } : {}),
    ...(rest.description !== undefined ? { description: rest.description ?? null } : {}),
    ...(rest.status !== undefined ? { status: rest.status } : {}),
    ...(rest.currency !== undefined ? { currency: rest.currency } : {}),
    ...(rest.budgetAmount !== undefined
      ? { budgetAmount: toBudget(rest.budgetAmount) ?? null }
      : {}),
    ...(rest.startedAt !== undefined ? { startedAt: toDate(rest.startedAt) ?? null } : {}),
    ...(rest.endedAt !== undefined ? { endedAt: toDate(rest.endedAt) ?? null } : {}),
  });
  await writeAudit({
    userId,
    action: 'project.updated',
    entityType: 'project',
    entityId: project.id,
  });
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return { id: project.id };
});

export const setProjectStatus = withAuth(setProjectStatusSchema, async (userId, input) => {
  const project = await projectsRepo.setStatus(userId, input.id, input.status);
  await writeAudit({
    userId,
    action: 'project.status-changed',
    entityType: 'project',
    entityId: project.id,
    metadata: { status: input.status },
  });
  revalidatePath('/projects');
  revalidatePath(`/projects/${input.id}`);
  return { id: project.id };
});

export const archiveProject = withAuth(idOnlySchema, async (userId, { id }) => {
  await projectsRepo.archive(userId, id);
  await writeAudit({
    userId,
    action: 'project.archived',
    entityType: 'project',
    entityId: id,
  });
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return { id };
});

export const unarchiveProject = withAuth(idOnlySchema, async (userId, { id }) => {
  await projectsRepo.unarchive(userId, id);
  await writeAudit({
    userId,
    action: 'project.unarchived',
    entityType: 'project',
    entityId: id,
  });
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return { id };
});
