# Product principles

Seven principles guide every product and engineering decision in Middlemist. They are written down because under deadline pressure the temptation is to bend them, and the result of bending them is a product that looks like every other freelance tool. These exist to make it easier to say no.

## 1. Project is the central object

Everything attaches to a project: tasks, time entries, updates, proposals, invoices, files. The project is the spine. Navigation, search, and the dashboard are all organized around it.

In practice, this means a task without a project is impossible. A time entry without a project is impossible. A proposal that gets accepted creates (or attaches to) a project. An invoice always points at a project. The data model enforces this; the UI does not let you go around it.

This forbids: a global task list independent of projects, a "miscellaneous" client bucket, a standalone "to-do" feature, and a time tracker that runs without a project context.

## 2. The client view is sacred

Anything a client sees must feel like a designed document, not a SaaS page. Proposals open like a letter, not like a card on a Trello board. Invoices read like a printed bill, not like a row in a table. The client portal is editorial, quiet, and signed.

In practice, this means client-facing routes (`/p/[token]`, `/i/[token]`, `/portal/[token]`) get serif body type, generous whitespace, no app chrome, no navigation that does not belong to the document, and a brand mark that is the freelancer's, not Middlemist's.

This forbids: chat widgets, "powered by Middlemist" badges in the document body, marketing CTAs, upsells, gradient backgrounds, sidebar navigation in client views, and stat tiles or charts inside a proposal or invoice.

## 3. Lean, opinionated, finished beats broad and half-built

The v1 module list is fixed at 15 modules. New ideas go in `v2-wishlist.md`, not in the build. A polished, working version of the v1 surface is worth more than a wider product with rough edges.

In practice, this means feature requests during the build are answered with "noted, in v2," and the build order in `planning/sprint-plan.md` (Wave 4) is followed. Scope changes happen between milestones, not inside one.

This forbids: "while we're at it" features, optional toggles that exist to defer a decision, half-finished views shipped behind a flag, and any request that begins with "it would also be cool if…"

## 4. No video, no payments, no leads pipeline in v1

These three are settled, called out by name, because they are the most common requests for any freelance tool and each would take weeks to do well. Video would mean a third-party SDK, recording storage, and bandwidth cost. Payments would mean Stripe or PayMongo, webhook handling, refunds, reconciliation, and tax reporting. A leads pipeline would mean stages, conversion tracking, and a CRM-shaped UX that drags the rest of the product toward CRM.

In practice, this means invoices are tracked manually as paid (no payment processor), proposals are accepted by clicking a button (not by paying), and there is no separate "lead" entity (a client is a client whether work has started or not).

This forbids: a Stripe button on the invoice page, a Calendly embed in the portal, and a "leads" tab in the sidebar.

## 5. Editorial over dashboard

The visual identity is documents and typography, not metrics tiles and charts. The dashboard exists, but it does not lead with stat counts. Pages have generous margin, body type at a comfortable measure, and an accent color used sparingly.

In practice, this means the dashboard's primary content is "what's outstanding right now" (overdue invoices, pending proposals, today's tasks) rendered as a list that reads, not a grid of numbers. Reports and analytics are not part of v1.

This forbids: a row of KPI cards as a dashboard hero, a graph as a dashboard hero, animated stat counters, and "your business at a glance" framing of any kind.

## 6. Multi-tenant from day one

Every authenticated query is filtered by `userId`. There is no "we'll add multi-tenancy later" path. The repository pattern, the `withAuth` server-action wrapper, and the two-user isolation tests are required from the first feature, not added at v2.

In practice, this means every Prisma `where` clause includes `userId`, every Server Action receives `userId` from the session and never from input, every public-link route looks up by token-only, and every repository function ships with a test that proves user A cannot see user B's data.

This forbids: a "personal mode" that stores data in localStorage, a "demo mode" that bypasses auth, a route that accepts `userId` as a query parameter, and any direct `prisma.*` call outside the repository layer.

## 7. Document the build

Every architectural decision lives in `docs/decisions/`. Every shipped feature gets a screenshot for the case study. Specs in `docs/spec/` describe the as-shipped behavior, not aspirational behavior.

In practice, this means before introducing a new pattern (a new caching strategy, a new auth flow, a new background-job convention) an ADR is written. After shipping a feature, the spec is updated to match and a screenshot is captured. PRs that do not update the relevant doc fail review.

This forbids: undocumented architectural patterns, "I'll write the ADR later," and specs that describe a planned feature without a status note.

## When principles conflict

Conflicts happen. The order of priority, when two principles point in different directions, is:

1. **Multi-tenancy beats everything.** A leak is a product-ending bug.
2. **Project-as-central beats editorial.** Consistency of the data model wins over a locally prettier surface.
3. **Lean beats feature-rich.** When in doubt, cut.

If a request from CJ contradicts a principle, the principle still wins until the principle is rewritten. Principles are amended explicitly, not eroded.
