'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit/write';
import { withAuth } from '@/lib/auth/with-auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { usersRepo } from '@/lib/repositories/users.repo';
import { SUPPORTED_CURRENCIES } from '@/lib/schemas/client.schema';

const businessSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required').max(120),
});

const currencySchema = z.object({
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES),
});

const firstClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email').max(254),
  companyName: z.string().trim().max(120).optional(),
});

const noInputSchema = z.object({}).default({});

export const saveBusinessName = withAuth(businessSchema, async (userId, input) => {
  await usersRepo.setBusinessProfile(userId, { businessName: input.businessName });
  await writeAudit({
    userId,
    action: 'onboarding.business',
    entityType: 'user',
    entityId: userId,
  });
  return { ok: true } as const;
});

export const saveDefaultCurrency = withAuth(currencySchema, async (userId, input) => {
  await usersRepo.setBusinessProfile(userId, { defaultCurrency: input.defaultCurrency });
  await writeAudit({
    userId,
    action: 'onboarding.currency',
    entityType: 'user',
    entityId: userId,
  });
  return { ok: true } as const;
});

export const createFirstClient = withAuth(firstClientSchema, async (userId, input) => {
  const client = await clientsRepo.create(userId, {
    name: input.name,
    email: input.email,
    companyName: input.companyName ?? null,
  });
  await writeAudit({
    userId,
    action: 'client.created',
    entityType: 'client',
    entityId: client.id,
  });
  return { id: client.id };
});

export const completeOnboarding = withAuth(noInputSchema, async (userId) => {
  await usersRepo.markOnboardingComplete(userId);
  await writeAudit({
    userId,
    action: 'onboarding.completed',
    entityType: 'user',
    entityId: userId,
  });
  revalidatePath('/dashboard');
  return { ok: true } as const;
});
