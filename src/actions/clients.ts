'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { writeAudit } from '@/lib/audit/write';
import { withAuth } from '@/lib/auth/with-auth';
import { clientsRepo, type CreateClientInput } from '@/lib/repositories/clients.repo';
import { createClientSchema, updateClientSchema } from '@/lib/schemas/client.schema';

const updateInputSchema = z.object({ id: z.string().min(1) }).and(updateClientSchema);
const idOnlySchema = z.object({ id: z.string().min(1) });

/**
 * Convert form-shaped input (HTML inputs send '' for empty) into repo-shaped
 * input (null for absent fields). Plus narrows preferredCurrency from
 * `'' | Currency | undefined` to `Currency | null`.
 */
function toRepoCreate(parsed: z.infer<typeof createClientSchema>): CreateClientInput {
  const blank = (v: string | undefined) => (v && v.length > 0 ? v : null);
  return {
    name: parsed.name,
    email: parsed.email,
    companyName: blank(parsed.companyName),
    phone: blank(parsed.phone),
    website: blank(parsed.website),
    address: blank(parsed.address),
    taxId: blank(parsed.taxId),
    notes: blank(parsed.notes),
    preferredCurrency: parsed.preferredCurrency ? parsed.preferredCurrency : null,
  };
}

function toRepoUpdate(parsed: z.infer<typeof updateClientSchema>): Partial<CreateClientInput> {
  const blank = (v: string | undefined) => (v && v.length > 0 ? v : null);
  const out: Partial<CreateClientInput> = {};
  if (parsed.name !== undefined) out.name = parsed.name;
  if (parsed.email !== undefined) out.email = parsed.email;
  if (parsed.companyName !== undefined) out.companyName = blank(parsed.companyName);
  if (parsed.phone !== undefined) out.phone = blank(parsed.phone);
  if (parsed.website !== undefined) out.website = blank(parsed.website);
  if (parsed.address !== undefined) out.address = blank(parsed.address);
  if (parsed.taxId !== undefined) out.taxId = blank(parsed.taxId);
  if (parsed.notes !== undefined) out.notes = blank(parsed.notes);
  if (parsed.preferredCurrency !== undefined) {
    out.preferredCurrency = parsed.preferredCurrency ? parsed.preferredCurrency : null;
  }
  return out;
}

export const createClient = withAuth(createClientSchema, async (userId, input) => {
  const client = await clientsRepo.create(userId, toRepoCreate(input));
  await writeAudit({
    userId,
    action: 'client.created',
    entityType: 'client',
    entityId: client.id,
  });
  revalidatePath('/clients');
  return { id: client.id };
});

export const updateClient = withAuth(updateInputSchema, async (userId, input) => {
  const { id, ...rest } = input;
  const client = await clientsRepo.update(userId, id, toRepoUpdate(rest));
  await writeAudit({
    userId,
    action: 'client.updated',
    entityType: 'client',
    entityId: client.id,
  });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { id: client.id };
});

export const archiveClient = withAuth(idOnlySchema, async (userId, { id }) => {
  await clientsRepo.archive(userId, id);
  await writeAudit({
    userId,
    action: 'client.archived',
    entityType: 'client',
    entityId: id,
  });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { id };
});

export const unarchiveClient = withAuth(idOnlySchema, async (userId, { id }) => {
  await clientsRepo.unarchive(userId, id);
  await writeAudit({
    userId,
    action: 'client.unarchived',
    entityType: 'client',
    entityId: id,
  });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { id };
});

export const deleteClient = withAuth(idOnlySchema, async (userId, { id }) => {
  try {
    await clientsRepo.delete(userId, id);
  } catch (e) {
    if (e instanceof Error) {
      // Prisma raises code P2003 on FK Restrict (projects/proposals/invoices
      // pointing at this client). Re-raise with the code the UI expects.
      const code = (e as unknown as { code?: unknown }).code;
      if (code === 'P2003') throw new Error('CLIENT_HAS_REFERENCES');
    }
    throw e;
  }
  await writeAudit({
    userId,
    action: 'client.deleted',
    entityType: 'client',
    entityId: id,
  });
  revalidatePath('/clients');
});
