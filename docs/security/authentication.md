# Authentication

The freelancer authenticates with email and password. The client (a non-account viewer of one freelancer's data) authenticates with a magic-link issued by that freelancer; the magic-link flow is documented separately in `docs/security/magic-links.md`. There is no OAuth, no SAML, no SSO, no passkey, and no two-factor authentication in v1. This document covers the freelancer flow end to end: sign-up, verification, login, password reset, password change, session lifecycle, and login throttling.

## Provider and flow

Auth.js v5 (the rewrite of NextAuth, native to Next 15 App Router) handles the session layer. The credentials provider is the only authentication adapter wired up. The magic-link provider that ships with Auth.js is *not* used for freelancer login; magic links are reserved for client-portal access and use a custom flow (`docs/security/magic-links.md`).

A freelancer's complete authentication state is one row in `User` (with `passwordHash` and `emailVerifiedAt` columns) plus the JWT-signed session cookie issued by Auth.js. There is no separate session table. There is no `RefreshToken` table. The session cookie is the session.

## Password rules

Twelve characters minimum. No upper/lower/digit/symbol composition rule. No reused-password check, no breach-list check.

This aligns with NIST SP 800-63B (June 2017 revision and later): length over composition, no forced rotation, no hint questions. Composition rules trade real security for theatre; the data behind them shows users predictably append a digit and a punctuation mark to a familiar pattern. A 12-character minimum with no other constraints catches the failure mode that matters (extremely short passwords) without nudging users into the predictable workaround.

```typescript
// src/lib/schemas/auth.schema.ts
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be 128 characters or fewer");

export const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
```

The login schema's password field is `min(1)` rather than `passwordSchema` so a too-short candidate gets the same generic "incorrect email or password" failure as a wrong password. Length feedback at signup, no length feedback at login.

## Hashing

Bcrypt at cost 12. Implementation via `bcryptjs` (pure JavaScript; works in Vercel's Node runtime without a native binding).

```typescript
// src/lib/auth/password.ts
import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

Cost 12 takes roughly 250 ms on Vercel's Node runtime. That latency is a feature: it bounds how fast an attacker who has obtained `passwordHash` values can mount an offline guess. It also bounds how fast login can happen, which is fine — no one notices 250 ms on a page that already involves a redirect.

**Argon2id as upgrade path.** Argon2id (memory-hard) is the modern recommendation and would be the default if not for tooling friction on serverless. The `argon2` Node package needs a native binding, which complicates Vercel deployment. v2 will reconsider; if it lands, existing bcrypt hashes are detected by the `$2b$` prefix and rehashed on next login (transparent dual-format support).

## Sessions

Auth.js JWT strategy (the default for v5). The session is signed with `AUTH_SECRET` and stored in an httpOnly cookie. There is no server-side session row.

```typescript
// src/lib/auth/config.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { env } from "@/lib/env";
import { loginSchema } from "@/lib/schemas/auth.schema";
import { usersRepo } from "@/lib/repositories/users.repo";
import { verifyPassword } from "./password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,    // refresh once per day if active
  },
  cookies: {
    sessionToken: {
      name:
        env.NODE_ENV === "production"
          ? "__Secure-middlemist.session"
          : "middlemist.session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await usersRepo.findByEmailForAuth(parsed.data.email);
        if (!user) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (!user.emailVerifiedAt) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
});
```

**Cookie posture.** httpOnly so the cookie is unreachable from JavaScript (XSS that lands inside a tenant cannot steal the cookie). secure so it never flows over plain HTTP. sameSite=lax so cross-site form posts cannot ride the cookie; first-party top-level navigations still send it (which is required for the OAuth-style redirect dance). The `__Secure-` prefix in production is enforced by browsers: the cookie is only accepted if its `Secure` attribute is set on a secure connection.

**Rolling expiry.** Set to 30 days with a `updateAge` of one day. An active user is silently renewed on use; an inactive user is logged out 30 days after their last action. This avoids both the friction of a short fixed expiry and the long tail of indefinitely valid sessions.

**Stateless invalidation.** Because the session is a JWT, "log this user out everywhere" is not free. Two patterns handle the cases that matter:

- **Password reset and account deletion.** The session payload includes a `passwordVersion` integer that mirrors `User.passwordVersion`. The session callback rejects any session whose `passwordVersion` does not match the current row. A password reset bumps `User.passwordVersion`, which invalidates every existing session for that user on the next request.
- **AUTH_SECRET rotation.** Rotating `AUTH_SECRET` invalidates every session globally. The trade is total user logout. Reserved for credential-compromise events.

## Email verification

Required before login. An account with `emailVerifiedAt = null` cannot reach `/dashboard` even with the correct password (the credentials provider returns `null` and the page never gets a session).

The verification token is a JWT-shaped signed payload (per Module 01 spec):

```typescript
// src/lib/auth/tokens.ts
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export async function signEmailVerifyToken(userId: string, email: string) {
  return new SignJWT({ purpose: "email-verify", userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

export async function verifyEmailVerifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (payload.purpose !== "email-verify") throw new Error("WRONG_PURPOSE");
  return { userId: payload.userId as string, email: payload.email as string };
}
```

**Single-use.** A JWT is by itself not single-use. The verification handler enforces single-use by checking `User.emailVerifiedAt`: if it is already set and the email in the token matches the current email, the link is treated as already-redeemed and the user is sent to `/login`. If it is set and the email differs, the link is for a stale email-change attempt and is rejected. The pairing of "purpose + payload + database state" is what makes the JWT single-use without a token table.

**Expiry.** 24 hours (long enough to survive a delayed email and a busy day). Expired tokens render an "expired" view with a button to request a fresh token.

**Rate limit.** Five verification-email requests per email address per hour. See `docs/security/rate-limiting.md`.

## Password reset

Initiated from `/forgot-password`. Flow:

1. User submits email. The action *always* returns success regardless of whether the email matches a row. (Anti-enumeration: an attacker probing the form learns nothing about which addresses are registered.)
2. If the email matches a verified user, a `password-reset` JWT (1-hour expiry, payload `{ purpose, userId, passwordVersion }`) is signed and emailed.
3. The user clicks the link, lands on `/reset-password/[token]`. The page verifies the token, then renders a form for the new password.
4. On submit, the action verifies the token *again*, hashes the new password, increments `User.passwordVersion`, updates `passwordHash`, writes audit `user.password-changed`, and redirects to `/login`.

The `passwordVersion` claim is the single-use guard. Each reset bumps the version; the second click of the same emailed link finds `payload.passwordVersion` no longer matches and the verifier throws.

**Side effect.** The `passwordVersion` bump invalidates every existing session for that user (per session-callback check above). This is intentional: a password reset implies "I do not trust the existing access," and every device that was logged in is forced to log in again with the new password.

**Rate limits.** Five forgot-password requests per IP per ten minutes. Five reset attempts per IP per ten minutes (a wrong token triggers a 401 and counts toward the limit). See `docs/security/rate-limiting.md`.

## Password change (authenticated)

From settings, a logged-in user can change their password. Required: current password, new password (twice). The action:

1. Re-verifies the current password against `User.passwordHash`. A failure does not log the user out; it returns `{ ok: false, error: "INVALID_CURRENT_PASSWORD" }`.
2. Hashes the new password.
3. Bumps `User.passwordVersion` (which invalidates every other session, including this one — Auth.js then re-issues a fresh cookie because the user is mid-request and authenticated).
4. Writes audit `user.password-changed`.
5. Sends a confirmation email through Inngest (`user.password-changed` event → `password-change-confirm` template).

## Email change (authenticated)

A two-step flow that prevents an attacker who has temporary access from quietly rerouting the account.

1. From settings, the user submits a new email and their current password. The action verifies the password and writes a `pending-email-change` JWT (24-hour expiry, payload `{ purpose, userId, newEmail }`) sent to the *new* address.
2. The user clicks the link from the new mailbox. The handler verifies the token, sets `User.email = newEmail`, sets `User.emailVerifiedAt = now` for the new address, and writes audit `user.email-changed` with metadata `{ from, to }`.
3. The old address gets a notification email ("your account email was changed; if this wasn't you, contact security@middlemist.app").

`User.email` is unique. If the new email already belongs to another row, the action returns `EMAIL_TAKEN` *before* sending the confirmation. The error is identical whether the email is taken or invalid; the form does not differentiate.

## Login throttling

Five failed login attempts per email per ten minutes triggers a fifteen-minute lockout for that email. Per email, *not* per IP. An attacker can rotate IPs trivially; an account is keyed on the address.

Implementation: Upstash Ratelimit with a sliding-window strategy and key `auth:login-fail:{email}`. The credentials `authorize` callback increments the counter on each failure; a counter ≥ 5 returns null without checking the password. Successful login clears the counter.

The login form does not differentiate "too many attempts" from "wrong password" in its surface message ("incorrect email or password, or account temporarily locked"). The 15-minute lockout starts on the fifth failure and any login attempt during the lockout window resets the lock to 15 minutes from now (sliding lock, not a fixed timer). After 15 minutes of zero attempts, the account unlocks automatically. There is no "request unlock" link; the freelancer waits.

This is a coarse but sufficient defense. A determined attacker forces one account into permanent lockout, which is annoying but not destructive (the freelancer can wait 15 minutes). v2 may add a CAPTCHA fallback or a "request unlock" mailer.

## Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | Auth.js callbacks (sign-in, sign-out, CSRF, session) |
| `/(auth)/signup` | GET | Sign-up form |
| `/(auth)/login` | GET | Login form |
| `/(auth)/forgot-password` | GET | Request reset |
| `/(auth)/reset-password/[token]` | GET | Reset redemption |
| `/(auth)/verify-email/[token]` | GET | Email verification redemption |

The signup, login, forgot-password, and password-change actions live in `src/actions/auth.ts` and are *not* `withAuth`-wrapped (signup and login by definition pre-date the session). They run their own zod validation and rate limiting.

## v2

Two-factor authentication via TOTP, passkey support (WebAuthn), OAuth providers (Google, GitHub) for one-click signup, recoverable account ("backup codes") flow, and a session-management UI that lists every active device with revoke buttons. None of these change the v1 model materially; v1 is intentionally minimal.
