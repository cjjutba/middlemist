import { z } from 'zod';

export const SUPPORTED_CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'CAD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// Optional string fields accept '' (HTML form default) and trim. The action
// layer treats '' as null when writing. Keeping input==output makes the
// zodResolver type-compatible with react-hook-form under exactOptionalPropertyTypes.
const optionalString = (max: number) => z.string().trim().max(max).optional();

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  companyName: optionalString(120),
  email: z.string().trim().email('Enter a valid email').max(254),
  phone: optionalString(40),
  website: optionalString(255),
  address: optionalString(500),
  taxId: optionalString(50),
  notes: optionalString(4000),
  preferredCurrency: z.enum(SUPPORTED_CURRENCIES).or(z.literal('')).optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
