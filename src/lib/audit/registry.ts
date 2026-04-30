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
};

export type AuditActionName = keyof typeof actionRegistry;
