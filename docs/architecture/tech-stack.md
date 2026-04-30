# Tech stack

Every piece of the stack was picked deliberately. This document records the choice and the reasoning, including the obvious alternative considered for each. The full ADRs in `docs/decisions/` cover the most consequential choices in more depth.

## Stack table

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

## Rationale per choice

### Next.js full-stack vs Next.js + NestJS

Next.js 15 App Router with Server Components, Server Actions, and Route Handlers covers the full surface of this product without a separate API server. A solo developer building a portfolio project benefits from one repository, one deploy target, one set of TypeScript types shared between client and server, and zero API plumbing for ordinary CRUD. NestJS would mirror the stack of CJ's other portfolio project, FiscPlus, but FiscPlus already covers that shape. Middlemist intentionally goes the other direction: full-stack, serverless, edge-friendly. See ADR 0002.

### Prisma vs Drizzle

Prisma 6 wins on familiarity (CJ has used Prisma in FiscPlus), tooling (Prisma Studio is a real productivity boost during early development), and generated types that flow naturally through Server Components. Drizzle has lower runtime overhead and SQL-closer ergonomics, and the migration story is arguably better, but the time cost of switching off Prisma muscle memory outweighs the marginal benefits for a project of this size. See ADR 0003.

### Auth.js v5 vs Clerk

Auth.js v5 (the rewrite of NextAuth, native to Next 15 App Router) is local, free, and self-contained. Clerk would be faster to integrate, prettier out of the box, and would handle email/password recovery and account management for free. The tradeoff is that auth state would live in a third-party identity store, billing kicks in at low volume, and the lock-in is meaningful. Auth.js puts the user table in the freelancer's own Postgres, which is the right place for this product because the rest of the schema already references `User`. The custom UI cost is acceptable; CJ wants to design the auth surface anyway.

### Inngest vs BullMQ + Redis

Inngest is serverless-native: no Redis to operate, no worker process to host, no separate runtime. Cron schedules, event-driven functions, retries, and observability are first-class. BullMQ + Redis is a more familiar pattern for a long-lived Node server, but Middlemist runs on Vercel where there is no long-lived server. Self-hosting Redis adds an environment, a cost, and an operational concern that is not justified at this scale. See ADR 0004.

### Resend vs SendGrid / Postmark / SES

Resend is purpose-built for the React Email ecosystem. Templates are React components rendered to HTML at send time. The free tier covers v1 volume comfortably. SendGrid and Postmark are mature and reliable but neither offers a smoother React Email integration. SES is cheaper at scale but heavier to wire up (SDK, IAM, no first-class template story) and has worse deliverability defaults for new senders. Resend is the clear pick at this stage; replacement at v2 if volume changes the math is straightforward because `lib/email/send.ts` is the only abstraction.

### UploadThing vs raw S3 / R2

UploadThing wraps file uploads with auth, MIME validation, size limits, and a typed React hook in a few lines. Raw S3 or R2 would mean writing presigned-URL flows, multipart upload handling, server-side auth checks per upload, and a client SDK on top. UploadThing's free tier covers v1 volume, and the abstraction is small enough that swapping it out for raw S3 in v2 is a one-file change in `src/lib/uploads/`. The dependency is acceptable.

### react-pdf vs Puppeteer

`@react-pdf/renderer` is pure JavaScript: no Chromium binary on Vercel, no headless browser cold-start penalty (Puppeteer's start time on Vercel is brutal for on-demand PDF), and JSX authoring of layouts. The cost is limited CSS (no flexbox parity with the web, no full-text wrapping in the way HTML does it, no shared component reuse with the rest of the app's UI). For two templates (proposal, invoice) the cost is acceptable. See ADR 0005.

### Upstash Ratelimit vs in-memory or DB-backed

Upstash Ratelimit uses Redis under the hood with a sliding window primitive that is correct and cheap. In-memory rate limits do not work in serverless because there is no memory to share across invocations. DB-backed rate limits are possible (a row per IP with a counter and a window) but every check writes the database, and contention on a hot row is real. Upstash's free tier is generous and the latency is low. The choice is straightforward.

### shadcn/ui vs Material / Chakra / Mantine

shadcn/ui is not a component library that you depend on; it is a set of accessible primitive components copied into the codebase. The product wants a heavy custom theme (Cal.com-adapted visual system, near-black primary CTAs, Inter Display as the display typeface, hairline borders and subtle shadows over heavy elevations). Material and Chakra and Mantine all carry strong design opinions that work against a clean modern-SaaS product. shadcn ships with Radix primitives for behavior and Tailwind for styling, both of which leave the visual design entirely to the project. This is the right shape for Middlemist.

### Tiptap vs Lexical / ProseMirror direct / Slate

Tiptap is a thin React wrapper over ProseMirror with a sane plugin model and good defaults. ProseMirror direct is more flexible but the boilerplate is significant. Lexical is from Meta and is excellent but young; the ecosystem has fewer extensions and the documentation is thinner. Slate is mature but the model has rough edges around schema validation. Tiptap hits the right point on the productivity curve for two editors (proposal blocks, project updates).

### Postgres `pg_trgm` vs Algolia / Meilisearch

Trigram search in Postgres is good enough for v1 at the per-tenant scale Middlemist expects (a few thousand rows per user across all entities). It avoids a second data store, a second index to keep in sync, and a second vendor. Algolia is faster and prettier but adds cost, sync complexity, and another set of API keys. Meilisearch is open-source and excellent but means running another service. The principled answer is to start with `pg_trgm` and migrate to Meilisearch in v2 if real users hit the ceiling.

### Vercel vs Railway / Render / Fly

Next.js on Vercel is the path of least resistance: edge middleware, serverless functions, static asset CDN, environment variables, preview deployments per PR, all wired up by default. Railway, Render, and Fly are all credible alternatives that would work, but the integration cost is higher and the gains (long-lived processes, more flexible runtimes, no cold start) are not relevant for v1. The cost of Vercel at v1 scale is the free tier.

### pnpm vs npm / yarn

pnpm is faster, uses less disk, and has a content-addressable store that handles monorepo and large dependency trees better. npm is fine but slower; yarn (especially classic) has a different workspace model that does not pay off here. pnpm is the default in CJ's other projects.

### Vitest vs Jest

Vitest is the standard for Vite-adjacent and Next.js test suites: ESM-native, faster than Jest, compatible with most Jest assertions and mocks. Jest still works, but the friction with ESM packages (which Middlemist's dependencies include) is real. Vitest plus Playwright (for the few e2e flows that warrant browser tests) covers the surface.

### Plausible vs PostHog / Google Analytics

Plausible is privacy-friendly, cookie-less, lightweight, and matches the product's editorial tone (no tracker noise on the marketing page). PostHog is more capable but heavier and would feel out of place on a content-first surface. Google Analytics is free but the cookie banner cost and the data-sharing tradeoffs are not aligned with the brand. Plausible is the easy call for the marketing surface; the app surface is not analytics-instrumented in v1 because there are no engagement metrics that matter at this stage.

## How to propose changing a stack choice

If a stack item is wrong, write an ADR in `docs/decisions/` that supersedes the relevant ADR (or proposes a new decision if the original was not formally captured). The ADR should describe what changed (in the project, in the world), why the original decision no longer holds, and what migrating costs. Don't swap a piece of the stack without that paper trail; the trail is the value.
