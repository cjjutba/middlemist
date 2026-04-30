import { z } from 'zod';

/**
 * Action → metadata zod schema map.
 *
 * Per docs/architecture/audit-log.md, every audit action has a metadata
 * shape and the writer validates against it before insert. Adding a new
 * action means adding a row here first.
 *
 * v1 starts with the auth events. Other modules add their actions when
 * they land in 2D and beyond.
 */

const empty = z.object({}).strict();

export const actionRegistry: Record<string, z.ZodSchema> = {
  // User
  'user.signup': empty,
  'user.login': empty,
  'user.password-changed': empty,
  'user.email-changed': z.object({ from: z.string().email(), to: z.string().email() }).strict(),
  'user.account-deleted': empty,
  'user.account-deletion-cancelled': empty,

  // Client
  'client.created': empty,
  'client.updated': empty,
  'client.archived': empty,
  'client.unarchived': empty,
  'client.deleted': empty,

  // Project (registered now; actions land in 3C)
  'project.created': empty,
  'project.updated': empty,
  'project.status-changed': z
    .object({ from: z.string(), to: z.string() })
    .strict()
    .or(z.object({ status: z.string() }).strict()),
  'project.archived': empty,
  'project.unarchived': empty,

  // Onboarding (lands in 3D)
  'onboarding.business': empty,
  'onboarding.currency': empty,
  'onboarding.completed': empty,
};

export type AuditActionName = keyof typeof actionRegistry;
