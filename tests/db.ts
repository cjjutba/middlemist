import { prisma } from '../src/lib/prisma';

/**
 * Truncate every tenant-scoped table. Used by integration tests in
 * beforeEach so each test starts from a clean state.
 *
 * CASCADE handles FK ordering. RESTART IDENTITY resets sequence counters
 * (none of our cuid PKs use sequences, but harmless and safe for any
 * future serial columns).
 *
 * Tables match prisma/schema.prisma. Keep in sync when models are added.
 * v1 has 19 models; tokens are JWT-shaped, no token tables.
 */
const TENANT_TABLES = [
  'AuditLog',
  'NotificationRead',
  'ClientPortalSession',
  'InvoiceLineItem',
  'Invoice',
  'ProposalTemplate',
  'SavedPricingItem',
  'SavedBlock',
  'Proposal',
  'UpdateAttachment',
  'Update',
  'TimeEntry',
  'Task',
  'Project',
  'Client',
  'EmailSettings',
  'InvoiceReminderConfig',
  'FxRate',
  'User',
];

export async function resetDb(): Promise<void> {
  const list = TENANT_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
