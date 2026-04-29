@AGENTS.md

# Middlemist — Project Context

## What this is

Middlemist is a freelance operations tool for solo developers. It connects the lifecycle of a freelance engagement: a lead becomes a proposal, an accepted proposal becomes a project, the project tracks tasks, time, and updates, and the work bills out as an invoice. The client sees a clean, branded portal showing only what they need to see.

The author is CJ Jutba, a freelance full-stack developer based in the Philippines. He is the primary user. Other freelance developers are secondary users. This is a portfolio project. It is also a real tool used by the author. It is not a venture business. Success is defined as: shipped, used, and presented as a polished case study on cjjutba.com.

## The 7 product principles

1. **Project is the central object.** Everything (tasks, time, updates, invoices, proposals) attaches to a project.
2. **The client view is sacred.** It must feel like a designed document, not a SaaS page.
3. **Lean, opinionated, finished beats broad and half-built.** Cut anything that is not in v1 scope.
4. **No video, no payments, no leads pipeline in v1.** Settled.
5. **Editorial over dashboard.** Typography and whitespace beat charts and stat tiles.
6. **Multi-tenant from day one.** Every query filtered by `userId`. Every test verifies isolation.
7. **Document the build.** Every architectural decision lives in `docs/decisions/`. Every shipped feature gets a screenshot for the case study.

When principles conflict: multi-tenancy beats everything (a leak is a product-ending bug). Project-as-central beats editorial (consistency over local prettiness). Lean beats feature-rich (always).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Neon |
| ORM | Prisma 6 |
| Auth | Auth.js v5 (NextAuth) |
| Background jobs | Inngest |
| Email | Resend + React Email |
| Files | UploadThing |
| PDF | `@react-pdf/renderer` |
| Rate limiting | Upstash Ratelimit |
| Components | shadcn/ui (heavily themed) |
| Editor | Tiptap v2 |
| Forms | react-hook-form + zod |
| Validation | zod (shared client/server) |
| Search | Postgres `pg_trgm` |
| Hosting | Vercel |
| Package manager | pnpm |
| Testing | Vitest + Playwright |
| Error tracking | Sentry |
| Analytics | Plausible |
| FX | exchangerate.host |

Rationale for each choice lives in `docs/architecture/tech-stack.md` and the relevant ADR in `docs/decisions/`.

## Design tokens (locked)

- **Accent color:** `#5A7A4F` (deep moss). The signature color. Used sparingly: primary actions, active state indicators, brand marks.
- **Radius:** `7px`. The signature corner radius. Applied to cards, inputs, buttons, modals. Do not vary it without reason.
- **Typography:**
  - **UI:** Inter (variable, 400/500/600).
  - **Headings:** Inter Display (where loaded; falls back to Inter).
  - **Editorial body:** Source Serif 4. Used in public document views (proposal, invoice, client portal). Not used in app chrome.
  - **Mono:** JetBrains Mono. Code, IDs, numeric tables.
- **No dark mode in v1.** Do not add a theme toggle. Do not add `dark:` variants. The product is editorial light-on-paper by intent.

Tokens live in `src/styles/tokens.css` (placeholder until written) and are exposed to Tailwind via the theme config. Do not write inline color or radius values; reference the token.

## Multi-tenancy is non-negotiable

Every authenticated query is filtered by the current user's `userId`. The model is shared database, row-level isolation. The reasoning, full architecture, and enforcement layers are documented in `docs/architecture/multi-tenancy.md`. Read that file before writing any data-access code.

The four enforcement layers are:

1. **Repository pattern.** All Prisma access flows through functions in `src/lib/repositories/*.repo.ts`. Each function takes `userId` as its first argument and injects it into every Prisma `where` clause. Direct `prisma.*` calls outside `src/lib/repositories/` are forbidden by ESLint.
2. **Server Action wrapper.** A `withAuth` wrapper extracts `userId` from the session and passes it to the action. No action ever accepts `userId` from client input.
3. **Public-link tables.** Proposals and Invoices have a `publicToken` column for unauthenticated viewing. The token is the only access proof. Public routes look up by token and return only the rows that match. Tokens never expose `userId` to the client.
4. **Tests.** Every repository function has a two-user isolation test: insert data for user A and user B, verify that A's queries cannot see B's data and vice versa. New repos without isolation tests do not pass review.

A single missed `userId` filter is a leak. Treat it like a SQL injection: not "a bug to fix later," but a rollback-the-PR event.

## Naming conventions

- **camelCase** for variables, functions, hooks, and component props.
- **PascalCase** for React components, TypeScript types, classes, enums.
- **kebab-case** for filenames, except React component files which match the PascalCase component name.
- **`.repo.ts`** suffix for repository files (`clients.repo.ts`).
- **`.service.ts`** for domain services that combine repos with business logic (`fx.service.ts`).
- **`.schema.ts`** for zod schemas (`proposal.schema.ts`).
- **`.action.ts`** for Server Action modules (`proposals.action.ts`).
- **`use*`** prefix for hooks (`useProposalDraft`).
- **Boolean variables** read as predicates: `isPublished`, `hasDraft`, `canArchive`. Never `published`, `draft`, `archive` for booleans.
- **Database columns:** camelCase in Prisma schema, mapped to snake_case columns via `@map` only when migrating from existing data; for greenfield tables, use camelCase end-to-end.
- **Route segments:** kebab-case (`/clients/new`, `/proposals/[id]/edit`).

## Forbidden patterns

- **No `dangerouslySetInnerHTML`** outside the two whitelisted rich-text renderers (`src/components/rich-text/proposal-block-renderer.tsx` and `src/components/rich-text/update-renderer.tsx`). Both render Tiptap output that has been sanitized server-side. New uses require an ADR.
- **No direct Prisma imports outside `src/lib/repositories/`.** Importing `@/lib/prisma` from a Server Action, route handler, or component is a CI failure. All access goes through a repo function.
- **No `any` type.** Use `unknown` and narrow. If a third-party type is wrong, write a local type and cast at the boundary, not internally.
- **No inline styles outside design tokens.** A `style={{ color: '#fff' }}` is a CI failure unless the value is a CSS variable from the token system.
- **No client components in `app/(app)/` route handlers.** Route handler files (`route.ts`) and the page-level Server Component (`page.tsx`) stay on the server. Client interactivity lives in component children marked `"use client"`.
- **No `process.env` outside `src/lib/env.ts`.** Environment access is centralized and validated with zod at startup.
- **No `console.log` in committed code.** Use the `logger` in `src/lib/log.ts`. Sentry is wired through it.
- **No `Promise<void>` for mutations** that should return data. Server Actions return a typed result envelope (`{ ok: true, data } | { ok: false, error }`) or throw a typed error.

## Cut from v1 (do not implement)

These are explicitly out of scope. If asked to add one, reply with a pointer to `docs/product/v2-wishlist.md` and resist the temptation:

- Video calls.
- Payment processing (Stripe, Lemon Squeezy, PayMongo).
- Recurring invoices.
- Team accounts (multi-user per tenant).
- Native mobile apps.
- Calendar sync (Google, Apple, Outlook).
- Webhook integrations (Zapier, Make).
- Two-factor authentication.
- Multi-language UI (the app is English-only; client-facing documents support per-document copy edits but no full i18n).
- Dark mode.
- Advanced analytics dashboards.
- BIR / tax compliance features.
- Contracts module (separate from proposals).
- Expense tracking.
- Mileage tracking.
- Lead pipeline / CRM stages.

When tempted to add a feature mid-build, write it in `docs/product/v2-wishlist.md` and keep moving. The wishlist is the parking lot.

## Definition of "feature done"

A feature is not done until all of the following are true:

1. **Typed end to end.** Inputs and outputs typed at every boundary (form, server action, repo, response).
2. **Validated with zod at the action boundary.** Every Server Action and route handler parses input through a zod schema before the business logic runs. The schema is shared with the client form.
3. **Repository function written.** No direct Prisma access from the action layer.
4. **Multi-tenant isolation test passing.** Two-user test that proves cross-tenant reads return empty.
5. **Documented in the relevant `docs/spec/` file.** The spec is updated to match the shipped behavior, including any deviations.
6. **ADR added** in `docs/decisions/` if the feature introduces a new architectural pattern (a new background job pattern, a new caching strategy, a new auth flow, etc.).
7. **Screenshot captured** for the case study folder.

Half-finished features do not get merged. If a feature is too large for one PR, the spec is split first, not the implementation.

## Pointer table — when to load which doc

Claude Code sessions should load these files alongside `CLAUDE.md` based on the work in front of you:

| When working on... | Load these |
|---|---|
| Authentication, sessions, password reset | `docs/security/authentication.md` (Wave 2), `docs/architecture/multi-tenancy.md` |
| Any feature module (proposals, invoices, etc.) | The matching `docs/spec/<module>.md` (Wave 3) |
| Adding a background job | `docs/architecture/background-jobs.md`, `docs/architecture/email-system.md` if the job sends mail |
| Adding a Prisma model | `docs/architecture/data-model.md`, `docs/architecture/multi-tenancy.md` |
| Adding a public link or token | `docs/architecture/public-links.md` |
| Adding a new email template | `docs/architecture/email-system.md` |
| Adding a file upload context | `docs/architecture/file-uploads.md` |
| Anything involving money | `docs/architecture/fx-and-currency.md` |
| Adding search to a new entity | `docs/architecture/search.md` |
| Adding a PDF | `docs/architecture/pdf-generation.md` |
| Adding an audit-relevant action | `docs/architecture/audit-log.md` |
| Considering a new architectural pattern | Read existing ADRs in `docs/decisions/`, then write a new one |
| Wondering "should this be in v1?" | `docs/product/principles.md`, `docs/product/v2-wishlist.md` |

When in doubt, start with `docs/README.md` for the full map.

## Process notes

- Don't create files outside `docs/`, `src/`, `prisma/`, `public/`, `tests/`, and the project root config files. Don't create `notes.md`, `scratch.md`, `plan.md`, or analysis files unless asked.
- Don't write comments that re-state the code. Don't reference the current task ("added for issue #X") in code comments.
- Don't add backwards-compatibility shims. The codebase has no users to keep working — change the code in place.
- Don't ship feature flags as a hedge. Ship the feature or don't.
- Read the relevant Next.js 15 docs in `node_modules/next/dist/docs/` before writing routing or rendering code. The version in this repo has breaking changes from older Next versions and from training-data assumptions.

The project is small enough that being clear and consistent matters more than being clever. Write the boring, correct version.
