# 0002 — Next.js Full-Stack vs Separate Backend

**Date:** 2026-04-29
**Status:** Accepted

## Context

Middlemist needs a runtime that handles HTTP requests, database access, background jobs, file uploads, email sending, and PDF generation. The author has shipped FiscPlus on a Next + NestJS split, which is a credible architectural pattern. The question for Middlemist is whether to repeat that pattern or go full-stack with a single Next.js application.

Two pressures push in opposite directions. The first is solo-developer velocity: one project is faster to maintain than two. The second is portfolio breadth: shipping a second project that looks identical to the first does not demonstrate range. Whatever Middlemist's stack is, it should be intentionally different from FiscPlus to make both projects valuable as a portfolio set.

## Decision

Build Middlemist as a single Next.js 15 application. Use Server Components for read paths, Server Actions for mutations, and Route Handlers for webhooks and JSON APIs the client portal needs. Do not introduce a separate backend service.

Background work runs on Inngest (covered in ADR 0004). File uploads use UploadThing's hosted handlers, which themselves are a thin layer over Vercel's serverless functions. The Next.js application is the one runtime.

## Consequences

**Positive**

- No API plumbing for ordinary CRUD. Server Actions cover form submissions and mutations end-to-end with no separate route definition, no client SDK, no schema-to-API mapping layer.
- One repository, one CI, one deploy. Simpler operationally and quicker to iterate.
- Types flow naturally: Prisma → repository → Server Action → Client Component prop. No JSON serialization layer in the middle.
- Server Components keep the data-fetch and the render in the same file, which makes pages easier to read and reason about.

**Negative**

- The architecture does not mirror FiscPlus. A reader who is specifically looking for a NestJS sample will not find one in Middlemist. Acceptable, because FiscPlus exists.
- Server Actions and Server Components are newer surfaces of Next.js. Edge cases (caching behavior, error boundaries, streaming) are still maturing as of Next 15. The author needs to read the in-tree docs (per `AGENTS.md`) before relying on memory.
- Long-lived background processes are not a fit for the single-runtime model. Inngest absorbs that need; without Inngest the project would have to host a worker somewhere, which would re-introduce the multi-service complexity that this decision avoids.
- Mobile clients or third-party API consumers would need a layer added. Out of scope for v1; addressable in v2 by exposing JSON Route Handlers as a public API.

## Alternatives Considered

**Next.js + NestJS (the FiscPlus pattern).** Familiar, well-supported, mirrors a common production architecture. Rejected because Middlemist intentionally takes a different shape from FiscPlus, and the operational overhead of running two services is not justified by v1's needs. The full-stack Next.js approach is enough.

**Next.js + Express (or Fastify) for a thin API layer.** A lighter version of the split. Rejected for the same reason: any split adds a deploy target, a CI step, and a request-routing surface; v1 does not benefit from any of that.

**Remix or SvelteKit full-stack.** Both could replace Next.js in this same shape. Covered in ADR 0001; the choice was Next.js for ecosystem and author familiarity.

**Edge-only architecture (Cloudflare Workers + D1 / Hyperdrive + KV).** An interesting alternative for cold-start performance. Rejected because Prisma on Workers is still in transition (the new Prisma engine for Workers is recent; the maturity is below the Vercel + Postgres path for production use today), and the operational model on Workers would mean different code paths for Edge and Node. The simpler picture is one runtime.
