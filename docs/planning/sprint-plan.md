# Sprint plan

This is the 16-week build plan for Middlemist v1. Each week names a goal, lists deliverables as a checklist, points at the files that get touched, defines what counts as complete, and suggests the Claude Code prompts to drive that week's session.

The plan is calibrated to a 12-15 hours-per-week pace alongside CJ's other work. Slippage rules are at the end. The plan assumes the documentation phase (Waves 1-4) is complete and the build starts from a clean repository at week 1.

## Plan assumptions

- **Pace:** 12-15 hours per week of focused build time. Some weeks will be heavier; some will be lighter. The average is what matters.
- **Solo:** one developer (CJ). No team coordination, no PR review from others.
- **Claude Code as collaborator:** each week is one or two focused sessions of Claude Code working from the docs in `CLAUDE.md` and the relevant per-module specs.
- **Real Postgres:** development uses a Neon branch dedicated to dev. CI uses a separate Neon branch dedicated to test runs. No mocked Prisma in tests.
- **Vercel deploys from `main`:** every push to main goes to production. There is no staging environment; preview deployments per PR are the staging.

## How to use the plan with Claude Code

Each week is a focused topic. The pattern within a week:

1. Open a fresh Claude Code session.
2. Load `CLAUDE.md` (auto-loaded) plus the relevant module spec(s) and architecture docs.
3. Run the suggested prompt for the week (listed under each week).
4. Review the diff, run tests, deploy to a preview, smoke-test in the browser.
5. Mark the week complete in this doc. Note any slippage.

The "suggested prompt" is a starting point. Most weeks will need 2-3 sessions to complete. Resist starting the next week's work until the current week passes its definition of complete.

## How to update this plan

Mark a week complete by changing the heading from "Week N" to "Week N (Complete)" and adding a one-line summary at the top of the week's section. Note slippage explicitly: "Originally targeted week N; completed week N+1 due to ___." Do not silently roll work into the next week.

## Phase 1 — Foundation (weeks 1-3)

The foundation phase establishes the codebase, the data model, the auth surface, and the first two modules (Clients, Projects). By the end of week 3, the freelancer can sign up, log in, create clients, and create projects.

### Week 1 — Project scaffolding and theme

**Goal:** a deployed Next.js project at the production domain with the Cal.com-aligned theme wired in and a placeholder home page.

**Deliverables:**

- [ ] Convert from npm to pnpm if not already (`rm package-lock.json`, `pnpm import`)
- [ ] Convert to `src/` layout per Next.js 15 conventions
- [ ] Install dependencies: shadcn/ui, Tailwind, Lucide, Auth.js v5, Prisma, Resend, React Email, Inngest, UploadThing, Upstash Ratelimit, react-pdf, zod, react-hook-form, Sentry, Plausible
- [ ] Wire up Tailwind with Cal.com-aligned tokens from `docs/design/color.md`, `typography.md`, `spacing-and-radius.md`
- [ ] Load `next/font/google` for Inter Display, Inter, JetBrains Mono per `docs/design/typography.md`
- [ ] Build placeholder home page at `/` with the wordmark, a tagline, and an outbound link to cjjutba.com
- [ ] Create `src/lib/env.ts` with zod-validated environment loader
- [ ] Initialize Prisma with empty `schema.prisma` and connect to Neon dev branch
- [ ] Deploy to Vercel at custom domain (placeholder middlemist.app)

**Files touched:** `package.json`, `tailwind.config.ts`, `src/styles/tokens.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/env.ts`, `prisma/schema.prisma`, `vercel.json`, `.env.example`

**Definition of complete:** the placeholder home page renders at the production domain with Inter Display 600 wordmark, near-black `{colors.primary}` and the Cal.com-aligned palette. `pnpm typecheck` passes. `pnpm lint` passes. CI builds clean.

**Suggested prompt:** "Set up the Next.js 15 project skeleton per Wave 1 architecture and Wave 4 design docs. Convert to pnpm and src/ layout, wire Tailwind with the locked tokens from docs/design/color.md, load Inter Display + Inter + JetBrains Mono via next/font/google. Build the placeholder home page. Set up env loading with zod. Initialize Prisma."

### Week 2 — Auth and data foundations

**Goal:** Auth.js v5 working end-to-end, full Prisma schema migrated, repository pattern foundations, and first multi-tenant isolation tests.

**Deliverables:**

- [ ] Migrate the full Prisma schema from `docs/architecture/data-model.md` (User, Client, Project, Task, TimeEntry, Update, Proposal, Invoice, plus supporting tables)
- [ ] Set up Auth.js v5 with email/password and magic-link providers
- [ ] Build login, signup, password reset, and verify-email pages per `docs/design/layout-patterns.md` (Auth pages section)
- [ ] Implement repository pattern foundations: `users.repo.ts`, `clients.repo.ts`
- [ ] Implement `withAuth` Server Action wrapper in `src/lib/actions.ts`
- [ ] Set up audit log infrastructure (`audit.repo.ts` + helpers)
- [ ] Set up the ESLint custom rule `no-direct-prisma`
- [ ] Write two-user isolation tests for Clients repo (this is the template for all future repos)
- [ ] Set up Vitest + a test database connection (separate Neon branch)

**Files touched:** `prisma/schema.prisma`, `prisma/migrations/0001_initial.sql`, `src/lib/auth.ts`, `src/app/(auth)/*`, `src/lib/repositories/*.repo.ts`, `src/lib/actions.ts`, `eslint.config.mjs`, `vitest.config.ts`, `tests/repositories/clients.repo.test.ts`

**Definition of complete:** signup creates a User, login produces a session, the dashboard route is gated by middleware. The Clients repo enforces userId isolation and tests pass. Audit log table exists. ESLint blocks direct Prisma imports outside repositories.

**Suggested prompt:** "Migrate the full Prisma schema from docs/architecture/data-model.md. Set up Auth.js v5 with email/password and magic-link providers per docs/security/authentication.md (when written) and docs/architecture/multi-tenancy.md. Build the auth pages with the design tokens. Implement the withAuth wrapper, the audit log helpers, and the no-direct-prisma ESLint rule. Write isolation tests for Clients repo as the template."

### Week 3 — Clients and Projects modules; App Shell

**Goal:** Clients and Projects modules with CRUD, list, and detail views. App Shell layout with sidebar nav working.

**Deliverables:**

- [ ] Clients module: list, detail, create, edit, archive flows
- [ ] Projects module: data model, list, basic detail (no tabs yet — those come in week 4+)
- [ ] App Shell layout: `{component.top-nav}`, `{component.app-sidebar}`, content region
- [ ] Sidebar items: Today, Dashboard, Clients, Projects, Settings (others linked but stubbed)
- [ ] Onboarding flow shell: 4 steps (Profile, Business, Branding, Done) with `{component.nav-pill-group}` step indicator
- [ ] Empty states for Clients and Projects per `docs/design/empty-and-loading-states.md`
- [ ] Loading skeletons matching list shapes

**Files touched:** `src/app/(app)/clients/*`, `src/app/(app)/projects/*`, `src/app/(app)/onboarding/*`, `src/components/layout/*`, `src/components/clients/*`, `src/components/projects/*`, `src/lib/repositories/clients.repo.ts`, `src/lib/repositories/projects.repo.ts`, `src/lib/actions/clients.action.ts`, `src/lib/actions/projects.action.ts`

**Definition of complete:** signup → onboarding → land on dashboard. Create a client, see it in the list. Create a project under the client, see it in the projects list. Both modules have isolation tests passing. App Shell renders correctly at all responsive breakpoints.

**Suggested prompt:** "Build the Clients and Projects modules per docs/spec/clients.md and docs/spec/projects.md (when written). Use the App Shell from docs/design/layout-patterns.md with the sidebar items per the spec. Implement the onboarding flow shell. Empty states from docs/design/empty-and-loading-states.md. Isolation tests for both repos."

## Phase 2 — Core operations (weeks 4-7)

The core operations phase builds the modules that get used during a project's lifecycle: tasks, time tracking, updates, and the email infrastructure.

### Week 4 — Tasks module and Cmd+K

**Goal:** Tasks module complete with multiple views; Cmd+K skeleton operational.

**Deliverables:**

- [ ] Tasks module: CRUD, filtering, list view (default), kanban view (status columns), calendar view (due-date based)
- [ ] Project hub Tasks tab using `{component.tab-underline}` and `{component.task-kanban-column}`
- [ ] Today view: aggregates today's tasks, overdue invoices, pending proposals across all projects
- [ ] Cmd+K skeleton: `{component.command-palette}` overlay, search across clients/projects/tasks, keyboard navigation
- [ ] Task isolation tests

**Files touched:** `src/app/(app)/tasks/*`, `src/app/(app)/today/*`, `src/components/tasks/*`, `src/components/command-palette/*`, `src/lib/repositories/tasks.repo.ts`, `src/lib/actions/tasks.action.ts`

**Definition of complete:** create a task, switch between list/kanban/calendar views, navigate via Cmd+K. Isolation tests passing.

**Suggested prompt:** "Build the Tasks module per docs/spec/tasks.md. Implement list, kanban (using {component.task-kanban-column}), and calendar views. Build the Today view that aggregates across modules. Implement the Cmd+K skeleton with search across clients, projects, and tasks."

### Week 5 — Time tracking module

**Goal:** Time tracking with timer and manual entries, weekly summary, and client-visibility toggle.

**Deliverables:**

- [ ] Time tracking module: timer (start/stop with project selection), manual entry, edit/delete entries
- [ ] Weekly summary view: hours by project, hours by day, totals
- [ ] Per-entry client-visibility toggle (default off)
- [ ] Project hub Time tab showing entries scoped to that project
- [ ] Time entries isolation tests

**Files touched:** `src/app/(app)/time/*`, `src/components/time/*`, `src/lib/repositories/time-entries.repo.ts`, `src/lib/actions/time-entries.action.ts`

**Definition of complete:** start a timer, switch projects, stop the timer, see the entry. Add a manual entry. Edit an entry's client visibility. View weekly summary. Isolation tests passing.

**Suggested prompt:** "Build the Time tracking module per docs/spec/time.md. Timer + manual entries + weekly summary view. Per-entry client-visibility toggle. Project hub Time tab."

### Week 6 — Updates module

**Goal:** Updates module with Tiptap editor, attachments, and pinning.

**Deliverables:**

- [ ] Updates module: list per project, create with Tiptap editor, edit, delete
- [ ] Attachments via UploadThing (images, PDFs, docs up to 10MB)
- [ ] Pinning (one or more updates pinned to the top of a project's update list)
- [ ] Categories (status, milestone, blocker, general)
- [ ] `{component.client-portal-update-card}` first design pass for the freelancer-side preview
- [ ] Updates isolation tests

**Files touched:** `src/app/(app)/projects/[id]/updates/*`, `src/components/updates/*`, `src/components/rich-text/update-renderer.tsx`, `src/lib/repositories/updates.repo.ts`, `src/lib/actions/updates.action.ts`, `src/app/api/uploadthing/core.ts`

**Definition of complete:** post an update with rich text and an attachment. Pin it. Filter by category. View the update in the project hub. Isolation tests passing.

**Suggested prompt:** "Build the Updates module per docs/spec/updates.md. Tiptap editor, UploadThing attachments, pinning, categories. Use {component.client-portal-update-card} shape for the preview."

### Week 7 — Email infrastructure

**Goal:** Resend + React Email working with the first set of templates and email customization in settings.

**Deliverables:**

- [ ] Resend SDK + React Email configured
- [ ] First templates: welcome, verify-email, reset-password, magic-link, update-posted
- [ ] All templates use Inter typography (no Inter Display in email)
- [ ] Email customization shell in settings: from name, signature, footer text
- [ ] DKIM/SPF/DMARC configured for the production domain
- [ ] Bounce webhook handler at `/api/email/bounce`
- [ ] Email preview (`pnpm email:dev`) at port 3001

**Files touched:** `src/lib/email/send.ts`, `src/emails/*.tsx`, `src/app/(app)/settings/email/*`, `src/app/api/email/bounce/route.ts`, `react-email.config.js`

**Definition of complete:** signup triggers a welcome email that arrives in inbox (not spam). Magic-link flow works end-to-end. Bounce webhook updates the User's email-bounce status.

**Suggested prompt:** "Set up the email infrastructure per docs/architecture/email-system.md. Resend + React Email. Build the first 5 templates with Inter typography. Wire the bounce webhook. Build the email customization shell in settings."

## Phase 3 — Proposals (weeks 8-10)

Proposals are the highest-leverage module in the product because the public proposal view is one of the showcase surfaces.

### Week 8 — Proposal model and editor

**Goal:** Proposal data model and block editor with the core block types.

**Deliverables:**

- [ ] Proposal model migrated (Proposal, ProposalBlock tables)
- [ ] Proposal builder UI: `{component.proposal-editor-shell}` shell with editable title and block area
- [ ] Block types implemented: `{component.proposal-block-heading}`, `{component.proposal-block-text}`, `{component.proposal-block-scope}`, `{component.proposal-block-deliverables}`, `{component.proposal-block-timeline}`, `{component.proposal-block-terms}`, `{component.proposal-block-signature}`
- [ ] Draft auto-save (every 5 seconds during edit)
- [ ] Proposal list view (App Shell) with status pills
- [ ] Proposals isolation tests

**Files touched:** `prisma/schema.prisma` (Proposal/ProposalBlock), `src/app/(app)/proposals/*`, `src/components/proposals/*`, `src/components/rich-text/proposal-block-renderer.tsx`, `src/lib/repositories/proposals.repo.ts`, `src/lib/actions/proposals.action.ts`

**Definition of complete:** create a proposal draft, add and reorder blocks, save the draft. Reload and the draft persists. Isolation tests passing.

**Suggested prompt:** "Build the Proposal model and editor per docs/spec/proposals.md. Implement the seven core block types per docs/design/component-patterns.md (proposal blocks). Draft auto-save. Status-pill list view."

### Week 9 — Pricing block and saved blocks library

**Goal:** Pricing block with full table styling; saved-blocks library and saved-pricing-items.

**Deliverables:**

- [ ] `{component.proposal-block-pricing}` with line-item table, subtotal, tax, total
- [ ] Multi-currency support (currency per pricing block, FX preview)
- [ ] Saved blocks library (sheet-right pattern from `docs/design/layout-patterns.md`)
- [ ] Saved pricing items (reusable line items)
- [ ] Proposal templates (whole-document templates)
- [ ] Block image type (`{component.proposal-block-image}`) with UploadThing

**Files touched:** `src/components/proposals/blocks/pricing.tsx`, `src/components/proposals/saved-library/*`, `src/lib/repositories/saved-blocks.repo.ts`, `src/lib/repositories/saved-pricing-items.repo.ts`, `src/lib/repositories/proposal-templates.repo.ts`

**Definition of complete:** add a pricing block with three line items in PHP, see the total. Save a pricing line, reuse it in another proposal. Save a whole proposal as a template, create a new proposal from the template.

**Suggested prompt:** "Build the pricing block per docs/design/component-patterns.md ({component.proposal-block-pricing}). Saved blocks library and saved pricing items. Proposal templates."

### Week 10 — Public proposal view, accept flow, PDF

**Goal:** the showcase week. Public proposal view, accept/decline flow, conversion to project, react-pdf template, proposal-related emails.

**Deliverables:**

- [ ] Public proposal view at `/p/[token]` per `docs/design/public-views.md` (full spec)
- [ ] Accept flow: name input modal, electronic signature capture, IP address logging
- [ ] Decline flow (one click)
- [ ] One-click convert to project (creates a Project, attaches the Proposal)
- [ ] react-pdf proposal template that renders the same content as the web view
- [ ] "View as PDF" link on public view
- [ ] Proposal-related emails: proposal-sent, proposal-viewed, proposal-accepted, proposal-declined
- [ ] Public proposal view isolation: token-only lookup, no userId leak

**Files touched:** `src/app/p/[token]/*`, `src/lib/pdf/proposal-template.tsx`, `src/app/api/proposals/[id]/pdf/route.ts`, `src/emails/proposal-*.tsx`, `src/lib/inngest/functions/proposal-events.ts`

**Definition of complete:** send a proposal to a test client, open the public link, accept it, see the proposal status update, see the freelancer notification, click "Convert to project" and see the new project. Capture screenshots for the case study.

**Suggested prompt:** "Build the public proposal view per docs/design/public-views.md. Accept/decline flows with signature capture. One-click convert to project. react-pdf template that mirrors the web view. All proposal-related emails."

## Phase 4 — Invoices, portal, polish (weeks 11-15)

### Week 11 — Invoice model and builder

**Goal:** Invoice data model, builder, and FX service.

**Deliverables:**

- [ ] Invoice model migrated (Invoice, InvoiceLineItem tables)
- [ ] Invoice builder: manual line items, pull from time entries, pull from proposal pricing
- [ ] Tax handling (per-line or per-invoice)
- [ ] Invoice numbering (per-user sequence with optional prefix)
- [ ] FX service (`fx.service.ts`) using exchangerate.host
- [ ] Daily Inngest cron `fx.refresh` writing to FxRate table
- [ ] Cached FX with stale-rate warning when older than 48 hours
- [ ] Invoices isolation tests

**Files touched:** `prisma/schema.prisma` (Invoice/InvoiceLineItem/FxRate), `src/app/(app)/invoices/*`, `src/components/invoices/*`, `src/lib/repositories/invoices.repo.ts`, `src/lib/services/fx.service.ts`, `src/lib/inngest/functions/fx-refresh.ts`

**Definition of complete:** create an invoice from scratch, see the line items, set tax, see the total. Create an invoice from time entries, see them populated. Create from a proposal's pricing block. FX cron runs and FxRate table populates.

**Suggested prompt:** "Build the Invoice model and builder per docs/spec/invoices.md. Three creation paths: manual, from time entries, from proposal pricing. FX service + daily cron + cached FxRate per docs/architecture/fx-and-currency.md."

### Week 12 — Public invoice view and PDF

**Goal:** public invoice view, react-pdf template, invoice emails.

**Deliverables:**

- [ ] Public invoice view at `/i/[token]` per `docs/design/public-views.md`
- [ ] `{component.invoice-line-item-row}` table styling
- [ ] `{component.invoice-totals-stack}` with subtotal/tax/total
- [ ] react-pdf invoice template
- [ ] "View as PDF" prominent button
- [ ] Invoice-related emails: invoice-sent, invoice-viewed, invoice-paid, invoice-overdue (reminder template)
- [ ] Manual mark-as-paid action (no payment processor in v1)

**Files touched:** `src/app/i/[token]/*`, `src/lib/pdf/invoice-template.tsx`, `src/app/api/invoices/[id]/pdf/route.ts`, `src/emails/invoice-*.tsx`

**Definition of complete:** send an invoice to a test client, open the public link, view the PDF, mark as paid manually, see the status update and email to the client.

**Suggested prompt:** "Build the public invoice view per docs/design/public-views.md. {component.invoice-line-item-row} and {component.invoice-totals-stack} per docs/design/component-patterns.md. react-pdf template. Invoice-related emails. Manual mark-as-paid."

### Week 13 — Reminders, dashboard, notifications

**Goal:** invoice reminders cron, completed dashboard, in-app notifications.

**Deliverables:**

- [ ] Invoice reminders cron (Inngest) per per-user reminder config
- [ ] Overdue auto-status: invoices past due date auto-transition to overdue
- [ ] Dashboard page complete: Today panel + Active projects 3-up + Recent activity + Quick stats 4-up + Quick actions
- [ ] In-app notifications center via `{component.dropdown-menu}` from the bell icon
- [ ] Notification preferences in settings

**Files touched:** `src/lib/inngest/functions/invoice-reminders.ts`, `src/app/(app)/dashboard/*`, `src/components/notifications/*`, `src/lib/repositories/notifications.repo.ts`, `src/app/(app)/settings/notifications/*`

**Definition of complete:** dashboard renders all sections per `docs/design/layout-patterns.md`. Bell icon shows unread count, opens dropdown of notifications. Reminder cron runs and emails go out per config.

**Suggested prompt:** "Build the dashboard per docs/design/layout-patterns.md (Dashboard section). Invoice reminder cron. In-app notifications center. Settings panel for notification preferences."

### Week 14 — Client portal

**Goal:** the second showcase surface. Client portal end-to-end.

**Deliverables:**

- [ ] Client portal magic-link request flow (client enters email, gets a magic link)
- [ ] Magic-link verify endpoint creates a ClientPortalSession (separate from User session)
- [ ] Portal home `/portal/(client)` per `docs/design/public-views.md`
- [ ] Per-project portal view `/portal/(client)/projects/[id]` per `docs/design/public-views.md` (Updates, Tasks, Time, Invoices, Proposals)
- [ ] Cal.com-aligned styling consistent with public proposal/invoice views
- [ ] Client portal session isolation tests

**Files touched:** `src/app/portal/(client)/*`, `src/app/portal/auth/*`, `src/lib/repositories/client-portal-sessions.repo.ts`, `src/lib/actions/client-portal.action.ts`

**Definition of complete:** as a test client, request a magic link, sign in, see the project list, click into a project, see updates/tasks/time/invoices/proposals. Capture screenshots for the case study.

**Suggested prompt:** "Build the Client Portal per docs/spec/client-portal.md and docs/design/public-views.md. Magic-link flow + ClientPortalSession. Portal home and per-project view."

### Week 15 — Polish week

**Goal:** Cmd+K full search, settings completion, state pass, mobile pass, bug bash.

**Deliverables:**

- [ ] Cmd+K full search across all entities (clients, projects, proposals, invoices, tasks, time entries) + quick actions ("New invoice", "New proposal")
- [ ] Settings completion: profile, business, branding, email, reminders, data export
- [ ] Empty/loading/error state pass: every list view has the four states designed and implemented per `docs/design/empty-and-loading-states.md`
- [ ] Mobile responsive pass: every page tested at mobile, tablet, desktop breakpoints
- [ ] Bug bash: open every list, every detail, every editor; fix any visual or functional bugs

**Files touched:** many — this is the polish week

**Definition of complete:** every page has empty/loading/error states. Cmd+K searches everything. Settings is complete. Mobile is fully responsive. No open critical bugs in Sentry.

**Suggested prompt:** "Polish week. Complete the Cmd+K search across all entities. Finish settings. Pass through every list/detail page checking the four states. Mobile responsive pass."

## Phase 5 — Launch (week 16)

### Week 16 — Launch

**Goal:** ship Middlemist v1 and publish the case study.

**Deliverables:**

- [ ] Final QA: golden-path e2e on production (signup → onboarding → create client → create project → create proposal → send → accept → convert to project → log time → post update → create invoice → send → mark paid)
- [ ] Sentry alerts wired (critical errors, error rate spikes)
- [ ] Plausible analytics on marketing surface
- [ ] Inngest dashboard reviewed (job success rates)
- [ ] Case study page on cjjutba.com: problem statement, target user, key decisions (including the visual system change to Cal.com-aligned), architecture diagram, screenshots from weeks 10/12/14, demo video link, GitHub link
- [ ] README polish on the public GitHub repo: short intro, screenshot, stack, dev setup steps, license
- [ ] 90-second Loom demo video covering the proposal-to-paid loop
- [ ] Soft launch posts: Twitter, IndieHackers, LinkedIn, link from cjjutba.com

**Definition of complete:** the case study is live. The product is live and used by CJ for at least one real client engagement.

## Slippage rules

If a week's deliverables are not met, do not silently roll the work into the next week. Two valid responses:

1. **Trim scope.** Move the deferred deliverable to `docs/product/v2-wishlist.md` and update the spec accordingly. Continue to the next week with a smaller v1.
2. **Extend the timeline.** Add an explicit week (Week 6.5, Week 11.5) with a one-line note about why. Acceptable if the slippage is on a high-leverage week (Proposals weeks 8-10, Public views weeks 10/12/14).

Never compromise quality for a date. This is a portfolio project; a polished smaller v1 reads better than a rough larger v1.

## What NOT to do during the sprint

The list below is the discipline mechanism for the build phase, the same way the anti-patterns doc is the discipline mechanism for design.

- **Do not start new projects.** FiscPlus and Middlemist are the two projects in flight. Adding a third during this sprint will sink at least one of them.
- **Do not add v2 features mid-build.** A v2 wishlist exists for a reason. New ideas during the build go there, not into the current week.
- **Do not redesign mid-flight.** The visual system is locked in Wave 4. Do not change it again during the build. Each redesign costs at least a week of rework. The single most expensive thing CJ can do during this sprint is decide the visual system was wrong after week 6.
- **Do not skip tests.** Multi-tenant isolation tests are required for every new repo. The discipline is what prevents leak bugs.
- **Do not ship without screenshots.** Every shipped feature gets a screenshot for the case study. Take it the day the feature is done.
