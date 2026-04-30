# Performance

v1 is small and Vercel handles most of the difficult performance work. The targets below are deliberately modest: a snappy authenticated app on a typical broadband connection, no surprise spikes on the marketing surface, and predictable cost envelopes for the providers in the stack. Performance work above what is documented here is v2's problem.

## Database

**No N+1 queries.** A page that lists projects with their client name uses a single query with `include: { client: { select: { ... } } }` rather than N follow-up reads. The repository pattern makes this explicit because every list function returns the data shape the caller needs; if a caller needs the client name, the repo returns it.

```typescript
// CORRECT — one query
async listWithClient(userId: string) {
  return prisma.project.findMany({
    where: { userId, archivedAt: null },
    include: { client: { select: { id: true, name: true, companyName: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

// FORBIDDEN — N+1
async list(userId: string) {
  const projects = await prisma.project.findMany({ where: { userId } });
  for (const p of projects) {
    p.client = await prisma.client.findUnique({ where: { id: p.clientId } });
  }
  return projects;
}
```

**Indexes.** Per `docs/architecture/data-model.md`. Every table has at minimum `(userId, createdAt)` for "list this user's recent rows" and entity-specific indexes for any frequently-filtered field. New repo functions verify their query is index-covered before merging; a new query that does a sequential scan on a multi-tenant table is a performance bug.

**Query budget.** A page renders in ≤5 database queries on the typical path. The dashboard has the most queries (recent activity, upcoming deadlines, key metrics); even there, the budget caps at 5 with `Promise.all` running them concurrently. Pages that exceed the budget are split: the heavier sections move into `<Suspense>` boundaries that stream after the first paint.

**Pagination always.** Lists default to 25 rows per page, max 100. The repository function takes `{ skip, take }` and the page renders a "load more" or numbered pagination control. Unbounded list queries are forbidden (an account that grows to 1,000 invoices would otherwise serialize 1,000 rows on every dashboard load).

```typescript
async list(userId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.client.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
    skip: opts.skip ?? 0,
    take: Math.min(opts.take ?? 25, 100),
  });
}
```

The `Math.min` cap at 100 prevents a malicious caller from requesting `take: 1000000` to spike memory.

## React

**Server Components by default.** A page that does not need browser interactivity stays on the server. Server-rendered HTML is the fastest path to a first paint; the JS bundle is correspondingly smaller.

**Lazy-load heavy editors.** The Tiptap editor, the `@react-pdf/renderer` preview, and the invoice line-item builder are loaded with `next/dynamic`:

```typescript
import dynamic from "next/dynamic";

const ProposalEditor = dynamic(() => import("@/components/proposal-editor"), {
  ssr: false,
  loading: () => <ProposalEditorSkeleton />,
});
```

`ssr: false` keeps the editor's client bundle out of the server-rendered HTML. The skeleton renders during the network round-trip; the editor swaps in once its bundle loads.

**`next/image` for images.** Profile photos, business logos, proposal images, and update attachments all flow through `next/image`. The component handles responsive sizes, lazy loading, and format negotiation (AVIF or WebP where supported). Inline `<img src=>` tags are forbidden by ESLint outside the rich-text renderer (where the image is part of sanitized HTML output).

**Bundle budget.** The dashboard's first-load JS budget is 250 KB (gzipped). The marketing landing page budget is 150 KB. The numbers are checked manually during major changes through Vercel's analyzer panel:

```bash
ANALYZE=true pnpm build
```

`@next/bundle-analyzer` produces a treemap that shows the largest dependencies in each route. A new dependency that adds 50+ KB to a critical route gets a code-split or a smaller alternative; the analysis happens before the dependency lands.

## Network

**Cache busting.** Static assets in `public/` carry a content hash in their URL when imported through `next/image` or via `import logo from '@/public/logo.svg'`. Direct references like `<img src="/logo.svg">` rely on the immutable cache headers Next.js sets for the public folder.

**SWR/cache headers on read-heavy public routes.** The public proposal and invoice routes (`/p/[token]`, `/i/[token]`) cache for 60 seconds with a stale-while-revalidate window:

```typescript
// src/app/p/[token]/page.tsx (excerpt)
export const revalidate = 60;
```

A burst of opens on the same proposal hits the cached page; the row is queried at most once per minute. The cache is keyed per-token so two different tokens are independent.

**Deferred static rendering** is an option for the marketing pages once their content stabilizes. Pre-rendering at build time (`export const dynamic = 'force-static'`) avoids any per-request work. v1 uses `revalidate: 3600` so marketing pages re-render hourly without manual invalidation.

## Background jobs

**Don't block server actions on slow integrations.** The "send proposal" action enqueues an Inngest event and returns; the Inngest handler renders the email and dispatches through Resend. The user's click-to-response time is unaffected by Resend's latency.

```typescript
// service: enqueue, do not await delivery
await inngest.send({ name: "proposal.sent", data: { userId, proposalId } });
return updated;
```

If the integration must be synchronous (rare; only the FX manual-refresh action), the action surfaces a "this might take a moment" indicator and runs the call inline.

**Idempotency.** Inngest functions are idempotent. A retry must produce the same end state as a single run. Tests prove this for every function (run twice, assert state matches running once). Idempotency keys are sourced from the event payload (`event.data.proposalId` for `proposal.sent`) so a duplicate event does not double-send the email.

## Monitoring

**Vercel Analytics.** Real-user performance metrics on every page (first-byte time, largest contentful paint, cumulative layout shift). The dashboard is the operator's first stop when investigating "the app feels slow."

**Sentry Performance.** Slow transactions are captured as performance traces. The default sample rate is 10% in production; that is enough to surface a regression without pumping the Sentry quota. A trace for a slow page shows the Prisma queries it ran and their duration, which is the fastest path to "this page does an N+1."

**Inngest dashboard.** Per-function run time, retry count, and queue depth. A function that consistently takes longer than expected (or retries frequently) is a flag.

**Provider dashboards.** Resend (delivery latency), UploadThing (storage and bandwidth), Upstash (request latency, cache hit rate), Neon (query duration p50/p95). Checked weekly during the build phase, monthly after launch.

## Edge cases

**Big proposal blocks.** A proposal with 50 image blocks loads slowly because each image is fetched. Lazy-loading via `loading="lazy"` (set by the rich-text sanitizer's image transform) means images below the fold defer until scroll. The cap at 100 blocks per proposal (enforced by the schema) bounds the worst case.

**Big invoice line-item lists.** An invoice with 100 line items renders fine in HTML and in the PDF. The line-item editor virtualizes the list at 50+ items so the editing surface stays responsive.

**Search.** Postgres `pg_trgm` with a GIN index on the searchable columns. A search for "acme" runs in milliseconds against tens of thousands of rows. The query has a `LIMIT 25` so the result set is bounded. See `docs/architecture/search.md`.

**Cron-driven crons that span all users.** `invoices.send-reminders` iterates every user with overdue invoices. The query uses `findOverdueAcrossTenants` (see `docs/engineering/repository-pattern.md`) and dispatches per-user Inngest events; the event handlers are concurrent and do not block each other. A spike of 10,000 reminders does not stall the cron because the dispatch is event-emission, not synchronous send.

## v2

Edge runtime for the marketing pages where applicable (faster TTFB worldwide). ISR (incremental static regeneration) for marketing once the content cadence settles. A bigger dashboard with charts may need server-side aggregation queries that are pre-computed and cached. None of these are v1 concerns; the v1 surface is small and the targets above are met by the default Vercel + Neon configuration.
