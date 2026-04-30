# 0001: Stack Choice

**Date:** 2026-04-29
**Status:** Accepted

## Context

Middlemist is a freelance operations product being built solo by CJ Jutba over a fixed timeline as both a working tool and a portfolio centerpiece. The product needs to be production-quality (not a tech demo), small enough to ship by one person, and recognizably modern as an engineering case study. The author has prior production experience with Next.js, TypeScript, Prisma, and Postgres. The author has also shipped a separate portfolio project (FiscPlus) on a Next + NestJS split. Middlemist intentionally goes a different direction to demonstrate breadth.

The decision frame is "pick a stack now and stick with it." Late-game stack changes are expensive; early decisions ripple through every layer.

## Decision

The stack:

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

The picks share two properties: serverless-friendly and TypeScript-native. The result is a single repository, a single deploy target, a single set of types from the database to the client form.

## Consequences

**Positive**

- One repository, one deploy target, one CI pipeline. Solo-developer velocity benefits from this.
- Types flow end-to-end: Prisma generates types from the schema, those types are used by repositories and Server Actions, and the same zod schemas validate input on both client and server.
- The hosting model (Vercel + Neon + Upstash + UploadThing + Resend + Inngest) is operationally lightweight. No Docker, no Kubernetes, no Redis to host, no worker process to keep alive.
- The stack is recognizable to a hiring audience. A reader of cjjutba.com can grasp the architecture in five minutes.

**Negative**

- Vendor surface area is wide. Six external services in the runtime path (Vercel, Neon, Upstash, UploadThing, Resend, Inngest). Each is a dependency; each can change pricing, deprecate features, or have an outage. Mitigation: every external service is wrapped behind a thin module so swapping is contained.
- Some choices are non-portable. UploadThing in particular is a higher-level abstraction than raw S3; switching off it later means implementing the abstraction by hand. Acceptable for v1 velocity.
- Cold-start sensitivity. Serverless functions on Vercel have cold-starts; Prisma's startup adds latency. Acceptable at v1 traffic volume.
- The stack does not mirror FiscPlus's NestJS shape. This is an intentional trade for portfolio breadth (covered in ADR 0002).

## Alternatives Considered

**Remix.** Considered. Strong story for nested loaders, progressive enhancement, and form actions. Lost because the broader Next.js ecosystem (deployment, libraries, tutorials) is larger, and Server Actions in Next 15 close most of the productivity gap.

**SvelteKit.** Considered. Strong DX, excellent compiled output. Lost because TypeScript and React are the author's strongest languages; switching would slow the build and the team-fit narrative for the portfolio audience would be weaker.

**Rails.** Considered for the maturity of the framework and the all-included batteries. Lost because the author's day-to-day stack is JS/TS, the integration with React for client interactivity would mean two ecosystems, and the portfolio narrative is "modern web fullstack" not "classic web framework."

**T3 stack (Next + tRPC + Prisma + NextAuth).** Considered. Most of the picks overlap. The difference is tRPC versus Server Actions. Server Actions were chosen because Next 15's first-class action support reduces API plumbing further and the type story is comparable for a single-app project. For a multi-app or mobile-client scenario, tRPC would win; not the situation here.

## Note on visual system

This ADR locks the engineering stack only. The visual system was updated to Cal.com-aligned tokens (white canvas, near-black primary, Inter Display + Inter, 8/12/16px radius scale) after the initial stack lock; see `docs/decisions/0007-visual-system-cal-com-aligned.md` and `docs/design/overview.md` for current tokens.
