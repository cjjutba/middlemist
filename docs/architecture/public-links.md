# Public links

Middlemist has three classes of unauthenticated routes: proposal viewing (`/p/[token]`), invoice viewing (`/i/[token]`), and the client portal entry (`/portal/[token]`). Each uses a token to grant access. The token is the only access proof. The schemes differ: proposal and invoice tokens are stored plaintext (revocation = regenerate); portal magic-link tokens are stored hashed (revocation = expiry + consumption).

This document covers how the tokens are generated, stored, looked up, expired, revoked, and rate-limited. It complements `multi-tenancy.md`, which describes Layer 3 (public-link tables) at a higher level.

## Why public links exist

A client should not need an account to read a proposal you sent them. A client should not need an account to view an invoice. The product principles (especially "the client view is sacred") demand that the client experience be friction-free: open a link in an email, see a clean, branded document.

Public links carry that constraint: the URL is the credential. Treat the URL like a password.

## Token generation

Two schemes:

### Proposal and invoice tokens

`nanoid(21)` generated at row creation. URL-safe alphabet (A-Z, a-z, 0-9, `_`, `-`). 21 characters at ~6 bits per character ≈ 126 bits of entropy. Collision probability across the entire row table is negligible at v1 scale.

Stored plaintext in `Proposal.publicToken` and `Invoice.publicToken`. The plaintext storage is a deliberate choice: it makes "regenerate the token" a single column update (revocation), and it makes the lookup a unique-index hit (fast). The risk is that a database leak exposes all live tokens; the mitigation is that the database is the same one that holds all the rows, so a leak of tokens is dwarfed by the leak of the data the tokens unlock.

### Magic-link tokens (client portal)

`nanoid(48)` generated at issuance. Hashed with `sha256` and stored as `tokenHash` in `ClientPortalSession`. Higher entropy because magic links are emailed and may sit in a client's inbox; we want resistance to "I shoulder-surfed the email subject line" attacks.

Hashed storage is preferred for magic links because:

- The token is intended for one-time use (consumed on first redemption); a leaked database row does not produce a usable login.
- The session that comes after redemption uses a separate cookie; the magic-link token has no further role once consumed.

## Storage shapes

```prisma
model Proposal {
  // ...
  publicToken String @unique
  // ...
}

model Invoice {
  // ...
  publicToken String @unique
  // ...
}

model ClientPortalSession {
  id                  String   @id @default(cuid())
  userId              String
  clientId            String
  tokenHash           String   @unique
  magicLinkExpiresAt  DateTime
  sessionExpiresAt    DateTime?
  consumedAt          DateTime?
  ip                  String?
  userAgent           String?
  createdAt           DateTime @default(now())
  // ...
}
```

The unique constraint on the token columns (and on `tokenHash`) gives both a fast lookup and a guarantee against duplicates.

## Routes

```
/p/[token]              public proposal view (HTML)
/i/[token]              public invoice view (HTML)
/portal/[token]         magic-link redemption (sets session cookie, redirects)
/portal                 (after redemption) the portal dashboard for the logged-in client
/portal/projects/...    client-scoped resource pages
/api/pdf/public/proposal/[token]
/api/pdf/public/invoice/[token]
```

`/p/[token]` and `/i/[token]` and the public PDF routes do their own token lookup and render directly. `/portal/[token]` is the entry point only; subsequent portal routes use the session cookie.

## Rate limiting

Upstash Ratelimit with a sliding-window strategy:

- **30 requests per minute per IP per token** for `/p/[token]` and `/i/[token]`. The token is part of the rate-limit key so a single shared link does not lock out all requests in a corporate NAT.
- **30 requests per minute per IP** for `/portal/[token]` redemption attempts. Per-IP only; the token in the URL is the credential.
- **5 requests per minute per IP** for `/portal` magic-link request endpoint (where a client asks for a new link). This is throttled tighter to limit email spam.
- **30 requests per minute per IP per token** for the public PDF routes.

Configured in middleware (or in route handlers for routes outside middleware's scope). The Upstash key namespace prefixes each limit so they do not collide:

```typescript
// src/lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const publicViewLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:public-view',
});

export const portalRedeemLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'rl:portal-redeem',
});

export const portalRequestLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:portal-request',
});
```

## Revocation

### Proposal and invoice tokens

The user can regenerate the public token from the entity's settings menu. The action:

1. Generates a new `nanoid(21)`.
2. Updates `Proposal.publicToken` (or `Invoice.publicToken`) to the new value.
3. Writes audit `proposal.regenerated-token` (or `invoice.regenerated-token`).
4. Returns the new URL to the user so they can re-share it.

The old URL immediately stops working: the unique index on the column means there is at most one valid token per row, and the lookup query (`findUnique({ where: { publicToken } })`) returns null for the previous value.

### Magic-link tokens

Magic-link tokens revoke themselves through expiry (1 hour) and consumption. There is no manual "revoke a magic link" action because magic links are short-lived by design.

To revoke a portal session that has already been redeemed, the freelancer can revoke the session from the client's settings: this sets `sessionExpiresAt` to the past. The next request from the cookie fails the `sessionExpiresAt > now` check and the client is logged out.

## Expiry

| Link type        | Expires when                                                                       |
| ---------------- | ---------------------------------------------------------------------------------- |
| Proposal         | `validUntil` (user-set) is past, or status is `expired`, `accepted`, or `declined` |
| Invoice          | Never (always viewable, even when paid)                                            |
| Magic-link token | 1 hour after issuance, or upon consumption                                         |
| Portal session   | 7 days after redemption                                                            |

Invoices remain viewable indefinitely on purpose: a client may want to look up an old invoice, and the document is a record of the transaction. Voiding an invoice changes its status to `void` but does not invalidate the URL; the URL renders the void invoice with a banner explaining its status.

## Tracking

Every public-link view writes an audit-log entry. The entry's metadata includes IP and user agent. The first view of a proposal sets `Proposal.viewedAt`; subsequent views update audit only. Same for invoices.

```typescript
// in the public-route page component
import { writeAudit } from '@/lib/audit/write';
import { headers } from 'next/headers';

const proposal = await proposalsRepo.findByPublicToken(token);
if (!proposal) return notFound();

const h = await headers();
await writeAudit({
  userId: null,
  action: 'proposal.viewed',
  entityType: 'proposal',
  entityId: proposal.id,
  metadata: {},
  ip: h.get('x-forwarded-for') ?? undefined,
  userAgent: h.get('user-agent') ?? undefined,
});

await inngest.send({ name: 'proposal.viewed', data: { proposalId: proposal.id } });
```

The `proposal.viewed` Inngest handler then sets `viewedAt` if null, sends the freelancer's notification email, and writes the in-app notification (which is a derived view over the audit log; see `audit-log.md`).

## What public views can do

- **Proposal**: read the proposal; click "Accept" or "Decline" to change status; download the PDF. The accept action writes the typed signature, captures IP and user agent, and changes status to `accepted`.
- **Invoice**: read the invoice; download the PDF. There is no "mark paid" action on the public view because there is no payment processor in v1.
- **Client portal**: read projects, updates, proposals, invoices that belong to the magic-link's `clientId`.

## What public views cannot do

- **Write to other tenants' data.** Token lookups return only the row matching the token; the route renders only that row.
- **Access other clients of the same freelancer.** The portal session is bound to one `clientId`; queries inside the portal filter by `userId` AND `clientId`.
- **Enumerate.** Tokens are 21 characters of high-entropy alphabet (or 48 for magic links). There is no path to find tokens by guessing.
- **List entities of any kind without a token.** There is no `/p` or `/i` index; only `/p/[token]` and `/i/[token]` are routable.

## Adding a new public-link entity

If a new entity needs a public link in v2, the pattern:

1. Add `publicToken String @unique` to the model. Generate with `nanoid(21)` at row creation.
2. Add a public route at `/x/[token]/page.tsx` that calls a `findByPublicToken` repo function.
3. Add rate limiting in middleware for the new path.
4. Add a "regenerate token" action and the `*.regenerated-token` audit action.
5. Add public-view audit logging and the corresponding Inngest event handler if a notification is needed.
6. Update this document.

A new public route is a security-relevant change. New ADRs should be written if the pattern departs from the conventions above.
