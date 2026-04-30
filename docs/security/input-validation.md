# Input validation

Every input crossing a trust boundary is validated through zod. The trust boundaries are the server action wrapper, the route handlers, the webhook handlers, and the public-route forms. Past the boundary, types are trusted; the rest of the application code does not re-validate. Validating in the middle of business logic is a code smell that points at an unclear boundary, not at insufficient checks.

## Tool

**zod.** Same library on both sides of the wire. Schemas live in `src/lib/schemas/` and are imported by both `react-hook-form` (client) and the server action (server). One source of truth means client UX and server enforcement cannot drift.

## Where schemas live

`src/lib/schemas/` with one file per entity. The naming convention is `<entity>.schema.ts` (kebab-case file, dot-suffix). Each file exports the schemas relevant to that entity's lifecycle.

```
src/lib/schemas/
├── auth.schema.ts          # login, signup, password change, password reset
├── client.schema.ts        # createClient, updateClient
├── project.schema.ts       # createProject, updateProject, archiveProject
├── proposal.schema.ts      # createProposal, sendProposal, acceptProposal (public)
├── invoice.schema.ts       # createInvoice, updateInvoice, markPaid
├── time-entry.schema.ts    # logTime, editTimeEntry
├── update.schema.ts        # postUpdate, editUpdate
├── settings.schema.ts      # profile, businessProfile, emailSettings
├── search.schema.ts        # globalSearch query
└── webhook.schema.ts       # provider-specific webhook payloads
```

The schemas are a layer above the Prisma types. They constrain input more tightly than the database does (length caps, format checks, business rules) and they translate user-facing errors. Prisma types describe the row; zod schemas describe the input.

## Pattern

**Validate once at the boundary. Trust thereafter.**

```typescript
// src/lib/schemas/client.schema.ts
import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  companyName: z.string().max(120).nullable().optional(),
  email: z.string().email("Enter a valid email").max(254),
  phone: z.string().max(40).nullable().optional(),
  website: z
    .string()
    .url("Enter a valid URL")
    .refine(
      (u) => /^https?:\/\//.test(u),
      "URL must use http or https"
    )
    .nullable()
    .optional(),
  address: z.string().max(500).nullable().optional(),
  taxId: z.string().max(40).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  preferredCurrency: z
    .enum(["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "JPY", "SGD"])
    .nullable()
    .optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
```

The schema is shared:

```typescript
// src/components/clients/ClientForm.tsx (client component)
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSchema, type CreateClientInput } from "@/lib/schemas/client.schema";
import { createClient } from "@/actions/clients";

export function ClientForm() {
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { name: "", email: "" },
  });

  async function onSubmit(values: CreateClientInput) {
    const result = await createClient(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    // ...
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>{/* ... */}</form>;
}
```

```typescript
// src/actions/clients.ts (server action)
"use server";
import { withAuth } from "@/lib/auth/with-auth";
import { createClientSchema } from "@/lib/schemas/client.schema";
import { clientsRepo } from "@/lib/repositories/clients.repo";

export const createClient = withAuth(createClientSchema, async (userId, input) => {
  return clientsRepo.create(userId, input);
});
```

The wrapper runs `createClientSchema.safeParse(rawInput)` before passing parsed input to the handler. If the parse fails, the wrapper returns `{ ok: false, error: <issue.message> }`. If it succeeds, the handler sees `input` already typed as `CreateClientInput`.

## Philosophy

**Client-side validation is UX. Server-side validation is security.**

Client-side validation gives the user immediate feedback ("Email is required," "Must be at least 12 characters") without a round-trip. It is not a security control. A determined attacker bypasses the client form by calling the server action directly with arbitrary payload. That is fine — the server-side parse runs the same schema and rejects the same way.

This split is why the schema lives in `src/lib/schemas/` (consumed by both sides) rather than in the form component. The form imports the schema for its resolver; the action imports the same schema for its parse. They cannot drift.

## Examples

### Server action wrapper running `safeParse`

```typescript
// src/lib/auth/with-auth.ts (excerpt)
import { z } from "zod";

export function withAuth<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (userId: string, input: TInput) => Promise<TOutput>
) {
  return async (rawInput: unknown) => {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "UNAUTHENTICATED" } as const;

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "INVALID_INPUT",
      } as const;
    }

    try {
      const data = await handler(session.user.id, parsed.data);
      return { ok: true, data } as const;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
      } as const;
    }
  };
}
```

`safeParse` returns `success: false` plus an issues array on failure rather than throwing. The wrapper picks the first issue's message; multi-field errors are surfaced as the most relevant one. For form-level error reporting that lights up multiple fields, the action returns the full `issues` array as `error.issues` and the form maps each issue back to the relevant field.

### Form integrating with the action

```typescript
// src/components/clients/ClientForm.tsx (excerpt continued)
async function onSubmit(values: CreateClientInput) {
  const result = await createClient(values);
  if (!result.ok) {
    form.setError("root", { message: result.error });
    return;
  }
  toast.success("Client created");
  router.push(`/clients/${result.data.id}`);
}
```

The form does not need to know that the server runs the same schema. It treats the server result as authoritative and renders whatever errors come back. The double-validation is a feature, not waste: the client-side parse provides instant feedback for the 99% of users typing slowly, and the server-side parse defends against the 1% submitting crafted payloads.

## Pitfalls (to avoid)

**Validating after the database query.** Reading a row, then validating it, is too late. The query already happened. Validate the input that drives the query.

**Trusting the form library alone.** `react-hook-form` validates client-side. If the action does not run the schema again, an attacker bypasses every check by hitting the action directly. The server action wrapper is the validation point that matters.

**Under-constraining strings.** Every string field in the schema has a `max(N)`. Without a cap, a 50 MB payload at a single field hits the database, blows the JSON column size, or melts the JS engine on render. Caps in the schema are reflected in the column types (`varchar(N)`) so the database is the second line of defense. Cap conventions: short identifiers 40–120, names and titles 120–160, descriptions and notes 2000–5000, rich-text JSON 50000.

**Unbounded arrays.** A schema with `z.array(z.string())` accepts a million-element array. Use `z.array(z.string()).max(N)` with `N` chosen for the use case. Proposal blocks: max 100. Invoice line items: max 100. Tags on a project: max 20.

**Trusting Prisma types as input.** `Prisma.ClientCreateInput` is the database row shape, not the API contract. It accepts fields the user should not be able to set (`userId`, `id`, `createdAt`, audit-related fields). Always derive the input shape from the zod schema, not from the Prisma type.

**Mutating parsed input in business logic.** Once parsed, the input is treated as immutable. Re-running the schema after mutation is a smell that suggests the schema does not match the operation's needs. If the operation has multiple steps, each step takes a typed sub-input.

## Email

`z.string().email().max(254)`. Zod's `.email()` is sufficient for v1: it validates basic shape (`local@host.tld`) without doing any network lookups.

**Do not do MX lookups.** They are slow, they leak the user's input to a DNS server, and they reject many valid configurations (subdomain mail, custom MX setups, role accounts at small domains). Bounce handling at the email-provider layer is the correct place to discover undeliverable addresses; see `docs/architecture/email-system.md`.

The 254-character cap matches the RFC 5321 maximum length for an SMTP address.

## URL

`z.string().url()` plus a protocol allowlist via `.refine()`:

```typescript
const httpUrlSchema = z
  .string()
  .url("Enter a valid URL")
  .refine((u) => /^https?:\/\//.test(u), "URL must use http or https");
```

The allowlist matters because `z.string().url()` accepts schemes like `javascript:`, `data:`, and `file:`, which are dangerous when echoed back into HTML. Restrict to `http` and `https` for any user-supplied URL that will be rendered as a link.

For URLs displayed in proposal blocks or update content, the rich-text sanitizer (`docs/security/xss-and-sanitization.md`) re-checks the protocol at render time. The schema is the first defense; the sanitizer is the second.

## Markdown

User-supplied markdown (proposal block bodies, update content, signature blocks, custom email subject and body) is validated as a string with a max length. Sanitization happens at render time:

```typescript
const markdownSchema = z
  .string()
  .max(50000, "Content is too long");
```

The actual sanitization (markdown → HTML → `sanitize-html` allowlist) lives in the renderer. The schema's job is to bound the size and prevent giant payloads from reaching the renderer.

## Webhook payloads

Webhook handlers (Inngest, UploadThing, Resend) verify the provider signature first, then parse the payload through a schema specific to the event type. The schema's role here is *not* security (the signature is what makes the request trustworthy) but type safety: the handler can rely on `event.data.proposalId` being a string instead of guessing.

```typescript
// src/lib/schemas/webhook.schema.ts
export const resendBounceSchema = z.object({
  type: z.literal("email.bounced"),
  data: z.object({
    email_id: z.string(),
    to: z.array(z.string().email()),
    bounce: z.object({
      type: z.enum(["hard", "soft"]),
      reason: z.string().optional(),
    }),
  }),
});
```

A failed parse on a webhook is logged at `warn` and returns 200 (not 400) — the provider should not retry indefinitely, and a malformed payload that survived the signature check is a provider bug worth logging but not blocking on.
