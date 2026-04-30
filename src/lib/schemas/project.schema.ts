import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from './client.schema';

// Schema enum is snake_case 'on_hold' (per data-model.md).
export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'archived'] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];

// Statuses a user can pick in a form. 'archived' is a lifecycle state set by
// the Archive button (which writes archivedAt), not a status the form chooses.
export const SELECTABLE_STATUSES = ['active', 'on_hold', 'completed'] as const;

const optionalString = (max: number) => z.string().trim().max(max).optional();

// Date and number fields stay as plain strings here so the resolver's input
// type matches the output (zodResolver under exactOptionalPropertyTypes
// breaks otherwise). The action layer converts to Date / number.
export const createProjectSchema = z.object({
  clientId: z.string().min(1, 'Pick a client'),
  name: z.string().trim().min(1, 'Name is required').max(160),
  description: optionalString(5000),
  status: z.enum(SELECTABLE_STATUSES).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  budgetAmount: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === undefined || v === '' || !Number.isNaN(Number(v)), 'Must be a number'),
  startedAt: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === undefined || v === '' || !Number.isNaN(Date.parse(v)), 'Invalid date'),
  endedAt: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === undefined || v === '' || !Number.isNaN(Date.parse(v)), 'Invalid date'),
});

export const updateProjectSchema = createProjectSchema.partial().omit({ clientId: true });

export const setProjectStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(SELECTABLE_STATUSES),
});

export type CreateProjectInputZ = z.infer<typeof createProjectSchema>;
export type UpdateProjectInputZ = z.infer<typeof updateProjectSchema>;
