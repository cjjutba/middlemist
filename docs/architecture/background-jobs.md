# Background jobs

Middlemist uses Inngest for everything that happens outside a synchronous request: scheduled cron tasks (FX refresh, overdue checks, reminders), event-driven side effects (sending email after a proposal is sent, notifying the freelancer when a client views), and any work that should retry on failure. Inngest is the only background runtime; there is no `setInterval`, no `node-cron`, no detached promise in a request handler.

The decision to use Inngest over BullMQ + Redis is captured in ADR 0004. The short version: Inngest is serverless-native, has no Redis to operate, and provides retry, cron, and observability out of the box.

## Two kinds of jobs

**Cron** runs on a schedule. The handler receives no payload (or a degenerate scheduler tick) and queries the database to find what needs doing.

**Event-driven** fires when application code calls `inngest.send({ name, data })`. The handler receives the event payload and operates on the IDs it carries.

## Cron jobs

| Name                      | Schedule             | Purpose                                                                                                                     |
| ------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `fx.refresh`              | daily 06:00 UTC      | Fetch latest rates from exchangerate.host and upsert into `FxRate`.                                                         |
| `invoices.check-overdue`  | hourly               | Find sent invoices past `dueDate`, mark `status = overdue`, write audit + notification.                                     |
| `invoices.send-reminders` | hourly               | For each user's `InvoiceReminderConfig`, find invoices matching `daysBeforeDue` or `daysAfterDue` and send reminder emails. |
| `proposals.check-expired` | hourly               | Find sent proposals past `validUntil`, mark `status = expired`, write audit.                                                |
| `audit.compact`           | weekly Sun 02:00 UTC | Compress audit log entries older than 90 days into summary rows; delete soft-deleted file metadata older than 30 days.      |

Cron handlers idempotently process work: each one reads the current state, advances rows that need advancing, and is safe to run twice in the same window without duplicating side effects. For example, `invoices.check-overdue` only acts on rows whose status is currently `sent`; running it twice does not double-mark.

## Event-driven jobs

| Event                         | Triggered by                                    | Effects                                                                              |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `user.signup`                 | Successful signup completion                    | Send welcome email; seed `EmailSettings` and `InvoiceReminderConfig` defaults.       |
| `proposal.sent`               | `sendProposal` action                           | Email client with proposal link; write audit.                                        |
| `proposal.viewed`             | First public-link page view                     | Email freelancer (if enabled); insert audit + notification; set `Proposal.viewedAt`. |
| `proposal.accepted`           | Public accept action                            | Email freelancer; create or attach project (draft); write audit + notification.      |
| `proposal.declined`           | Public decline action                           | Email freelancer; write audit + notification.                                        |
| `invoice.sent`                | `sendInvoice` action                            | Email client with invoice link; write audit.                                         |
| `invoice.viewed`              | First public-link page view                     | Email freelancer (if enabled); insert audit + notification; set `Invoice.viewedAt`.  |
| `invoice.paid`                | `markInvoicePaid` action                        | Email freelancer (confirmation); write audit + notification.                         |
| `update.posted`               | `postUpdate` action (when "send email" toggled) | Render React Email; send to client; set `Update.emailSentAt`.                        |
| `client.magic-link-requested` | Portal access request                           | Generate token, store hash, email client.                                            |

Application code does not perform email or notification side effects synchronously. The action writes the row, fires the event, and returns. The handler does the rest. This keeps the request fast, retries are free, and the failure mode of "email service is down" does not block the user.

## Event payload convention

Payloads are minimal. They carry IDs, not full objects. Handlers re-fetch from the database. The reasoning: events may be retried after a delay, and the row may have changed. Always read the current state.

```typescript
// good
inngest.send({ name: 'proposal.viewed', data: { proposalId: 'clx...' } });

// bad: payload could be stale by the time the handler runs
inngest.send({
  name: 'proposal.viewed',
  data: { proposalId: 'clx...', title, total, status },
});
```

The handler:

```typescript
// src/lib/inngest/functions/proposal-viewed.ts

import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/prisma';

export const onProposalViewed = inngest.createFunction(
  { id: 'proposal-viewed' },
  { event: 'proposal.viewed' },
  async ({ event, step }) => {
    const { proposalId } = event.data;

    const proposal = await step.run('load-proposal', async () =>
      prisma.proposal.findUnique({
        where: { id: proposalId },
        include: { user: true, client: true },
      }),
    );
    if (!proposal) return { skipped: 'not-found' };

    await step.run('set-viewed-at', async () => {
      if (proposal.viewedAt) return;
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { viewedAt: new Date() },
      });
    });

    await step.run('send-notification-email', async () => {
      // sendEmail(...) see email-system.md
    });

    return { ok: true };
  },
);
```

## Idempotency

Handlers must be safe to retry. The runtime retries on failure by default. Repeats happen. Patterns:

- **Read-then-act on null fields.** `if (proposal.viewedAt) return;` before setting `viewedAt = now`.
- **Use `updateMany` with a status filter.** `prisma.invoice.updateMany({ where: { id, status: 'sent' }, data: { status: 'overdue' } })` is idempotent; running it twice is a no-op the second time.
- **Use Inngest event IDs as deduplication keys** for emails. Pass the event's `id` as the Resend `idempotencyKey` so the same Inngest event id never sends twice even if the handler retries mid-send.

Avoid:

- **Append-only operations without a guard.** A handler that calls `prisma.notification.create` on every retry will produce duplicates. Use `upsert` with a unique constraint or check first.
- **External side effects without an idempotency key.** Resend, UploadThing, and exchangerate.host calls all need keys when the operation is not naturally idempotent.

## File location

```
src/lib/inngest/
  client.ts                      // export const inngest = new Inngest({...})
  functions/
    fx-refresh.ts                // cron
    invoices-check-overdue.ts    // cron
    invoices-send-reminders.ts   // cron
    proposals-check-expired.ts   // cron
    audit-compact.ts             // cron
    user-signup.ts               // event
    proposal-sent.ts             // event
    proposal-viewed.ts           // event
    proposal-accepted.ts         // event
    proposal-declined.ts         // event
    invoice-sent.ts              // event
    invoice-viewed.ts            // event
    invoice-paid.ts              // event
    update-posted.ts             // event
    client-magic-link.ts         // event
  index.ts                       // re-exports the array of functions
```

`src/app/api/inngest/route.ts` registers all functions with the Inngest serve handler.

## Registering a function

```typescript
// src/lib/inngest/client.ts
import { Inngest } from 'inngest';

type EventMap = {
  'proposal.viewed': { data: { proposalId: string } };
  'invoice.paid': { data: { invoiceId: string; amount: number } };
  // ... rest of the events
};

export const inngest = new Inngest({
  id: 'middlemist',
  schemas: {
    'proposal.viewed': { data: { proposalId: 'string' } },
    // ...
  } as unknown as EventMap,
});
```

```typescript
// src/app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { functions } from '@/lib/inngest/functions';

export const { GET, POST, PUT } = serve({ client: inngest, functions });
```

## Local development

Run Inngest's dev server locally:

```bash
pnpm dlx inngest-cli@latest dev
```

The CLI auto-discovers `/api/inngest`, registers the functions, and exposes a UI at `http://localhost:8288` for triggering events, watching runs, and replaying failures. Cron jobs do not run automatically in dev; trigger them manually from the UI when testing.

## Testing

Cron and event handlers are tested with Vitest:

- **Pure step logic** is extracted into a function and unit-tested.
- **End-to-end** flows are tested with the Inngest test helper, which lets you `await` a function's run with a fake event:

```typescript
import { describe, it, expect } from 'vitest';
import { onProposalViewed } from '@/lib/inngest/functions/proposal-viewed';

describe('proposal.viewed handler', () => {
  it('sets viewedAt only on first view', async () => {
    // seed a proposal with viewedAt = null
    // run the handler with an event payload
    // assert viewedAt is now set
  });
});
```

Idempotency tests verify that running the handler twice produces the same end state.

## Adding a new job

1. Decide cron or event. If it has a trigger condition that an action can fire, prefer event. If it has a time condition, use cron.
2. Add the function file under `src/lib/inngest/functions/`.
3. Register it in `src/lib/inngest/functions/index.ts`.
4. If event-driven, add the event name and payload type to the EventMap in `client.ts`.
5. Write tests that cover idempotency.
6. If the job sends email, load `email-system.md`.
7. If the job introduces a new pattern, write an ADR.
