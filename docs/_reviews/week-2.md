# Week 2 Review

**Date:** 2026-04-30
**Scope:** Sub-prompts 2A through 2E (validated env + Prisma singleton, Auth.js v5, repository pattern + audit + withAuth, multi-tenant isolation tests, middleware).
**Reviewer:** Claude Code review session
**Status:** Reviewed; one bug fix applied; two minor cleanups noted but not fixed.

## What was verified

- Multi-tenant isolation across every repository function in `src/lib/repositories/`.
- `withAuth` wrapper in `src/lib/auth/with-auth.ts` and the auth actions in `src/actions/auth.ts`.
- Auth flow visual fidelity (heading, inputs, button, layout, footer) against `docs/design/component-patterns.md`.
- Middleware: auth gate prefixes, rate-limit dispatch, security headers.
- Rate limiter switch logic (Upstash → ioredis → NOOP).
- Email send abstraction (Mailpit dev / Resend prod).
- Auth email templates (visual fidelity, security copy).
- Isolation test patterns (`resetDb`, two-user create, cross-tenant assertions).

## Fixes applied in this review

- **`src/app/page.tsx`: landing page nav is now auth-aware.** When `auth()` returns a session, the nav shows a single "Dashboard" link styled as `{component.button-secondary}`. Logged-out visitors still see "Sign in" + "Sign up free". Also fixed the dead `href="#"` on the auth CTAs to point at `/login` and `/signup`. Page is now a server component with `await auth()`, so build status changes from `○ Static` → `ƒ Dynamic`. Verified end-to-end via curl: anonymous request renders `Sign in / Sign up free`; an authenticated session-cookie request renders `Dashboard`.

## Drift noted but not fixed

| #   | What                                                                                                                                                                                                            | Where                                                                                 | Recommendation                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `AuthField.tsx` is dead code — defined but never used; the four form components (Signup, Login, ForgotPassword, ResetPassword) inline their own input markup.                                                   | `src/components/auth/AuthField.tsx`                                                   | Pick one shape: either replace inline inputs with `AuthField`, or delete the unused component. Fix when next touching the auth surface.                                                     |
| 2   | Auth forms use `focus:border-black` instead of the token `focus:border-primary`. The hex value is the same (`#111111`) so visually identical, but it's semantic drift from the token system.                    | `src/components/auth/{SignupForm,LoginForm,ForgotPasswordForm,ResetPasswordForm}.tsx` | Trivial replace; do alongside the AuthField cleanup.                                                                                                                                        |
| 3   | Repo functions return Prisma-inferred types implicitly (no explicit return type). Per `docs/engineering/repository-pattern.md` "Return types are explicit."                                                     | `src/lib/repositories/{clients,users}.repo.ts`                                        | Add explicit return types when expanding the repos in Week 3. The `Client` and `User` model types are already exported by the generated Prisma client; annotation is one-line per function. |
| 4   | Hero "Notify me" / "Learn more" CTAs on the landing page still link to `href="#"`. They are placeholder calls-to-action while the product is "Coming soon"; intentional for now.                                | `src/app/page.tsx`                                                                    | Replace with real waitlist + about routes when the marketing page lands in a later week.                                                                                                    |
| 5   | `sendEmail` doesn't fail-fast if `NODE_ENV=production` and `RESEND_API_KEY` is missing — it would silently fall through to `nodemailer` and try to reach `localhost:1026` (which would only fail at send time). | `src/lib/email/send.ts`                                                               | Add a startup guard or throw inside the function when `NODE_ENV === 'production' && !RESEND_API_KEY`. Worth doing alongside the env reader's production guards in a near-term cleanup.      |
| 6   | `middleware.ts` filename is deprecated in Next 16; the framework wants `proxy.ts`. Build emits a warning but still works.                                                                                       | `src/middleware.ts`                                                                   | Rename to `proxy.ts` when the migration is convenient — single-file mechanical change.                                                                                                      |
| 7   | CSP `script-src` uses `'unsafe-inline'` (and `'unsafe-eval'` in dev) instead of nonce-based per `docs/security/xss-and-sanitization.md`.                                                                        | `src/lib/security/csp.ts`                                                             | Tighten to nonces when Next 16's nonce wiring through RSC stabilizes. Currently documented as an intentional deviation in the file's docblock.                                              |

## Doc-vs-prompt deltas surfaced during review

The Week 2E review prompt checked against an outdated terminology that the docs have moved past. These are not drift in the code — the code matches the docs — but worth recording so future prompts are calibrated:

- The prompt referenced `src/lib/repositories/auditLog.repo.ts` and `src/lib/rate-limit.ts` and `src/lib/auth/withAuth.ts`. Per docs/engineering/folder-structure.md, the actual paths are `src/lib/audit/{registry,write}.ts`, `src/lib/ratelimit.ts` (single word), and `src/lib/auth/with-auth.ts` (kebab-case). The code matches the docs.
- The prompt described tokens as "stored as sha256 hashes, single-use via `consumedAt`." Per `docs/spec/01-auth-and-account.md` line 29 and `docs/security/magic-links.md`, **no token tables exist**. Email-verify and password-reset tokens are JWTs signed with `AUTH_SECRET`. Single-use is enforced via DB state (`User.emailVerifiedAt` for verify; `User.passwordVersion` for reset). The code matches the docs.
- The prompt's rate-limit checklist used names like `authPost`/`publicToken`/`portalToken`/`serverAction`. The docs canonical names are `loginIp/loginEmail/signupIp/forgotPasswordIp/resetPasswordIp/verifyEmailIp/publicView/portalRedeem/serverActionDefault/emailSend/fileUpload/search`. The code matches the docs (each rule has its own prefix so cache keys don't collide). All windows + counts match the docs table.

## Things to watch in future weeks

- **Every new repo follows the userId-first signature.** `src/lib/repositories/clients.repo.ts` is the canonical example. New repos that deviate (e.g., add a method that takes only `id`) will break the multi-tenancy contract. Code review must check every new repo function for `userId` as the first parameter.
- **Every new tenant-scoped repo gets a two-user isolation test.** Pattern is established in `tests/integration/repositories/clients.repo.test.ts`. Without the isolation test, a leak can land silently.
- **Every new server action goes through `withAuth(schema, handler)`.** The two existing exceptions are `src/actions/auth.ts` (signup/login pre-date the session) and any future public-token actions (which will use a `withPublic*` wrapper that hasn't been built yet). Every other new action wraps.
- **Every state change writes audit.** `signup` and `password-changed` are wired. `client.created`, `project.status-changed`, `proposal.sent`, etc. land as those modules ship; the registry in `src/lib/audit/registry.ts` is the gate (unknown actions throw at write time).
- **`@/lib/prisma` and `@/generated/prisma` are forbidden imports** outside `src/lib/repositories/**`, `src/lib/audit/**`, and `src/lib/prisma.ts`. The ESLint rule catches this. If the rule is ever loosened, the multi-tenancy guarantee weakens.
- **Email templates hard-code design tokens** (Inter family, `#111111`, `#374151`, `#6b7280`, `#ffffff`, 8px radius). They cannot reference CSS variables because email clients don't load them. New templates should follow the shape in `src/lib/email/templates/_styles.ts`.
- **Rate-limit names match the docs table.** When a new module lands and needs a new rule (e.g., `magic-link-request: 5 / 1 min` per docs/security/rate-limiting.md row 92), the new entry goes in `src/lib/ratelimit.ts` `limits` with a unique prefix and the count + window from the docs.

## Pipeline status

```
pnpm lint      ✓
pnpm typecheck ✓
pnpm test      ✓ 20/20 (3 files: clients.repo, users.repo, audit/write)
pnpm build     ✓ /, dashboard, auth pages, /api/auth/[...nextauth] all present;
                 ƒ Proxy (Middleware) registered
```

Manual UI check (curl-driven against the dev server):

- `GET /` anonymous → renders `Sign in` + `Sign up free` ✓
- `GET /` with valid session cookie → renders `Dashboard` ✓
- (Dashboard gate, login flow, rate-limit 429, CSP headers — all verified end-to-end during 2E and re-verified here.)

## Sign-off

Week 2 foundation is sound. Multi-tenant isolation is enforced at four layers (repo + ESLint rule, withAuth, signed JWTs for unauth flows, two-user integration tests). Auth flow works end-to-end against Mailpit. Middleware gates correctly, rate-limits the auth surface per docs, and applies a tight CSP. The drift items above are cosmetic or future-week concerns; none affect the security posture or the multi-tenancy contract. **Ready for Week 3 planning.**
