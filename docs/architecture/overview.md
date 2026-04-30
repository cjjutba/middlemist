# Architecture overview

Middlemist is a Next.js full-stack application deployed on Vercel, backed by a Postgres database on Neon, with Inngest for background jobs, Resend for transactional email, and UploadThing for file storage. There is no separate backend service. The application server, the API routes, the rendering, the webhook handlers, and the public document views all run inside one Next.js project.

This document gives the system-level shape: the components, where they live, and how a typical request flows through them. Specific subsystems (the data model, multi-tenancy, jobs, email, files, PDF, audit, search, FX, public links) each have their own architecture document. Read those before touching the matching code.

## Components

```
                     ┌──────────────────────────────────────┐
                     │            Browser                   │
                     │  (freelancer or unauthenticated      │
                     │   client viewing a public link)      │
                     └────────────────┬─────────────────────┘
                                      │ HTTPS
                                      ▼
                  ┌──────────────────────────────────────────┐
                  │             Vercel                       │
                  │                                          │
                  │  ┌──────────────────────────────────┐    │
                  │  │  Edge: middleware (auth gate,    │    │
                  │  │  rate-limit lookups)             │    │
                  │  └──────────────────────────────────┘    │
                  │  ┌──────────────────────────────────┐    │
                  │  │  Node: Server Components,        │    │
                  │  │  Server Actions, Route Handlers, │    │
                  │  │  PDF generation, webhooks        │    │
                  │  └──────────────────────────────────┘    │
                  └──┬─────────┬───────────┬─────────┬───────┘
                     │         │           │         │
                     ▼         ▼           ▼         ▼
                  ┌─────┐  ┌─────┐    ┌─────────┐ ┌──────────┐
                  │Neon │  │Inn- │    │ Resend  │ │ Upload-  │
                  │ PG  │  │gest │    │  +      │ │  Thing   │
                  │     │  │     │    │ React   │ │          │
                  │     │  │     │    │ Email   │ │          │
                  └─────┘  └─────┘    └─────────┘ └──────────┘
                              │
                              │ scheduled cron + event-driven
                              │ functions invoked back
                              ▼
                  ┌──────────────────────────────────────┐
                  │  /api/inngest (handler in Vercel)    │
                  └──────────────────────────────────────┘
```

External services beyond the four above:

- **Upstash Ratelimit** for sliding-window rate limits on public routes (called from middleware and route handlers).
- **Sentry** for error tracking from both Edge and Node runtimes.
- **Plausible** for privacy-friendly analytics on the marketing surface (not on authenticated app routes).
- **exchangerate.host** for daily FX refresh, called from the `fx.refresh` Inngest job.

## Where rendering happens

- **Server Components** are the default. Page-level files (`app/(app)/clients/page.tsx`, etc.) are server components that read from the database via repository functions and render HTML on Vercel's Node runtime.
- **Client Components** (`"use client"`) wrap interactive surfaces only: forms with live validation, the proposal editor (Tiptap), the time tracker, the command palette. Client components do not call Prisma; they call Server Actions or fetch from route handlers.
- **Server Actions** handle mutations. Every form submission, every status change, every "send" button calls a Server Action via `useFormState` or a manual fetch. Server Actions are wrapped with `withAuth` (extracts `userId`) and validate input with zod.
- **Route Handlers** (`route.ts`) are used for webhooks (Inngest, UploadThing, Resend bounce), public PDF generation endpoints, and the few JSON APIs the client portal needs (search, paginated lists).

## Boundaries

- **Middleware** runs on the Edge runtime. It gates `app/(app)/*` routes behind authentication, redirects unauthenticated users to `/login`, and applies coarse rate limits to public routes. Middleware does not query Prisma (no Edge-compatible Prisma in v1).
- **Public routes** (`/p/[token]`, `/i/[token]`, `/portal/[token]`) live outside the `(app)` segment and do not require a session. They look up data by token only and render server-side.
- **Webhook handlers** (`/api/inngest`, `/api/uploadthing`, `/api/email/bounce`) are Route Handlers signed and verified at the boundary. They authenticate by signature, not by session.

## Three example request flows

### 1. Freelancer creates a proposal (Server Action path)

1. Freelancer is on `/proposals/new`. The page is a Server Component that renders an empty proposal scaffold.
2. The proposal editor is a Client Component (Tiptap + form state). The freelancer fills in the title, the recipient client, and the body blocks.
3. Clicking "Save draft" invokes the `createProposal` Server Action.
4. The action runs through `withAuth`: the session cookie is verified, `userId` is extracted, the input is validated by `proposalSchema.parse`.
5. The action calls `proposalsRepo.create(userId, input)`, which writes the row through Prisma with `userId` injected.
6. The action writes an audit log entry (`proposal.created`).
7. The action returns `{ ok: true, data: { id } }`. The client component routes to `/proposals/[id]`.
8. The page reads the new proposal via `proposalsRepo.findById(userId, id)` on the server and renders it.

### 2. Client opens a proposal via public link (unauthenticated path)

1. Client clicks a link in an email: `https://middlemist.app/p/Lk3...nano`.
2. Middleware sees the route is public and runs a token-bucket rate limit by IP (Upstash). If exceeded, returns 429.
3. The Server Component at `app/p/[token]/page.tsx` calls `proposalsRepo.findByPublicToken(token)`. No session is required. The repo function looks up by token only, returns the proposal or null.
4. If not found, the page renders a generic "this proposal is no longer available" view.
5. If found, the page checks status: if `expired`, render expired view. Otherwise render the proposal.
6. The page emits an audit event: `proposal.viewed` with IP and user agent.
7. The audit handler also fires an Inngest event `proposal.viewed`, which sends an in-app notification to the freelancer and an email if the freelancer has notifications enabled.
8. If the freelancer's first view tracking is unset, the audit handler updates `proposal.viewedAt` to now.
9. The client clicks "Accept." A Server Action `acceptProposal(token, signatureData)` runs without auth, validates the proposal is sendable, marks it accepted, fires `proposal.accepted` event, and returns the updated state.

### 3. Daily FX refresh (Inngest cron path)

1. Inngest's scheduler fires `fx.refresh` at 06:00 UTC daily.
2. Inngest sends an HTTP POST to `/api/inngest` on the Vercel deployment. The handler dispatches to the registered function.
3. The function fetches `https://api.exchangerate.host/latest?base=USD` and reads rates for PHP, EUR, GBP, AUD, CAD.
4. Repeat for each supported base currency (or use a single base and derive crosses).
5. The function upserts each `(base, quote)` pair into `FxRate` with the new rate and `fetchedAt = now`.
6. The function logs success metrics to the application log (visible in Vercel and Sentry breadcrumbs).
7. If the upstream API is down, the function lets Inngest retry per its default policy. Stale rates are flagged to the user when older than 48 hours by the dashboard.

## Boundaries summary

| Concern                   | Where it lives                                                   |
| ------------------------- | ---------------------------------------------------------------- |
| Auth gate                 | Middleware                                                       |
| Mutation entry            | Server Actions (`*.action.ts`)                                   |
| Read entry                | Server Components calling repo functions                         |
| Webhook verification      | Route handlers in `app/api/*/route.ts`                           |
| Public document rendering | Pages outside `(app)` segment                                    |
| Background work           | Inngest functions in `src/lib/inngest/functions/*.ts`            |
| Email sending             | `src/lib/email/send.ts`                                          |
| File uploads              | UploadThing handlers in `src/app/api/uploadthing/core.ts`        |
| Rate limiting             | `src/lib/ratelimit.ts` called from middleware and route handlers |

The architecture is intentionally boring: one repo, one platform, one runtime, one ORM. The complexity is in the product, not the infrastructure.
