# Magic links

Two flows in Middlemist use a token in a URL as the credential: client portal access and freelancer password reset. The two flows are similar in shape and different in lifecycle. This document covers both. Architectural background lives in `docs/architecture/public-links.md`; this is the security-focused view.

## Two distinct uses

### Client portal access (rolling-use within session)

A freelancer issues a magic link to one of their clients. The client clicks the link, redeems it once, and receives a session cookie that grants read-only access to the freelancer's data scoped to that client for seven days. The magic-link token itself is consumed on first redemption; the cookie carries access from that point.

- **Token format.** `nanoid(48)` — 48 URL-safe characters, ~286 bits of entropy.
- **Storage.** sha256 hash of the token in `ClientPortalSession.tokenHash`. Plaintext token never lands in the database.
- **Request expiry.** One hour from issuance. After that the magic link no longer redeems.
- **Session expiry.** Seven days from redemption. After that the cookie no longer grants portal access.
- **Single-use as a magic link.** First redemption sets `consumedAt`; subsequent attempts to redeem the same token are rejected.
- **Rolling use as a session.** The session cookie issued on redemption can be presented many times within the seven-day window.

### Password reset (single-use)

A freelancer requests a password reset. A signed token (JWT shape, 1-hour expiry) is emailed. Clicking the link lets the freelancer set a new password. The token is single-use through a `passwordVersion` claim that is invalidated on first successful redemption.

- **Token format.** JWT signed with `AUTH_SECRET` (HS256), payload `{ purpose: "password-reset", userId, passwordVersion }`.
- **Storage.** None. The token is self-contained (signed payload). The `passwordVersion` claim is what makes it single-use.
- **Expiry.** One hour.
- **Single-use.** Each reset increments `User.passwordVersion`; a second click of the same emailed link finds the claim no longer matches.
- **Side effects.** Successful reset bumps `passwordVersion` (invalidating every existing freelancer session).

The two flows share the URL-as-credential threat model. They differ in how single-use is enforced (DB-stored hashed token vs. in-payload version claim).

## Token generation

### Client portal magic link

```typescript
// src/lib/auth/portal-tokens.ts
import { customAlphabet } from "nanoid";
import { createHash } from "node:crypto";

const URL_SAFE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
const generateToken = customAlphabet(URL_SAFE, 48);

export function newPortalToken() {
  const token = generateToken();
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}
```

The `token` value is sent in the email URL. The `hash` is what gets stored. The plaintext `token` exists in process memory only long enough to compose the email body.

### Password-reset JWT

See `docs/security/authentication.md` for the password-reset token signing helper. The `passwordVersion` field on `User` is part of the row that already exists for every user; no separate token table is created.

## Storage shapes

### `ClientPortalSession`

```prisma
model ClientPortalSession {
  id                  String    @id @default(cuid())
  userId              String
  clientId            String
  tokenHash           String    @unique
  magicLinkExpiresAt  DateTime
  sessionExpiresAt    DateTime?
  consumedAt          DateTime?
  ip                  String?
  userAgent           String?
  createdAt           DateTime  @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([userId, clientId])
  @@index([sessionExpiresAt])
}
```

The unique constraint on `tokenHash` makes the lookup an indexed point read. The dangling-session index on `sessionExpiresAt` powers the cleanup cron that deletes expired rows.

### Password reset

No table. The token is a JWT; the only persistent state is `User.passwordVersion`, which is an integer column on `User` already required by the session-invalidation flow.

## Verification flow

### Client portal: request → issue → email → click → redeem

```typescript
// src/actions/portal.ts (excerpt; fully wrapped per docs/engineering/server-actions.md)
"use server";
import { newPortalToken } from "@/lib/auth/portal-tokens";
import { clientPortalRepo } from "@/lib/repositories/client-portal.repo";
import { inngest } from "@/lib/inngest/client";

export const issuePortalLink = withAuth(
  z.object({ clientId: z.string() }),
  async (userId, { clientId }) => {
    const { token, hash } = newPortalToken();
    await clientPortalRepo.issue(userId, clientId, hash, /* ttl */ 60 * 60);
    await inngest.send({
      name: "client.magic-link-requested",
      data: { userId, clientId, token },
    });
    return { ok: true };
  }
);
```

The Inngest handler renders the email template (`magic-link.tsx`) using the plaintext `token` and sends through `sendEmail`. After the handler returns, the plaintext disappears.

```typescript
// src/app/portal/[token]/route.ts (Route Handler)
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { clientPortalRepo } from "@/lib/repositories/client-portal.repo";
import { writeAudit } from "@/lib/audit/write";
import { redirect } from "next/navigation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const hash = createHash("sha256").update(token).digest("hex");
  const session = await clientPortalRepo.findByHashForRedeem(hash);
  if (!session) redirect("/portal/expired");
  if (session.consumedAt) redirect("/portal/already-used");
  if (session.magicLinkExpiresAt < new Date()) redirect("/portal/expired");

  const h = await headers();
  const ctx = await clientPortalRepo.consumeAndIssueSession(session.id, {
    ip: h.get("x-forwarded-for") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  });

  await writeAudit({
    userId: session.userId,
    action: "client.portal-redeemed",
    entityType: "client",
    entityId: session.clientId,
    metadata: {},
  });

  const c = await cookies();
  c.set("middlemist.portal", ctx.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: ctx.sessionExpiresAt,
    path: "/portal",
  });

  redirect("/portal");
}
```

`consumeAndIssueSession` does three things atomically: sets `consumedAt = now`, sets `sessionExpiresAt = now + 7d`, and produces a signed cookie payload (the `id` of the row, signed with `AUTH_SECRET`). The cookie is the access proof from this point. The `tokenHash` is no longer used.

### Password reset

See `docs/security/authentication.md` for the full flow. The verifier:

```typescript
// src/lib/auth/tokens.ts (excerpt)
export async function verifyPasswordResetToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (payload.purpose !== "password-reset") throw new Error("WRONG_PURPOSE");
  return {
    userId: payload.userId as string,
    passwordVersion: payload.passwordVersion as number,
  };
}
```

The redeemer reads the user, checks `payload.passwordVersion === user.passwordVersion`, and only then permits the password update. The bump happens *inside* the same transaction that updates `passwordHash`, so a second concurrent click hits a stale version and is rejected.

## Email template

The body is short, the subject is direct, and the URL is the only call to action. No marketing, no testimonials, no unsubscribe link (transactional, not bulk).

```
Subject: Your portal link for {freelancerBusinessName}

Hi {clientName},

You can review your projects, proposals, and invoices here:

{portalUrl}

This link expires in 1 hour. If you did not request access, ignore this email — no one else can use the link until they have it.

— {freelancerName}
```

Display typography uses Inter Display 600 with `{typography.display-md}` for the recipient salutation; body copy uses Inter at `{typography.body-md}`. The expiry time is shown explicitly so a recipient who opens the email two hours later understands why the link no longer works.

For password reset, the equivalent template reads:

```
Subject: Reset your Middlemist password

Click below to set a new password. The link expires in 1 hour.

{resetUrl}

If you didn't ask for this, you can ignore the email. Your current password still works until you change it.
```

Optionally, the email includes the requesting IP and user agent ("This was requested from a Mac in Manila"). v1 includes this only on password-reset emails; portal emails skip it because the freelancer triggered the request, not the recipient.

## Replay defense

**Hashed storage (portal).** A database snapshot exposes hashes, not tokens. A hash cannot be replayed against the redemption endpoint because the endpoint hashes the URL token and looks up by hash; presenting the hash itself does not match anything (you would need the preimage).

**Single-use enforcement (both).** Portal: `consumedAt` flips on first redemption; subsequent attempts fail the `consumedAt is null` check. Password reset: `passwordVersion` increments on first successful reset; subsequent attempts fail the version check.

**Short expiry (both).** One hour. A leaked email that is read days later does not yield access.

**Rate limits.** See `docs/security/rate-limiting.md`. Portal magic-link request endpoint: 5 per IP per minute. Portal redemption endpoint: 30 per IP per minute. Password-reset request endpoint: 5 per IP per ten minutes.

**No information disclosure.** The redemption endpoint returns the same UI for "expired", "already used", and "not found": a generic "this link is no longer valid" page. An attacker probing tokens does not learn which states exist.

## Revocation

### Client portal magic link

There is no manual "revoke this magic link" UI. Magic links revoke themselves through expiry (one hour) and consumption. A freelancer who needs to invalidate an as-yet-unused link should regenerate it; the previous unused row is left in place but its `tokenHash` is not the one in the new email, so the previous token simply will not match.

### Client portal session (post-redemption)

A freelancer can revoke a portal session from the client's settings page. The action sets `sessionExpiresAt = now`. The next request from the cookie fails the `sessionExpiresAt > now` check and the client is logged out. The revocation writes audit `client.portal-revoked`.

If the freelancer wants to revoke *all* portal sessions for a client at once, the same action can be batched: `UPDATE ClientPortalSession SET sessionExpiresAt = now WHERE userId = $u AND clientId = $c`.

### Password reset

Revoke = bump `passwordVersion`. The bump happens automatically on every successful reset. To revoke without resetting (rare; e.g., the freelancer realizes they did not request the email), the freelancer can change their password from settings, which also bumps the version.

## Code: `ClientPortalSession` issuance

```typescript
// src/lib/repositories/client-portal.repo.ts (excerpt)
import { prisma } from "@/lib/prisma";

export const clientPortalRepo = {
  async issue(userId: string, clientId: string, tokenHash: string, ttlSeconds: number) {
    const expires = new Date(Date.now() + ttlSeconds * 1000);
    return prisma.clientPortalSession.create({
      data: {
        userId,
        clientId,
        tokenHash,
        magicLinkExpiresAt: expires,
      },
    });
  },

  async findByHashForRedeem(tokenHash: string) {
    return prisma.clientPortalSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        clientId: true,
        magicLinkExpiresAt: true,
        consumedAt: true,
      },
    });
  },

  async consumeAndIssueSession(
    sessionId: string,
    meta: { ip?: string; userAgent?: string }
  ) {
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await prisma.clientPortalSession.update({
      where: { id: sessionId },
      data: {
        consumedAt: new Date(),
        sessionExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      select: { id: true, sessionExpiresAt: true },
    });
    const cookieValue = signSessionCookie(updated.id);
    return { cookieValue, sessionExpiresAt: updated.sessionExpiresAt! };
  },
};
```

`signSessionCookie` produces a base64-encoded `{ sessionId, signature }` value where the signature is HMAC-SHA256 over `sessionId` keyed by `AUTH_SECRET`. Reading the cookie reverses the encoding, verifies the signature, and looks up the session row by id — a tampered cookie fails the signature check before any database read.
