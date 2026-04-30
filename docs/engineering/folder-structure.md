# Folder structure

The repository is one Next.js 15 application. There is no separate backend service. Every concern lives somewhere under `src/` with a few peer folders for assets, schema, and tests. This document is the canonical map.

## Tree

```
middlemist/
├── docs/                          # all documentation (architecture, spec, security, engineering, ops, design, decisions, product)
├── prisma/
│   ├── schema.prisma              # data model
│   └── migrations/                # generated migrations + hand-written SQL files
├── public/                        # static assets served directly (favicons, OG images, fonts)
├── src/
│   ├── actions/                   # server actions (one file per entity)
│   ├── app/                       # Next.js App Router routes
│   ├── components/                # React components
│   ├── lib/                       # repositories, services, schemas, utilities
│   ├── styles/                    # globals.css, design tokens
│   └── middleware.ts              # auth gate, rate limiting, CSP
├── tests/
│   ├── e2e/                       # Playwright golden-path tests
│   └── factories/                 # test data factories per entity
├── .env.example                   # environment template
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── next.config.ts
```

## `src/app/`

App Router routes. Layout segments use Next.js 15 route groups in parentheses to share a layout without affecting the URL.

```
src/app/
├── (marketing)/                   # public unauthenticated landing pages (/, /pricing, /about)
├── (auth)/                        # auth flow pages (/login, /signup, /forgot-password, /reset-password/[token], /verify-email/[token])
├── (app)/                         # authenticated freelancer app
│   ├── layout.tsx                 # shared shell (sidebar, top bar, command palette)
│   ├── dashboard/
│   ├── clients/
│   ├── projects/
│   ├── proposals/
│   ├── invoices/
│   ├── time/
│   └── settings/
├── p/                             # public proposal view
│   └── [token]/
│       ├── page.tsx
│       └── accept/route.ts        # public POST: accept or decline
├── i/                             # public invoice view
│   └── [token]/page.tsx
├── portal/                        # client portal (magic-link cookie auth)
│   ├── [token]/route.ts           # magic-link redemption
│   ├── layout.tsx
│   ├── page.tsx
│   ├── projects/
│   ├── proposals/
│   └── invoices/
└── api/                           # route handlers (webhooks + non-action mutations)
    ├── auth/[...nextauth]/route.ts
    ├── inngest/route.ts
    ├── uploadthing/route.ts
    ├── email/webhook/route.ts
    ├── pdf/
    │   ├── proposal/[id]/route.ts
    │   ├── invoice/[id]/route.ts
    │   └── public/
    │       ├── proposal/[token]/route.ts
    │       └── invoice/[token]/route.ts
    ├── search/route.ts
    └── health/route.ts
```

**`(marketing)/`** — public unauthenticated pages. Plausible loads here. No `app/(app)` chrome. Inter Display 600 for hero headlines per `docs/design/typography.md`.

**`(auth)/`** — sign-up, log-in, and recovery surfaces. Forms are client components; actions live in `src/actions/auth.ts`. The route group does not require a session.

**`(app)/`** — the authenticated freelancer experience. Middleware enforces a session cookie; unauthenticated requests redirect to `/login`. Layouts share the sidebar, the top bar, and the command palette. Each module (clients, projects, proposals, invoices, time, settings) is a folder with `page.tsx` + child segments per the spec.

**`p/[token]/`** — the public proposal view. Loads outside `(app)` so the route is reachable without a session. Renders Tiptap output through the sanitized renderer. POSTs to `/p/[token]/accept` for acceptance.

**`i/[token]/`** — the public invoice view. Same shape as `/p/[token]` but read-only.

**`portal/`** — the client portal. Magic-link redemption at `/portal/[token]/route.ts`; the redemption issues a portal cookie and redirects to `/portal`. Subsequent routes use the cookie for auth. The layout is editorial (Inter Display headlines, generous whitespace, no app sidebar).

**`api/`** — route handlers. Webhooks live here (Inngest, UploadThing, Resend); the public PDF endpoints live here; the search JSON endpoint and the `/api/health` check live here. Route handlers are reserved for cases where a JSON response or a webhook signature workflow is required; mutations from the freelancer's UI go through Server Actions.

## `src/components/`

React components grouped by surface and concern.

```
src/components/
├── ui/                            # shadcn primitives (Button, Input, Card, Dialog, ...) themed to design tokens
├── app/                           # composite components used inside (app) routes
│   ├── ClientList.tsx
│   ├── ProjectHeader.tsx
│   ├── InvoiceLineItems.tsx
│   └── ...
├── proposal-editor/               # Tiptap-based proposal authoring surface
├── invoice-builder/               # invoice line-item editor and live preview
├── tiptap/                        # Tiptap configuration shared between editors
├── rich-text/                     # the two whitelisted dangerouslySetInnerHTML renderers
│   ├── proposal-block-renderer.tsx
│   └── update-renderer.tsx
├── marketing/                     # marketing-only components (Hero, FeatureGrid, PricingTable)
└── portal/                        # client portal-only components
```

**`ui/`** — shadcn/ui primitives, themed to Cal.com-aligned tokens. Buttons use `{rounded.md}` (8px), cards use `{rounded.lg}` (12px), every fill is one of the surface tokens (`{colors.canvas}`, `{colors.surface-soft}`, `{colors.surface-card}`). The primitives live here and are imported by every other component folder.

**`app/`** — composite components specific to the authenticated app: client list rows, project headers, dashboard widgets. These are server components by default; opt into `"use client"` only for interactivity.

**`proposal-editor/`**, **`invoice-builder/`**, **`tiptap/`** — heavy editor surfaces. Each is lazy-loaded from its parent page through `next/dynamic` to keep the initial JS bundle small.

**`rich-text/`** — the two files allowed to call `dangerouslySetInnerHTML`. ESLint enforces the boundary; `docs/security/xss-and-sanitization.md` documents the pattern.

**`marketing/`** and **`portal/`** — kept separate from `app/` because the visual language differs (marketing leans into Inter Display, portal renders editorial document layouts).

## `src/lib/`

Server-only and shared logic.

```
src/lib/
├── prisma.ts                      # the single PrismaClient instance
├── env.ts                         # validated environment reader
├── auth/
│   ├── config.ts                  # Auth.js v5 config
│   ├── with-auth.ts               # server action wrapper
│   ├── password.ts                # bcrypt helpers
│   ├── tokens.ts                  # JWT helpers for email verify and password reset
│   └── portal-tokens.ts           # nanoid + sha256 helpers for portal magic links
├── schemas/                       # zod schemas (one per entity)
│   ├── auth.schema.ts
│   ├── client.schema.ts
│   ├── project.schema.ts
│   ├── proposal.schema.ts
│   ├── invoice.schema.ts
│   ├── time-entry.schema.ts
│   ├── update.schema.ts
│   ├── settings.schema.ts
│   ├── search.schema.ts
│   └── webhook.schema.ts
├── repositories/                  # the only place Prisma is imported
│   ├── users.repo.ts
│   ├── clients.repo.ts
│   ├── projects.repo.ts
│   ├── tasks.repo.ts
│   ├── time-entries.repo.ts
│   ├── updates.repo.ts
│   ├── proposals.repo.ts
│   ├── invoices.repo.ts
│   ├── client-portal.repo.ts
│   ├── files.repo.ts
│   └── audit.repo.ts
├── services/                      # business logic that combines repos
│   ├── proposals.service.ts
│   ├── invoices.service.ts
│   ├── projects.service.ts
│   ├── time.service.ts
│   ├── fx.service.ts
│   └── search.service.ts
├── inngest/
│   ├── client.ts                  # Inngest client
│   └── functions/                 # one file per scheduled or event-driven function
├── email/
│   ├── send.ts                    # the only Resend client wrapper
│   └── templates/                 # React Email templates + fixtures
├── pdf/
│   ├── proposal-pdf.tsx           # @react-pdf/renderer
│   └── invoice-pdf.tsx
├── audit/
│   ├── write.ts                   # audit-write helper
│   └── registry.ts                # action → metadata zod schema map
├── ratelimit.ts                   # Upstash Ratelimit limiters
├── sentry.ts                      # Sentry init for server runtime
├── log.ts                         # structured logger
├── rich-text/                     # render + sanitize helpers (Tiptap → HTML → sanitize-html)
└── utils/                         # shared utilities (date formatting, currency, slugify, errors)
```

**`prisma.ts`** — exports `prisma` (a `PrismaClient` instance with the standard "reuse across HMR reloads" pattern in development). Imported only by files in `src/lib/repositories/`. The ESLint rule `no-direct-prisma` enforces this.

**`env.ts`** — the validated `env` object. The single source of truth for environment variables (see `docs/security/secrets-and-env.md`). No file outside `lib/` reads `process.env` directly.

**`auth/`** — Auth.js configuration, the `withAuth` server action wrapper, password hashing, and token signing helpers. The only place that talks to Auth.js internals.

**`schemas/`** — zod schemas, one file per entity, named `<entity>.schema.ts` per the convention in `CLAUDE.md`. Imported by both forms (resolver) and server actions (parse).

**`repositories/`** — the only place Prisma is imported. Each repo file exports an object literal with named functions; every public function takes `userId` as its first argument. See `docs/engineering/repository-pattern.md`.

**`services/`** — business logic that combines repos with side effects (audit, Inngest, FX lookup). Services orchestrate; repos query.

**`inngest/`** — Inngest client and functions. Each function is a separate file named `<event-or-schedule>.ts`. Functions are registered in the route handler (`src/app/api/inngest/route.ts`).

**`email/`** — `sendEmail` wrapper and React Email templates. Templates live in `templates/` with fixtures in `__fixtures__/`. The preview server (`pnpm email:dev`) renders fixtures.

**`pdf/`** — `@react-pdf/renderer` templates. One file per PDF (proposal, invoice). The PDF route handlers in `src/app/api/pdf/` import these.

**`audit/`** — the `writeAudit` helper and the zod schema registry mapping action names to metadata shapes.

**`ratelimit.ts`** — every Upstash Ratelimit instance. Imported by middleware and by `withAuth`.

**`utils/`** — shared utilities. No business logic. Date formatting, currency formatting (always paired with an ISO code), slugify, the error class hierarchy used by services and actions.

## `src/actions/`

Server Actions. One file per entity. Each file exports a named action that is wrapped in `withAuth` (or named with `Public` suffix for public-token actions).

```
src/actions/
├── auth.ts                        # signup, login (passthrough to Auth.js), forgot-password, reset-password, change-password
├── clients.ts                     # createClient, updateClient, archiveClient
├── projects.ts                    # createProject, updateProject, transitionStatus, archiveProject
├── tasks.ts                       # createTask, updateTask, transitionStatus, deleteTask
├── time-entries.ts
├── updates.ts
├── proposals.ts                   # createProposal, sendProposal, regenerateToken, acceptProposalPublic, declineProposalPublic
├── invoices.ts                    # createInvoice, sendInvoice, markPaid, markVoid, regenerateToken
├── settings.ts
├── search.ts                      # globalSearch
└── portal.ts                      # issuePortalLink, revokePortalSession
```

**Naming.** Actions are camelCase verbs. Public-token actions end with `Public` (`acceptProposalPublic`). Internal actions do not need a suffix.

**Forbidden in `src/actions/`.** Direct Prisma imports (use a repo). Inline business logic of any complexity (use a service). Unwrapped exports (use `withAuth` or `withPublicRateLimit` per `docs/engineering/server-actions.md`).

## `src/middleware.ts`

The single Edge middleware. Three responsibilities:

1. **Auth gate.** Redirect unauthenticated requests to `app/(app)/*` to `/login`.
2. **Rate limiting.** Apply IP-based limits to public surfaces (login, signup, public-link routes).
3. **Security headers.** Set CSP, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`.

The middleware does not query Prisma (no Edge-compatible Prisma in v1). Auth-gate decisions read the session cookie and verify its signature in-line; full session lookup happens in the Node runtime.

## `src/styles/`

```
src/styles/
├── globals.css                    # Tailwind directives + design token CSS variables
└── tokens.css                     # design tokens (colors, radii, spacing, type scale)
```

`tokens.css` defines the variables (`--color-primary`, `--rounded-md`, `--spacing-32`, etc.) and is imported once at the root of `globals.css`. Tailwind's theme configuration references the variables so utility classes (`bg-primary`, `rounded-md`, `p-32`) resolve to the tokens. Hard-coded hex values and inline radii in component code are forbidden by `CLAUDE.md`.

## `tests/`

```
tests/
├── e2e/                           # Playwright tests (golden path, public proposal acceptance, magic-link redemption)
│   ├── golden-path.spec.ts
│   ├── public-proposal.spec.ts
│   └── portal-magic-link.spec.ts
├── factories/                     # test data factories (one per entity)
│   ├── user.factory.ts
│   ├── client.factory.ts
│   ├── project.factory.ts
│   └── ...
└── setup/                         # test bootstrap (database seeding, env loading)
```

Vitest unit and integration tests live in `__tests__/` folders next to the source they cover (e.g., `src/lib/repositories/__tests__/clients.repo.test.ts`). Playwright tests live in `tests/e2e/` and run against a running dev server.

## File naming rules

- **Non-component files.** kebab-case (`proposals.action.ts`, `clients.repo.ts`, `with-auth.ts`).
- **React component files.** PascalCase matching the default export (`ClientList.tsx`, `ProposalEditor.tsx`).
- **Suffix conventions.** `*.repo.ts` for repository files, `*.service.ts` for services, `*.schema.ts` for zod schemas. The convention is enforced informally in code review; CI does not check filenames.
- **Test layout mirrors source.** A function in `src/lib/services/proposals.service.ts` has its tests in `src/lib/services/__tests__/proposals.service.test.ts`.

## Test layout

Unit and integration tests sit beside the code under test. The `__tests__` folder is conventional and most editors collapse it; `*.test.ts` files at the same level are also acceptable when the file count is small.

```
src/lib/repositories/
├── clients.repo.ts
└── __tests__/
    └── clients.repo.test.ts
```

E2E tests are kept separate (`tests/e2e/`) because they boot a server and run against a live URL; mixing them with unit tests would slow the watcher.
