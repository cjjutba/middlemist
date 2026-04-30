# Module 00 — Modules Overview

## Purpose

This folder contains one specification per v1 module of Middlemist. The specs describe what to build at the level of routes, pages, server actions, repository functions, validation rules, edge cases, and definitions of done. Architecture documents (`docs/architecture/`) describe how to build the cross-cutting machinery (multi-tenancy, public links, audit, email, jobs, FX). Product documents (`docs/product/`) describe why the product exists and what is in or out of scope. Design documents (`docs/design/`) describe the locked visual system. The specs in this folder sit at the intersection: they take the product-scope answers, name the architecture pieces they depend on, and apply the design tokens to every UI surface.

Specs are normative for "what the module is and what it does." When the implementation diverges from a spec, the spec is updated in the same PR. Stale specs are worse than no specs because they encode answers the team will trust without checking.

## Reading order

A reader new to Middlemist should read the documents in this order:

1. `CLAUDE.md` (the project root file).
2. `docs/product/overview.md`, `principles.md`, `glossary.md`, `v2-wishlist.md`.
3. `docs/architecture/overview.md`, then `multi-tenancy.md`, `data-model.md`, `public-links.md`, `audit-log.md`, `email-system.md`, `background-jobs.md`, `fx-and-currency.md`, `pdf-generation.md`, `file-uploads.md`, `search.md`, `tech-stack.md`.
4. `docs/decisions/*.md` (chronologically; ADRs are short).
5. `docs/design/overview.md`, then the rest of `docs/design/`.
6. This file (`00-modules-overview.md`).
7. The numbered specs in this folder, in the build order below.

The numbered prefixes on spec files (`01`, `02`, `03`, etc.) are not the build order. They are a stable index that does not change when the build order changes. The build order is described in the next section.

## Build order

The recommended build order is:

1. **[Auth and account](./01-auth-and-account.md)** — nothing else can be tested without an account. Email/password, verification, password reset, profile.
2. **[Clients](./03-clients.md)** — the second-most central object after the project. Required by everything that addresses a customer.
3. **[Projects](./04-projects.md)** — the central object. Tasks, time, updates, proposals, and invoices all attach to a project.
4. **[Tasks](./05-tasks.md)** — depends on a project. Today view depends on cross-project task aggregation.
5. **[Time tracking](./06-time-tracking.md)** — depends on projects (and optionally tasks). Invoices later pull from time entries.
6. **[Updates](./07-updates.md)** — depends on projects. Independent of tasks and time.
7. **[Proposals](./08-proposals.md)** — depends on clients and (optionally) projects. The block editor and public-link flow are the largest single piece of UI in v1.
8. **[Invoices](./09-invoices.md)** — depends on projects, clients, time entries, and proposals (for converting pricing into line items). The reminder cron depends on Inngest and the per-user `InvoiceReminderConfig`.
9. **[Client portal](./10-client-portal.md)** — depends on most of the above. The portal reads projects, updates, proposals, and invoices in a read-only, single-client scope.
10. **[Dashboard](./11-dashboard.md)** — depends on data from the modules above being present. Build last among the data-dependent modules so the dashboard reflects real state.
11. **[Settings](./12-settings.md)** — touches profile, business info, email customization, reminder config, and account deletion. Some sub-pages depend on email-customization having a place to land.
12. **[Global search](./13-global-search.md)** — depends on multiple entity types existing. Build after the data modules so the search has things to find.
13. **[In-app notifications](./14-in-app-notifications.md)** — depends on the audit log being populated by other modules.
14. **[Email customization](./15-email-customization.md)** — depends on the email pipeline being live and the settings sub-routes existing.
15. **[Onboarding](./02-onboarding.md)** — depends on settings, clients, and the dashboard being live. Onboarding is the polish pass on first-run experience and integrates after the surfaces it routes through exist.

The order above puts Onboarding last because the onboarding flow walks a new user through pages that need to exist before the walkthrough can land them there. Auth has to be first because nothing else is exercisable without it. Clients before Projects because a project requires a client. Proposals before Invoices because invoices can pull pricing from proposals. Notifications and Search after the data modules because both derive from data the data modules produce.

## Dependency graph

A textual dependency graph for the modules (an arrow `A → B` means B depends on A):

```
auth-and-account → clients
auth-and-account → projects
clients → projects
projects → tasks
projects → time-tracking
projects → updates
projects → proposals
clients → proposals
projects → invoices
clients → invoices
proposals → invoices                   (convert proposal pricing → line items)
time-tracking → invoices               (pull time entries → line items)
clients → client-portal
projects → client-portal
updates → client-portal
proposals → client-portal
invoices → client-portal
audit-log → in-app-notifications       (notifications derive from audit)
email-system → email-customization
auth-and-account → settings
email-system → settings
proposals, invoices, time-tracking, projects, clients, tasks, updates → dashboard
proposals, invoices, time-tracking, projects, clients, tasks, updates → global-search
auth-and-account, settings, clients, dashboard → onboarding
```

The graph is conservative: it lists the major dependencies that determine build order, not every cross-reference. The full set of relationships is implicit in the schema (`docs/architecture/data-model.md`).

## Summary table

| # | Module | One-sentence purpose |
|---|---|---|
| 01 | Auth and account | Email/password authentication, email verification, password reset, account profile, soft-delete with grace period. |
| 02 | Onboarding | Skippable first-login walkthrough that captures business name, logo, default currency, and the first client. |
| 03 | Clients | Manage client records with contact details, currency preference, archive, and email-bounce flag. |
| 04 | Projects | The central object: every task, time entry, update, proposal, and invoice attaches to one project. |
| 05 | Tasks | Track work items inside a project across list, kanban, and calendar views, plus a cross-project Today view. |
| 06 | Time tracking | One running timer at a time, manual entries, weekly summary, optional client visibility per project. |
| 07 | Updates | Per-project status updates with rich text and attachments, optional client email on post. |
| 08 | Proposals | Block-based proposal builder with public-link viewer, accept/decline flow, and PDF export. |
| 09 | Invoices | Multi-currency invoices with line items, public viewer, reminder cron, manual mark-as-paid, and PDF export. |
| 10 | Client portal | Magic-link, read-only client surface scoped to one freelancer/client pair. |
| 11 | Dashboard | Freelancer's home page: today's tasks, active projects, recent activity, quick stats, quick actions. |
| 12 | Settings | All user-configurable settings, organized into profile / business / email / reminders / branding / data / account. |
| 13 | Global search | Cmd+K command palette across clients, projects, proposals, invoices, and tasks, plus quick actions. |
| 14 | In-app notifications | Bell icon with audit-derived feed and per-row read state. |
| 15 | Email customization | Per-user override of subject, body, signature, and from-name on customizable transactional emails. |

## Cross-module concerns

These rules apply to every module. They are not repeated in each spec.

- **Multi-tenancy.** Every authenticated query filters by `userId`. Every repository function takes `userId` as its first argument. Every server action wraps with `withAuth` and never accepts `userId` from input. See [multi-tenancy](../architecture/multi-tenancy.md).
- **Audit log.** Every state-changing action writes one audit entry through `writeAudit`. Read operations on owned resources are not logged. See [audit-log](../architecture/audit-log.md).
- **Validation.** Every server action and route handler parses input through a zod schema before the business logic runs. The schema is shared with the client form via the same `*.schema.ts` file. The action returns a typed result envelope (`{ ok: true, data } | { ok: false, error }`).
- **UI surfaces.** Every page in the freelancer app sits inside the app shell (`{component.app-sidebar}` left, top nav with bell and avatar, optional running-timer strip). Every public document view (proposal, invoice, portal page) sits on `{colors.canvas}` with the dark `{component.footer}` at the bottom. Every form uses `{component.text-input}`, `{component.textarea}`, `{component.select}`, `{component.toggle-switch}`, `{component.button-primary}`, and `{component.button-secondary}` from the locked design system. Inline hex values, off-spec radii, and ad-hoc font weights are not allowed.
- **Forbidden patterns.** No direct Prisma access outside `src/lib/repositories/`. No `dangerouslySetInnerHTML` outside the two whitelisted Tiptap renderers. No `any`. No `process.env` outside `src/lib/env.ts`. No `console.*` in committed code. See `CLAUDE.md` for the full list.
- **Definition of done.** The seven-point checklist in `CLAUDE.md` ("Definition of feature done") applies to every module: typed end-to-end, validated with zod at the action boundary, repository function written, multi-tenant isolation test passing, documented in this folder, ADR added if a new pattern is introduced, screenshot captured.

When a module's spec contradicts these cross-module rules, the cross-module rules win. When a module needs an exception, the exception is documented in the module spec and reviewed in code review; pervasive exceptions become an ADR.
