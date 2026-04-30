# Security overview

Middlemist holds the contracts, deliverables, and billing records of one freelance practice per tenant. The asset class is small (no payment data, no health data, no government identifiers beyond a freelancer's tax id), but the trust model is tight: a single tenant leak ends a portfolio project and the freelance practice attached to it. This document is the entry point to the security stack. It names the threats, the layers that defend against them, and the conventions every contributor (which in v1 is one person) is expected to follow.

## Threat model

Threats below are listed in priority order. Priority reflects the cost of failure to the product, not the likelihood.

1. **Tenant data leakage.** A request scoped to user A returns or mutates data owned by user B. The attack surface is every authenticated query, every public link, every webhook handler, and every cron-driven function. Mitigated by Layer 1–4 of `docs/architecture/multi-tenancy.md`. A single missed `userId` filter is sufficient to leak. Treated as the rollback-the-PR severity.
2. **Authentication bypass.** A request reaches authenticated routes without a valid session. Surfaces: middleware misconfiguration, route handlers that forget to call `auth()`, server actions invoked outside `withAuth`. Mitigated by `docs/security/authentication.md`, the `withAuth` wrapper, and the `app/(app)/*` middleware gate.
3. **XSS through rich text.** Tiptap output that contains a `<script>` tag, a `javascript:` URL, or an event handler attribute. Surfaces: proposal block renderer, update content renderer, public document views. Mitigated by server-side sanitization with `sanitize-html`, a strict tag/attribute allowlist, and the ESLint rule that forbids `dangerouslySetInnerHTML` outside two whitelisted files. See `docs/security/xss-and-sanitization.md`.
4. **CSRF on server actions.** A cross-origin POST that triggers a state change against the user's session cookie. Mitigated by Next.js 15's built-in Origin/Referer check on Server Actions, by `sameSite=lax` on the session cookie, and by signature verification on webhook routes. See `docs/security/csrf.md`.
5. **Public-link abuse.** Brute-forcing a proposal token, scraping public PDFs, or replaying a magic link beyond its intended audience. Mitigated by 126-bit token entropy on proposal/invoice tokens, sha256-hashed storage on magic-link tokens, sliding-window rate limits per IP and per token, and short magic-link expiries. See `docs/security/magic-links.md` and `docs/architecture/public-links.md`.
6. **Email impersonation.** A bounce-based mailbox enumeration, a phishing email forged to look like Middlemist, or a fraudulent invoice sent through a hijacked account. Mitigated by SPF + DKIM + DMARC on `middlemist.app`, by rate limits on email-sending actions, and by audit logging of every send.
7. **File upload abuse.** Uploading executables, oversized files, or SVGs containing scripts. Mitigated by per-context MIME allowlists, size caps, server-side validation in the UploadThing middleware, and SVG sanitization (DOMPurify, strict config). See `docs/architecture/file-uploads.md`.

Lower-priority threats handled by infrastructure rather than application code: layer-3 DDoS (Vercel), TLS interception (Vercel-managed certificates), database access without credentials (Neon role-based access).

## Security philosophy

Four ideas direct every choice in this stack.

**Defense in depth.** No single check is allowed to be the only thing standing between an attacker and a tenant's data. Multi-tenancy has four enforcement layers (repository, server action wrapper, public-link tables, isolation tests). Auth has three (middleware gate, server action wrapper, route handler explicit checks). XSS has three (React escaping, Tiptap allowlist, sanitize-html on render). A bug in one layer should not be a leak; it should be an incident.

**Fail closed.** Every ambiguous condition denies access. A missing session returns 401. A malformed token returns 404. A repository query that does not find a row returns null and the caller surfaces "not found." A cross-tenant `updateMany` returns `count: 0` and the caller throws. There is no "if the user owns this, allow it; otherwise log a warning and continue."

**Validate at boundaries.** Input is validated once, at the boundary, with zod. After the boundary, types are trusted. The boundaries: every server action runs `schema.safeParse(input)`; every route handler parses the body before doing anything; every webhook verifies its signature before parsing. Validation in the middle of business logic is a code smell.

**Log audit trail.** Every state-changing action writes to `AuditLog`. The audit log is the only place the team (which is one person) can answer "what happened, and when." `docs/architecture/audit-log.md` covers the schema and conventions.

## Defense layers

Three concentric rings.

**Framework.** Next.js 15 App Router supplies CSRF protection on Server Actions (Origin check), built-in escaping in JSX, secure-by-default cookies (httpOnly, sameSite=lax), and the Edge runtime for middleware. Auth.js v5 supplies session signing, bcrypt password verification helpers, and JWT decode utilities. Prisma 6 supplies parameterized queries by default; SQL injection is not an attack surface for the application code.

**Code.** The repository pattern (`docs/engineering/repository-pattern.md`) centralizes Prisma access and forces every query to pass through a function that injects `userId`. The server action wrapper (`docs/engineering/server-actions.md`) extracts `userId` from the session, refuses unauthenticated calls, and validates input through zod. The audit helper (`docs/architecture/audit-log.md`) records every state change. ESLint rules forbid direct Prisma imports outside repos and `dangerouslySetInnerHTML` outside two whitelisted files.

**Infrastructure.** TLS at the edge via Vercel-managed certificates. Strict Content-Security-Policy header set in middleware, including `frame-ancestors 'none'` to prevent clickjacking. Rate limits via Upstash applied in middleware (per IP) and in server actions (per `userId`). Secrets stored as Vercel environment variables, never committed. Database access scoped to a single Neon role with row access governed entirely by application-layer filters; no row-level security in Postgres v1 because the application enforces it and adding RLS doubles the surface area for migrations.

**Test.** Every repository function has a two-user isolation test that runs against real Postgres. Webhook handlers have signature-verification tests that prove a wrong signature is rejected. Sanitization tests run a curated XSS payload list against the rich-text renderer. Snapshot tests on email templates catch unintentional layout regressions that could expose recipient data.

## Out of scope for v1

These are real threats; v1 is small enough that addressing them would not change the product's risk profile materially. Each lives on `docs/product/v2-wishlist.md` for the v2 review.

- **State-level adversaries.** Middlemist is not engineered to defend against threats with the resources of a nation-state. The threat model assumes opportunistic attackers and curious-but-honest tenants.
- **Supply-chain attacks beyond standard package hygiene.** Dependencies are pinned via `pnpm-lock.yaml`. Renovate or Dependabot is a v2 concern. No SBOM, no per-release artifact signing in v1.
- **Application-layer DDoS beyond rate limiting.** A coordinated burst across many IPs that exhausts Vercel concurrency would degrade the app. The mitigation is Vercel's platform-level controls plus Upstash rate limits; there is no WAF, no Cloudflare in front of the origin in v1.
- **Phishing of the freelancer.** A freelancer who clicks a phishing link and types their password into an attacker's site is outside the application's control. Email verification and rate limits exist; user education does not.
- **Insider threat.** The author has full database access. There is no separation of duties; in v1 the author is the operator. A v2 with paying tenants and outside contributors would split production access.

## Security contact

Security reports go to `hello@middlemist.app`. The current author monitors the inbox personally. There is no bug bounty program in v1; the reporter is asked to provide a clear reproduction and a 30-day private-disclosure window before publishing details.

## Pointer table

| Topic | Doc |
|---|---|
| Authentication and password handling | `docs/security/authentication.md` |
| Magic-link tokens (client portal, password reset) | `docs/security/magic-links.md` |
| Authorization and the freelancer/portal boundary | `docs/security/authorization.md` |
| Rate limits per route and per actor | `docs/security/rate-limiting.md` |
| Input validation conventions | `docs/security/input-validation.md` |
| XSS surfaces and sanitization | `docs/security/xss-and-sanitization.md` |
| CSRF posture and webhook signature verification | `docs/security/csrf.md` |
| Secrets, environment variables, rotation | `docs/security/secrets-and-env.md` |
| PII, retention, deletion, export | `docs/security/data-protection.md` |
| Multi-tenancy enforcement | `docs/architecture/multi-tenancy.md` |
| Public links (proposal, invoice, portal entry) | `docs/architecture/public-links.md` |
| Audit log shape and writing conventions | `docs/architecture/audit-log.md` |
