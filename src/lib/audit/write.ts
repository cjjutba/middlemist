// Audit log writer. The single place rows are inserted into AuditLog.
// Per docs/architecture/audit-log.md.
//
// This file is allowlisted alongside src/lib/repositories/** because the
// audit table is a special-case write that doesn't fit the entity-repo
// shape (it doesn't take userId-as-tenant in the same way). The eslint
// rule allowlists src/lib/audit/** for this reason.
import { prisma, type AuditEntityType } from '../prisma';
import { actionRegistry } from './registry';

export type WriteAuditArgs = {
  /** Tenant the entry is scoped to. Null for unauth public-link views. */
  userId: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: unknown;
  ip?: string;
  userAgent?: string;
};

export async function writeAudit(args: WriteAuditArgs): Promise<void> {
  const schema = actionRegistry[args.action];
  if (!schema) {
    throw new Error(`Unknown audit action: ${args.action}`);
  }
  const validated = schema.parse(args.metadata ?? {});

  await prisma.auditLog.create({
    data: {
      userId: args.userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: validated as object,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
    },
  });
}
