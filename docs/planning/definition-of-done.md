# Definition of done

Two checklists. The first is what counts as a feature being done. The second is what counts as Middlemist v1 being done. Both are thresholds: a feature that fails any item is not done; a project that fails any item is not v1-launched.

## Feature done

A feature is not merged or marked complete until every item below is true.

- [ ] **Typed end to end.** Inputs and outputs typed at every boundary (form, server action, repo, response). No `any`. Use `unknown` and narrow.
- [ ] **Validated with zod at the action boundary.** Every Server Action and Route Handler parses input through a zod schema before business logic. The schema is shared between the client form (react-hook-form resolver) and the server.
- [ ] **Repository function with userId injection.** All Prisma access flows through a function in `src/lib/repositories/*.repo.ts`. Each function takes `userId` as the first argument and includes it in every Prisma `where` clause. No direct `prisma.*` access from actions, routes, or components.
- [ ] **Multi-tenant isolation test passing.** A two-user test exists for every repository function: insert data for user A and user B; verify A cannot read or modify B's rows and vice versa. The test runs against a real Postgres (Neon test branch), not a Prisma mock.
- [ ] **Documented in `docs/spec/`.** The relevant per-module spec is updated to match the shipped behavior. Deviations from the spec are reconciled (either the code matches the spec, or the spec is updated to match the code, in the same PR).
- [ ] **ADR added if a new architectural pattern was introduced.** A new caching strategy, a new auth flow, a new background-job convention, a new way of structuring data — any of these triggers an ADR in `docs/decisions/`.
- [ ] **Empty state designed.** Using `{component.empty-state-card}` and the canonical copy from `docs/design/empty-and-loading-states.md`.
- [ ] **Loading state designed.** Skeleton matching the actual layout shape per `docs/design/empty-and-loading-states.md`.
- [ ] **Error state designed.** A `{component.feature-card}`-shaped error state with a recovery action, never a stack trace, never a database ID.
- [ ] **Mobile responsive.** Every page tested at default (≤639), `sm` (640+), `md` (768+), `lg` (1024+) breakpoints. Touch targets at least 44 × 44 pixels at `md` and below.
- [ ] **Accessible.** Keyboard navigation works (Tab, Shift+Tab, Enter, Escape). Semantic HTML (proper heading order, form labels, button vs. link distinction). Color contrast meets WCAG AA per `docs/design/color.md`. Functional icons have `aria-label`. Focus rings visible.
- [ ] **Audit log entry on state changes.** Every state change (create, update, status transition, delete) writes an audit log entry per `docs/architecture/audit-log.md`. Tokens, secrets, and PII are not logged.
- [ ] **Email notifications wired if applicable.** If the feature triggers an event the user (or their client) should know about, the email is sent via `src/lib/email/send.ts` using a React Email template.
- [ ] **Visual implementation matches design tokens.** No inline hex values. No off-spec radii. No `style={{ color: ... }}` outside of CSS-variable-bound exceptions. Every color, spacing, radius, and font references the locked tokens from `docs/design/`.
- [ ] **Screenshot captured.** For the case study folder. Take it the day the feature is done; do not defer.

A feature failing any item above is not merged. The discipline is the value: shortcuts compound into a product that almost works.

## v1 done

Middlemist v1 is launched when every item below is true.

- [ ] **Live at production domain.** Deployed to the production domain (placeholder middlemist.app). Not a Vercel preview, not a staging URL.
- [ ] **Used by the author for at least one full real-client engagement.** A complete proposal-to-paid loop has happened on the production instance. The author has sent a real proposal to a real client, the client accepted, work happened, an invoice was sent, the invoice was paid.
- [ ] **Case study published on cjjutba.com.** A page describing the project, the user, the decisions, the architecture, the visual system (including the change to Cal.com-aligned), with screenshots from weeks 10, 12, and 14, a 90-second Loom demo video, and a link to the public GitHub repo.
- [ ] **GitHub repo public with clean README.** The README has a short intro, a screenshot, the stack, dev setup steps, and a license. The commit history is reasonable (no commits with secrets, no commits that break main).
- [ ] **Sentry zero open critical bugs in past 7 days.** Critical errors triaged and resolved. Non-critical errors documented if not yet fixed.
- [ ] **All Wave 1-4 docs current.** The docs match the shipped product. Deviations are reconciled.
- [ ] **Sprint plan marked complete or with documented slippage notes.** Each week's section in `docs/planning/sprint-plan.md` has either a "Complete" marker or an explicit slippage note explaining what moved to v2.
- [ ] **Demo video recorded and embedded.** A 90-second Loom demo video covering the proposal-to-paid loop, embedded on the case study page.

When all items above are true, v1 is shipped. Anything beyond that is a v2 conversation.
