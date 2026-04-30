# Error handling

Errors flow through four layers, and each layer has one job. The repository layer raises typed throws or returns null. The service layer raises typed throws. The action layer catches every throw and converts to a discriminated result envelope. The UI switches on the result type and renders. This shape keeps stack traces off the wire and gives every layer one explicit way to escalate.

## Layers and responsibilities

| Layer         | Failure mode                                 | What happens                                                 |
| ------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Repository    | Read miss                                    | Returns `null`.                                              |
| Repository    | Mutation miss (cross-tenant or non-existent) | Throws a typed `Error` with a code (`CLIENT_NOT_FOUND`).     |
| Service       | Business rule violation                      | Throws `ValidationError`, `ConflictError`, etc.              |
| Service       | Not found                                    | Throws `NotFoundError`.                                      |
| Service       | Forbidden state                              | Throws `ForbiddenError`.                                     |
| Service       | External provider failure                    | Throws `IntegrationError`.                                   |
| Server action | Catches every throw                          | Returns `{ ok: false, error }`.                              |
| Server action | Successful handler                           | Returns `{ ok: true, data }`.                                |
| UI            | `result.ok === false`                        | Renders toast or inline error using `friendlyMessage(code)`. |
| UI            | `result.ok === true`                         | Renders success state.                                       |

Each layer catches what is below it. Below the action layer, every throw is treated as a programming error and is logged to Sentry (except for `AppError` subclasses, which are expected and not captured).

## Error class hierarchy

A small set of named classes in `src/lib/utils/errors.ts`:

```typescript
// src/lib/utils/errors.ts

export class AppError extends Error {
  readonly code: string;
  readonly statusHint: number;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    message?: string,
    opts: { statusHint?: number; meta?: Record<string, unknown> } = {},
  ) {
    super(message ?? code);
    this.code = code;
    this.statusHint = opts.statusHint ?? 400;
    this.meta = opts.meta;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string = 'NOT_FOUND', message?: string) {
    super(code, message, { statusHint: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(code: string = 'CONFLICT', message?: string) {
    super(code, message, { statusHint: 409 });
  }
}

export class ValidationError extends AppError {
  constructor(code: string = 'VALIDATION', message?: string, meta?: Record<string, unknown>) {
    super(code, message, { statusHint: 400, meta });
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string = 'FORBIDDEN', message?: string) {
    super(code, message, { statusHint: 403 });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMITED', 'Slow down a little.', { statusHint: 429, meta: { retryAfter } });
  }
}

export class IntegrationError extends AppError {
  constructor(provider: string, cause?: unknown) {
    super(`INTEGRATION_${provider.toUpperCase()}`, `Provider ${provider} call failed.`, {
      statusHint: 502,
      meta: { provider, cause: cause instanceof Error ? cause.message : String(cause) },
    });
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
```

The `code` field is the identifier the action returns. The `message` is the developer-facing description. The `statusHint` is for route handlers that need to return an HTTP status (route handlers, unlike actions, return real HTTP responses). The `meta` field carries structured data (provider name, retry-after seconds, validation issues).

The hierarchy is small on purpose. Adding a class is a real decision (it propagates through every layer's catch logic and the friendly-message map). When in doubt, use `ValidationError` with a specific `code` rather than introducing a new class.

## Sentry capture rules

The Sentry SDK is configured to capture every unhandled throw. The application explicitly does _not_ capture `AppError` instances:

```typescript
// src/lib/sentry.ts (excerpt)
import * as Sentry from '@sentry/nextjs';
import { AppError } from '@/lib/utils/errors';

Sentry.init({
  dsn: env.SENTRY_DSN,
  beforeSend(event, hint) {
    if (hint?.originalException instanceof AppError) {
      // expected business-layer error; do not capture
      return null;
    }
    return event;
  },
});
```

The reason: `AppError` represents an expected outcome ("the user tried to send a draft proposal that does not exist; we threw `NotFoundError`"). Capturing every expected outcome would flood the Sentry inbox and obscure the unexpected throws that actually need attention.

Inside the action wrapper, `IntegrationError` is captured explicitly through `Sentry.captureException(e)` because integration failures are noteworthy even if "expected" in the sense that they are not a programming bug. The `IntegrationError` constructor stores the underlying cause; the Sentry event includes it as breadcrumb metadata.

## User-facing copy

`src/lib/utils/errors.ts` exports a `friendlyMessage` function that maps codes to user-facing strings. The map is small; missing codes fall back to a generic message.

```typescript
// src/lib/utils/errors.ts (excerpt)

const friendly: Record<string, string> = {
  UNAUTHENTICATED: 'Please log in and try again.',
  RATE_LIMITED: "You're moving fast. Try again in a few seconds.",
  UNEXPECTED: 'Something went wrong on our side. Try again, or reach out if it keeps happening.',

  CLIENT_NOT_FOUND: 'That client no longer exists.',
  PROJECT_NOT_FOUND: 'That project no longer exists.',
  PROPOSAL_NOT_FOUND: 'That proposal no longer exists.',
  INVOICE_NOT_FOUND: 'That invoice no longer exists.',

  PROPOSAL_NOT_DRAFT: 'Only draft proposals can be sent.',
  PROPOSAL_ALREADY_DECIDED: 'This proposal has already been accepted or declined.',
  INVOICE_NOT_PAYABLE: "This invoice can't be marked paid in its current state.",

  CLIENT_EMAIL_BOUNCED: "This client's email has bounced. Update it before sending.",
  EMAIL_TAKEN: 'An account with that email already exists.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',

  INTEGRATION_RESEND: "We couldn't reach the email provider. The retry will fire automatically.",
  INTEGRATION_UPLOADTHING: "We couldn't reach the file storage provider. Try again.",
  INTEGRATION_EXCHANGERATE:
    'Currency rates are temporarily unavailable. Saved with the latest cached rate.',
};

export function friendlyMessage(code: string): string {
  return friendly[code] ?? 'Something went wrong. Please try again.';
}
```

Two principles for the map.

**Specific over generic.** "That client no longer exists" beats "Not found." The user knows what they tried to do; the message confirms it.

**No internal jargon.** The code is `PROPOSAL_NOT_DRAFT`; the message is "Only draft proposals can be sent." The user does not know what "PROPOSAL_NOT_DRAFT" means; a friendly message bridges the vocabulary.

The map lives in one file so the language stays consistent. Inline messages (toast strings hard-coded into components) drift; centralized messages do not.

## UI handling

The result envelope is the primary integration point. Three patterns:

```typescript
// pattern 1: simple toast on failure
const result = await archiveClient({ id });
if (!result.ok) {
  toast.error(friendlyMessage(result.error));
  return;
}
toast.success('Client archived');
router.refresh();
```

```typescript
// pattern 2: form-level error from the result
async function onSubmit(values: CreateClientInput) {
  const result = await createClient(values);
  if (!result.ok) {
    if (result.issues) {
      // map per-field issues back to the form
      for (const issue of result.issues) {
        const path = issue.path.join('.');
        form.setError(path as keyof CreateClientInput, { message: issue.message });
      }
      return;
    }
    form.setError('root', { message: friendlyMessage(result.error) });
    return;
  }
  router.push(`/clients/${result.data.id}`);
}
```

```typescript
// pattern 3: inline error in a server component (rare; usually a redirect or notFound is the right pattern)
async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const client = await clientsRepo.findById(session.user.id, id);
  if (!client) notFound();
  return <ClientDetail client={client} />;
}
```

The third pattern is the standard for server-component pages: read through a repo, redirect if unauthenticated, render `notFound()` if the row does not exist. The action-and-result pattern is for mutations.

## Stack traces

Stack traces never reach the UI. The action wrapper catches every throw and returns a string code; the UI maps the code to a user-facing message. Internal details stay server-side.

In development, the underlying error is logged with full stack trace through `logger.error`. In production, it is captured by Sentry (for non-AppError throws) and logged at `error` level. The user sees "Something went wrong. Please try again."

## Examples

### Repository throwing on cross-tenant mutation

```typescript
async update(userId: string, id: string, input: Partial<UpdateInput>): Promise<Client> {
  const result = await prisma.client.updateMany({ where: { id, userId }, data: input });
  if (result.count === 0) throw new Error("CLIENT_NOT_FOUND");
  // ...
}
```

The bare `Error` here is acceptable because the caller (always a service) catches it and rethrows as a typed `NotFoundError`. The repo layer is allowed to use a string-keyed throw because the service layer translates.

### Service throwing typed

```typescript
import { NotFoundError, ValidationError } from '@/lib/utils/errors';

export const proposalsService = {
  async send(userId: string, id: string) {
    const proposal = await proposalsRepo.findById(userId, id);
    if (!proposal) throw new NotFoundError('PROPOSAL_NOT_FOUND');
    if (proposal.status !== 'draft') {
      throw new ValidationError('PROPOSAL_NOT_DRAFT', 'Only draft proposals can be sent.');
    }
    return proposalsRepo.update(userId, id, { status: 'sent', sentAt: new Date() });
  },
};
```

The service explicitly types its throws. The action wrapper recognizes them through `isAppError` and surfaces the `code`.

### Action returning typed error

```typescript
export const sendProposal = withAuth(z.object({ id: z.string() }), async (userId, { id }) => {
  return proposalsService.send(userId, id);
});
```

The action does not have a try/catch. The wrapper handles it. Result on failure: `{ ok: false, error: "PROPOSAL_NOT_DRAFT" }`.

### UI handling result type

```typescript
async function handleSend() {
  const result = await sendProposal({ id: proposal.id });
  if (!result.ok) {
    toast.error(friendlyMessage(result.error));
    return;
  }
  toast.success('Proposal sent');
  router.refresh();
}
```

The chain: handler clicks send → action invoked → service throws `ValidationError("PROPOSAL_NOT_DRAFT")` → wrapper catches, returns `{ ok: false, error: "PROPOSAL_NOT_DRAFT" }` → UI toasts "Only draft proposals can be sent." Stack trace stays on the server; user sees a clear message; Sentry captures nothing (expected outcome).

## Logging

Errors that reach the wrapper's catch branch are logged at the appropriate level:

- **`AppError` (expected business-layer outcome):** Not logged. The wrapper returns the code envelope quietly.
- **`IntegrationError`:** Logged at `warn` (not `error`) and captured by Sentry.
- **Anything else (programming bug):** Logged at `error` with full stack and captured by Sentry.

The logger calls live in `src/lib/log.ts` (see `docs/engineering/logging.md`). Structured logging keeps the production stdout queryable in Vercel's log viewer.
