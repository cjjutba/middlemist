# Conventions

The codebase is small and the contributor count is one. The conventions below exist to keep that small codebase readable to a future self and to anyone who reads it as a case study. The bias is toward boring, explicit code — clever beats correct exactly never.

## TypeScript

`tsconfig.json` runs in strict mode with three additional flags:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

`noUncheckedIndexedAccess` is the most consequential of these: `arr[0]` returns `T | undefined`, not `T`. The cost is a few extra checks; the benefit is that out-of-bounds access produces a type error rather than `undefined` flowing through the program until something crashes.

**No `any`.** Use `unknown` and narrow with a type guard or a zod parse. If a third-party type is wrong, write a local type and cast at the boundary, not internally.

```typescript
// FORBIDDEN
function process(input: any) {
  return input.value.toLowerCase();
}

// CORRECT
import { z } from "zod";
const inputSchema = z.object({ value: z.string() });

function process(rawInput: unknown) {
  const input = inputSchema.parse(rawInput);
  return input.value.toLowerCase();
}
```

The boundary cast is acceptable when a third-party library has wrong types and the right answer is documented; the cast happens once at the import boundary, not throughout the application.

```typescript
// at the boundary
import { someUntypedHelper } from "third-party";
const helper = someUntypedHelper as (x: string) => Promise<string>;
```

## Imports

External imports first, then `@/` internal imports, then relative imports. One blank line between groups. ESLint enforces it through `eslint-plugin-import`.

```typescript
import { z } from "zod";
import { redirect } from "next/navigation";

import { withAuth } from "@/lib/auth/with-auth";
import { clientsRepo } from "@/lib/repositories/clients.repo";
import { createClientSchema } from "@/lib/schemas/client.schema";

import { ClientForm } from "./ClientForm";
```

The `@/` alias resolves to `src/`. Configured in `tsconfig.json` `paths` and in `next.config.ts`. Relative imports with two or more dots (`../../`) signal a misplaced file: prefer `@/`.

## Naming

| Kind | Style | Example |
|---|---|---|
| Variables, functions, hooks, props | camelCase | `clientId`, `findById`, `useProposalDraft` |
| React components, types, classes, enums, Prisma models | PascalCase | `ClientList`, `Project`, `AuditEntityType` |
| Files | kebab-case | `clients.repo.ts`, `with-auth.ts` |
| Component files | PascalCase | `ClientList.tsx` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| Boolean variables | predicate form | `isPublished`, `hasDraft`, `canArchive` (never `published`, `draft`) |
| Route segments | kebab-case | `/clients/new`, `/proposals/[id]/edit` |

The boolean rule is the one that catches new contributors most often. `published` reads like a state name (the row's status); `isPublished` reads like a question (the answer is true or false). The rest of the code is easier to scan once predicates always look like predicates.

## Comments

WHY, not WHAT. The code names what it does; comments explain why.

```typescript
// FORBIDDEN — restates what the code does
// loop over the clients
for (const client of clients) { ... }

// FORBIDDEN — references the task that prompted the code (rotten reference once merged)
// added for issue #214
const result = await thing();

// FORBIDDEN — refers to the next thing in time
// TODO: speed this up later
const slow = await fetch(...);

// ACCEPTABLE — explains a non-obvious constraint
// updateMany over update so cross-tenant access returns count: 0
// rather than throwing P2025 (which would leak existence)
const result = await prisma.client.updateMany({ where: { id, userId }, data });
```

For exported `lib/` functions, TSDoc on the function declaration is appropriate when the parameters or return type warrant explanation. For internal functions, the function name is usually enough; a comment is optional.

```typescript
/**
 * Verify a magic-link token from the portal redemption flow.
 * Returns the session row on success; throws on expired, consumed, or unknown.
 */
export async function verifyPortalToken(token: string) { ... }
```

Avoid summary headers like `// === Helpers ===`. The tooling doesn't need them and they rot when files reorganize.

## Error handling philosophy

Layered. Each layer has a default action and a known way of escalating.

- **Repository.** Returns `null` for "not found" reads (`findById`). Throws a typed `Error` for "not found" mutations where the caller cannot proceed (`update`, `archive` after `updateMany` count 0). Repos do not log; they raise.
- **Service.** Throws typed errors (`NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`, `IntegrationError`). Services do not catch their own throws unless wrapping with extra context.
- **Server action.** Catches every throw. Returns a discriminated union: `{ ok: true, data } | { ok: false, error: string }`. The action layer is where typed errors become wire errors.
- **UI.** Switches on the result type. `ok: true` flows through to success state; `ok: false` renders a toast or an inline error.

The full hierarchy lives in `docs/engineering/error-handling.md`.

```typescript
// service throwing typed
import { NotFoundError } from "@/lib/utils/errors";

export const projectsService = {
  async transitionStatus(userId: string, id: string, to: ProjectStatus) {
    const project = await projectsRepo.findById(userId, id);
    if (!project) throw new NotFoundError("Project not found");
    if (!isValidTransition(project.status, to)) {
      throw new ValidationError(`Cannot transition from ${project.status} to ${to}`);
    }
    return projectsRepo.update(userId, id, { status: to });
  },
};
```

```typescript
// action returning discriminated result
export const transitionProjectStatus = withAuth(
  z.object({ id: z.string(), to: projectStatusSchema }),
  async (userId, input) => {
    return projectsService.transitionStatus(userId, input.id, input.to);
  }
);
```

```typescript
// UI handling result
const result = await transitionProjectStatus({ id, to: "active" });
if (!result.ok) {
  toast.error(friendlyMessage(result.error));
  return;
}
toast.success("Project active");
```

`friendlyMessage` is a small map in `src/lib/utils/errors.ts`: it converts internal codes (`PROJECT_NOT_FOUND`, `RATE_LIMITED`) to user-facing strings (`"That project no longer exists."`, `"You're moving fast. Try again in a few seconds."`). Stack traces never reach the UI.

## React

**Server Components by default.** Page files (`page.tsx`), layouts, and most composite components in `src/components/app/` are server components. They can `await` repository calls and render the result.

**Opt into `"use client"` only when needed.** Forms with live validation, the proposal editor, the time tracker, the command palette. Adding `"use client"` to a component pulls it (and everything it imports) into the JS bundle that ships to the browser; default to server.

**Suspense for streaming.** Pages that fetch data from multiple sources can wrap individual sections in `<Suspense>` to stream as each section becomes ready. The dashboard and the project detail page are the two places this matters in v1.

```typescript
export default async function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" />
      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentActivity />
      </Suspense>
      <Suspense fallback={<UpcomingDeadlinesSkeleton />}>
        <UpcomingDeadlines />
      </Suspense>
    </div>
  );
}
```

**Avoid prop drilling for global state.** The active session, the active locale, and the active timezone are passed via React context (set up in the root layout). Component props carry data that the component renders or interacts with directly.

## Forms

`react-hook-form` + `@hookform/resolvers/zod`. The schema lives in `src/lib/schemas/<entity>.schema.ts` and is imported by both the form and the action.

```typescript
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* ... */}
    </form>
  );
}
```

The action runs the same schema. Client-side validation is UX; server-side validation is security; both run.

## Date and time

Storage is always UTC. Conversion to the user's timezone happens at presentation. The `User.defaultTimezone` column is set during onboarding and read on every request.

```typescript
import { formatInTimeZone } from "date-fns-tz";

formatInTimeZone(invoice.dueDate, user.defaultTimezone, "MMM d, yyyy");
```

`Date.now()` is fine for "current time at this point in code" but is forbidden in business logic where a fake clock matters in tests. Use a clock service (`src/lib/utils/clock.ts`) for any time-dependent business rule:

```typescript
// FORBIDDEN — testable but only by mocking Date globally
if (proposal.validUntil < new Date()) { ... }

// CORRECT — clock can be substituted in tests
import { clock } from "@/lib/utils/clock";
if (proposal.validUntil < clock.now()) { ... }
```

## Money

Currency is never a JavaScript `number`. Prisma's `Decimal` type is the canonical representation for stored amounts; in TypeScript, that maps to `Prisma.Decimal` (a thin wrapper around `decimal.js`). Arithmetic uses `Decimal` methods (`.add`, `.sub`, `.mul`, `.toFixed`).

```typescript
import { Prisma } from "@prisma/client";

const subtotal = lineItems.reduce(
  (acc, item) => acc.add(item.unitPrice.mul(item.quantity)),
  new Prisma.Decimal(0)
);
```

Every monetary value is paired with an ISO 4217 currency code (`USD`, `PHP`, `EUR`, `GBP`, etc.). Formatting uses the explicit code:

```typescript
import { formatMoney } from "@/lib/utils/money";

formatMoney(invoice.total, invoice.currency); // "$1,250.00"
```

`formatMoney` uses `Intl.NumberFormat` with the currency code; it does not assume a locale. See `docs/architecture/fx-and-currency.md` for the FX conversion model.

## Async

`async`/`await` everywhere. Promise chains are reserved for the rare case where a `.then` is genuinely cleaner.

**Never silently catch.** A `try { ... } catch (e) {}` is a bug. The catch must do one of: log and re-throw, log and return a typed error, or convert to a result envelope.

```typescript
// FORBIDDEN
try {
  await thing();
} catch {}

// CORRECT
try {
  await thing();
} catch (e) {
  logger.error({ err: e }, "thing failed");
  throw new IntegrationError("EXTERNAL_FAILURE");
}
```

**Concurrent waits.** Use `Promise.all` when calls are independent.

```typescript
const [client, projects] = await Promise.all([
  clientsRepo.findById(userId, id),
  projectsRepo.listByClient(userId, id),
]);
```

## IDs

`cuid` for internal entities (Prisma's `@default(cuid())`). `nanoid(21)` for public proposal/invoice tokens. `nanoid(48)` for client portal magic-link tokens. The differences in length are calibrated to entropy needs; see `docs/architecture/public-links.md`.

## Code examples summary

The three patterns above (service throwing typed error, action returning result envelope, form integrating with action) are the most-repeated shape in the codebase. Once a contributor has internalized them, every new entity is mechanical: write the schema, write the repo, write the service, write the action, write the form. The chapters of `docs/engineering/` go deeper on each layer.
