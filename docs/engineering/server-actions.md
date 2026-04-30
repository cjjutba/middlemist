# Server actions

Server Actions are the only mutation entry point in the application. Every form submission, every status change, every "send" button calls one. They live in `src/actions/`, one file per entity, and they all run through the same wrapper (`withAuth` for authenticated actions, `withPublicRateLimit` for token-based public actions). This document covers the file layout, the shape every action takes, the wrapper API, and the patterns for revalidation, redirects, errors, and audit.

## Where

`src/actions/` with one file per entity:

```
src/actions/
├── auth.ts
├── clients.ts
├── projects.ts
├── tasks.ts
├── time-entries.ts
├── updates.ts
├── proposals.ts
├── invoices.ts
├── settings.ts
├── search.ts
└── portal.ts
```

Each file's exports are named verbs (`createClient`, `updateProject`, `markInvoicePaid`). The naming convention is consistent enough that import statements read fluently:

```typescript
import { createClient, updateClient, archiveClient } from "@/actions/clients";
```

## The wrapper

`withAuth` is the standard wrapper. It does four things in order: extracts `userId` from the session, runs the input through a zod schema, calls the handler, and converts the handler's return (or any thrown error) into a discriminated `ActionResult` envelope.

```typescript
// src/lib/auth/with-auth.ts
import { auth } from "@/lib/auth/config";
import { z } from "zod";
import { limits } from "@/lib/ratelimit";
import { logger } from "@/lib/log";
import { isAppError } from "@/lib/utils/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: z.ZodIssue[] };

export function withAuth<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (userId: string, input: TInput) => Promise<TOutput>,
  opts: { rateLimit?: keyof typeof limits } = {}
): (rawInput: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput) => {
    const session = await auth();
    if (!session?.user?.id) {
      return { ok: false, error: "UNAUTHENTICATED" };
    }

    const rl = await limits[opts.rateLimit ?? "serverActionDefault"].limit(session.user.id);
    if (!rl.success) {
      return { ok: false, error: "RATE_LIMITED" };
    }

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "INVALID_INPUT",
        issues: parsed.error.issues,
      };
    }

    try {
      const data = await handler(session.user.id, parsed.data);
      return { ok: true, data };
    } catch (e) {
      if (isAppError(e)) {
        return { ok: false, error: e.code };
      }
      logger.error({ err: e }, "server action failed");
      return { ok: false, error: "UNEXPECTED" };
    }
  };
}
```

`isAppError` is a type guard for the application's error class hierarchy (see `docs/engineering/error-handling.md`). The wrapper maps known errors to their `code` property; unknown throws are logged and surfaced as `UNEXPECTED`.

The optional `rateLimit` parameter lets a specific action opt into a tighter limit (the email-send actions use `emailSend`, the file-upload actions use `fileUpload`).

## The shape of an action

Every action is `async (input: unknown) => Promise<ActionResult<TData>>`. The `withAuth` wrapper produces this type from the schema and the handler.

```typescript
// src/actions/clients.ts
"use server";

import { revalidatePath } from "next/cache";
import { withAuth } from "@/lib/auth/with-auth";
import {
  createClientSchema,
  updateClientSchema,
  archiveClientSchema,
} from "@/lib/schemas/client.schema";
import { clientsService } from "@/lib/services/clients.service";

export const createClient = withAuth(createClientSchema, async (userId, input) => {
  const client = await clientsService.create(userId, input);
  revalidatePath("/clients");
  return client;
});

export const updateClient = withAuth(updateClientSchema, async (userId, input) => {
  const { id, ...rest } = input;
  const client = await clientsService.update(userId, id, rest);
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  return client;
});

export const archiveClient = withAuth(archiveClientSchema, async (userId, { id }) => {
  await clientsService.archive(userId, id);
  revalidatePath("/clients");
  return { id };
});
```

The `"use server"` directive at the top of the file marks every export as a Server Action. The directive is required — exports without it are treated as ordinary JavaScript and Next.js refuses to invoke them as actions.

## Validation

Every action runs `schema.safeParse(input)` first. The wrapper does this before the handler is called; the handler sees `input` already typed.

The schema is the contract. It defines the input shape, the constraints (length, format, business rules), and the error messages. The form imports the same schema for client-side validation; the action imports it for server-side validation. They cannot drift. See `docs/security/input-validation.md` for the full philosophy.

## Side effects

Mutating actions almost always have side effects beyond the database write. The standard chain:

1. **Validate input** (schema, in the wrapper).
2. **Read the current state** (repo `findById`).
3. **Apply business rules** (service throws if invalid).
4. **Write the state change** (repo `update`/`create`).
5. **Write audit** (`writeAudit` with action-specific metadata).
6. **Emit Inngest event** (for downstream effects: email send, notification, FX refresh).
7. **Revalidate cached pages** (`revalidatePath` for affected routes).
8. **Return the new state** (or a minimal success envelope).

The service layer handles steps 2–6; the action handles 1, 7, and 8. Splitting the responsibilities means an action file is a thin orchestration layer that reads "did the form submit, was the input valid, where do we go next?" and the service layer reads "what does it mean to send a proposal."

## Code example: creating a proposal

A complete walkthrough of the layers from form submit to UI reload.

```typescript
// src/lib/schemas/proposal.schema.ts
import { z } from "zod";

export const createProposalSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1).max(160),
  validUntilDays: z.number().int().min(1).max(365).default(30),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
```

```typescript
// src/lib/services/proposals.service.ts (excerpt)
import { proposalsRepo } from "@/lib/repositories/proposals.repo";
import { clientsRepo } from "@/lib/repositories/clients.repo";
import { writeAudit } from "@/lib/audit/write";
import { inngest } from "@/lib/inngest/client";
import { NotFoundError } from "@/lib/utils/errors";
import { newPublicToken } from "@/lib/auth/portal-tokens";

export const proposalsService = {
  async create(userId: string, input: CreateProposalInput) {
    const client = await clientsRepo.findById(userId, input.clientId);
    if (!client) throw new NotFoundError("CLIENT_NOT_FOUND");

    const validUntil = new Date(Date.now() + input.validUntilDays * 24 * 60 * 60 * 1000);

    const proposal = await proposalsRepo.create(userId, {
      clientId: input.clientId,
      title: input.title,
      validUntil,
      publicToken: newPublicToken(),
      status: "draft",
    });

    await writeAudit({
      userId,
      action: "proposal.created",
      entityType: "proposal",
      entityId: proposal.id,
      metadata: { clientId: input.clientId, title: input.title },
    });

    return proposal;
  },
};
```

```typescript
// src/actions/proposals.ts
"use server";

import { revalidatePath } from "next/cache";
import { withAuth } from "@/lib/auth/with-auth";
import { createProposalSchema } from "@/lib/schemas/proposal.schema";
import { proposalsService } from "@/lib/services/proposals.service";

export const createProposal = withAuth(createProposalSchema, async (userId, input) => {
  const proposal = await proposalsService.create(userId, input);
  revalidatePath("/proposals");
  return { id: proposal.id };
});
```

```typescript
// src/components/proposals/NewProposalForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createProposalSchema,
  type CreateProposalInput,
} from "@/lib/schemas/proposal.schema";
import { createProposal } from "@/actions/proposals";

export function NewProposalForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const form = useForm<CreateProposalInput>({
    resolver: zodResolver(createProposalSchema),
    defaultValues: { clientId, title: "", validUntilDays: 30 },
  });

  async function onSubmit(values: CreateProposalInput) {
    const result = await createProposal(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.push(`/proposals/${result.data.id}/edit`);
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>{/* ... */}</form>;
}
```

The flow: form validates client-side via `zodResolver`, action validates server-side via the same schema, service reads the client, writes the proposal, writes audit, returns. The action revalidates `/proposals` and returns the id. The form navigates to the edit page; that page reads the new row through the same repo.

## Revalidation

`revalidatePath(path)` invalidates the Next.js cache for a specific path. After a mutation, the action calls `revalidatePath` for every route whose data changed. Patterns:

- **Single-resource update.** `revalidatePath('/clients/[id]', 'page')` invalidates the detail page.
- **List update.** `revalidatePath('/clients')` invalidates the list page.
- **Both.** Update affecting list and detail (rename a client) revalidates both paths.
- **Tagged data.** `revalidateTag('clients')` invalidates everything tagged `clients`. Useful when the same data appears across many pages (the dashboard's recent activity, the global search results). Tags are set via `cache(fn, ['clients'])` at the data-loading boundary.

`revalidatePath` runs after the mutation completes. The user's next navigation reads the fresh data; if the user is mid-page, the page does not auto-refresh — the UI is responsible for re-rendering optimistically or refetching.

## Redirects

`redirect()` from `next/navigation`. Used after a successful action when the natural next step is a different page.

```typescript
import { redirect } from "next/navigation";

export const acceptProposalPublic = withPublicRateLimit(
  acceptProposalSchema,
  async (input) => {
    const proposal = await proposalsService.acceptPublic(input);
    redirect(`/p/${input.token}/accepted`);
  }
);
```

`redirect()` throws a special exception that Next.js catches at the boundary; the function does not return after the call. The action that wraps a redirect has an effective return type of `never` for the success branch, which is fine for navigation flows where the response is the next page rather than a JSON body.

For actions invoked from a form using `useFormState`, `redirect()` is the cleaner pattern than returning a "go here" instruction in the result envelope.

## Error responses

Never throw across the wire. The action always returns a typed envelope. Three failure modes:

```typescript
// validation failed
{ ok: false, error: "Name is required", issues: [...] }

// rate limit, missing session, business rule
{ ok: false, error: "RATE_LIMITED" }
{ ok: false, error: "UNAUTHENTICATED" }
{ ok: false, error: "PROPOSAL_NOT_FOUND" }

// integration failure (logged, generic message returned)
{ ok: false, error: "UNEXPECTED" }
```

The UI maps the error code to a user-facing string via `friendlyMessage(code)` from `src/lib/utils/errors.ts`. Stack traces never reach the UI; the wrapper logs them server-side and surfaces only the code.

For form-level error reporting that highlights specific fields, the action returns the full `issues` array. The form maps each issue's `path` back to the field name and calls `form.setError(field, { message })`.

## Public-token actions

Actions invoked from public routes (the proposal accept form) do not have a session. They use a separate wrapper `withPublicRateLimit`:

```typescript
// src/actions/proposals.ts (excerpt)
export const acceptProposalPublic = withPublicRateLimit(
  acceptProposalSchema,
  async (input) => {
    return proposalsService.acceptPublic(input);
  },
  { rateLimit: "publicView" }
);
```

`withPublicRateLimit`:

1. Reads `request.headers.origin` and verifies it matches the application's host (CSRF defense; see `docs/security/csrf.md`).
2. Reads the IP from `x-forwarded-for` and applies a token+IP rate limit.
3. Runs the input through the zod schema.
4. Calls the handler with the parsed input.
5. Returns the same `ActionResult` envelope.

Public-token action names end with the `Public` suffix to make their auth posture obvious at every call site. A grep for `Public$` in `src/actions/` lists every unauthenticated mutation in the application.

## Forbidden patterns

**Actions taking `userId` from input.** The wrapper supplies `userId`; an action that destructures it from input is a security bug. Code review rejects it on first sight; the schema's `.shape` is reviewed for any field named `userId`.

**Actions doing raw Prisma.** Imports from `@/lib/prisma` outside `src/lib/repositories/` are a CI failure. An action calling `prisma.client.findUnique` directly fails the build.

**Actions mutating data without audit.** Every state change has a corresponding `writeAudit` call (in the service or directly in the action for actions that do not delegate to a service). Code review rejects an action without an audit call unless it is a no-op or a read-only operation.

**Actions throwing to the UI.** A `throw` that escapes the wrapper is a bug; the wrapper catches everything. The few exceptions (`redirect()` and `notFound()` from `next/navigation`) are framework-controlled and re-throw at the route handler boundary.

**Actions with unwrapped exports.** Every export from a file under `src/actions/` runs through `withAuth` or `withPublicRateLimit`. A bare `export async function` without a wrapper is a bug; code review rejects it.
