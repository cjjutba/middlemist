# Email system

Middlemist uses Resend to send transactional email and React Email to compose templates. Sending happens in Inngest event handlers, never inline in a request handler. Every transactional email goes through one helper, `sendEmail`, which centralizes the from-address, reply-to, idempotency key, and bounce handling.

## Stack

- **Resend** for SMTP-free sending. Domain verification via DKIM and SPF records on `middlemist.app`. Free tier covers v1 send volume.
- **React Email** for template authoring. Templates are React components rendered to HTML at send time.
- **Inngest** for the queue. Email sends are triggered by events, not by request handlers.
- **Resend webhook** for bounces and complaints, posting back to `/api/email/webhook`.

## Send pattern

```typescript
// src/lib/email/send.ts
import { Resend } from "resend";
import { render } from "@react-email/render";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

type SendArgs = {
  to: string;
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
  fromName?: string;
  idempotencyKey?: string;
};

export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
  fromName,
  idempotencyKey,
}: SendArgs) {
  const html = await render(react);
  const from = `${fromName ?? "Middlemist"} <noreply@middlemist.app>`;
  return resend.emails.send(
    {
      from,
      to,
      subject,
      html,
      reply_to: replyTo,
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );
}
```

The helper is the only place `Resend` is imported. Template rendering, from-address composition, and idempotency are centralized so a future change (different provider, signed messages, additional headers) is one file.

## Templates

Thirteen templates are defined for v1. All live under `src/lib/email/templates/` as React components. Each one accepts a typed props object that holds the data needed to render it.

| Template | Audience | Trigger |
|---|---|---|
| `welcome.tsx` | Freelancer | `user.signup` event |
| `proposal-sent.tsx` | Client | `proposal.sent` event |
| `proposal-viewed.tsx` | Freelancer | `proposal.viewed` event |
| `proposal-accepted.tsx` | Freelancer | `proposal.accepted` event |
| `proposal-declined.tsx` | Freelancer | `proposal.declined` event |
| `invoice-sent.tsx` | Client | `invoice.sent` event |
| `invoice-viewed.tsx` | Freelancer | `invoice.viewed` event |
| `invoice-reminder.tsx` | Client | `invoices.send-reminders` cron |
| `invoice-paid.tsx` | Freelancer | `invoice.paid` event |
| `update-posted.tsx` | Client | `update.posted` event |
| `magic-link.tsx` | Client | `client.magic-link-requested` event |
| `password-reset.tsx` | Freelancer | password reset action |
| `email-verify.tsx` | Freelancer | signup or email change |

Each template imports a shared layout (`layout.tsx`) that handles header, footer, signature, and brand mark. The layout reads from the freelancer's `User.businessName` and `User.logoUrl` and renders them at the top of the email so the client sees the freelancer's brand, not Middlemist's.

## Customization

Per-user overrides for transactional copy live in the `EmailSettings` table (see `data-model.md`). For each customizable template, the user can override:

- **`fromName`**: the name shown before the email address. Defaults to `User.businessName` or `User.name`.
- **`replyTo`**: the address replies should go to. Defaults to `User.email`.
- **`signatureMd`**: a markdown signature block rendered at the bottom of the body. Defaults to a template based on `User.name` and `User.businessName`.
- **`*Subject`** and **`*Body`** for proposal-sent, invoice-sent, invoice-reminder, update-posted: per-template subject and body overrides. The body is markdown and supports the same `{variable}` syntax as proposals (`{client_name}`, `{project_name}`, `{freelancer_name}`, `{invoice_number}`, `{amount_due}`, `{view_link}`).

When sending, the email pipeline:

1. Loads `EmailSettings` for the user.
2. Picks subject and body: user override if set, else template default.
3. Resolves variables against the email context (the proposal, the invoice, the freelancer).
4. Renders the React Email template with the resolved subject, body, and signature.
5. Calls `sendEmail`.

System-defined templates that are not customizable (`welcome`, `password-reset`, `email-verify`) are sent without consulting `EmailSettings`. They are about the freelancer's account and Middlemist is the sender by intent.

## Deliverability

- **DKIM, SPF, DMARC** records on `middlemist.app`. Verified through Resend's domain setup before any send.
- **From address**: `noreply@middlemist.app` (system) or the freelancer's display name with the same address. The freelancer's actual email is in `Reply-To`.
- **List-Unsubscribe header** on client-facing emails (`proposal-sent`, `invoice-sent`, `update-posted`). Required by Gmail's bulk-sender rules even at low volume.
- **Plain-text fallback**: React Email renders a plain-text version automatically; both go in the same payload.
- **Domain warmup**: not relevant at v1 volume. Resend handles IP reputation across its sending pool.

## Bounce handling

Resend posts to `/api/email/webhook` for bounces, complaints, and delivery events. The handler:

1. Verifies the request signature against `env.RESEND_WEBHOOK_SECRET`.
2. For a hard bounce on a `Client.email`, sets `Client.emailValid = false`. Subsequent sends to that client are blocked at the call site:

```typescript
if (!client.emailValid) {
  // Surface a UI warning; do not send.
  return { ok: false, error: "CLIENT_EMAIL_BOUNCED" };
}
```

3. For a complaint (spam report) on a `User.email`, log to Sentry and notify the user in-app. Do not block the user account.
4. For delivery events, optionally write an audit entry; the v1 implementation does not store delivery status per email.

## Preview server

```bash
pnpm email:dev
```

This runs React Email's preview server (`react-email dev`) which serves every template at `http://localhost:3001`. The preview uses fixture data from `src/lib/email/templates/__fixtures__/` to render realistic content. Changes to template files hot-reload.

## Testing

Templates are tested two ways:

- **Snapshot test** on rendered HTML for each template. Catches accidental layout changes.

```typescript
// src/lib/email/templates/__tests__/proposal-sent.test.ts
import { render } from "@react-email/render";
import { ProposalSentEmail } from "../proposal-sent";

it("renders proposal-sent with default content", async () => {
  const html = await render(
    <ProposalSentEmail
      freelancerName="CJ"
      clientName="Acme"
      proposalTitle="Website redesign"
      viewLink="https://middlemist.app/p/abc"
      validUntil={new Date("2026-05-15")}
    />
  );
  expect(html).toMatchSnapshot();
});
```

- **Variable resolution test** for each customizable subject/body to verify all supported variables expand and unknown variables render as literal text.

The `sendEmail` helper itself is mocked at the module boundary in handler tests so no live emails are dispatched in CI. A small set of e2e tests against a Resend test mode key verifies the integration once per release.

## Adding a new template

1. Create `src/lib/email/templates/<name>.tsx` with a typed props interface.
2. Add a fixture in `__fixtures__/<name>.tsx` so the preview server has something to render.
3. Wire it up in the relevant Inngest handler.
4. If the template is customizable, add the corresponding fields to `EmailSettings` and to the settings UI.
5. Add a snapshot test.
6. Verify the rendered output in the preview server before merging.
