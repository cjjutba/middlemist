# Risks

This is a living register of known risks for the Middlemist v1 build. Each entry names the risk, scores likelihood and impact, names the mitigation strategy, names the trigger (the early signal that the risk is materializing), and assigns ownership.

The register is reviewed at every phase boundary in `sprint-plan.md` (after weeks 3, 7, 10, 15). New risks get added as they emerge. Mitigations get updated as conditions change. Resolved risks stay in the document for posterity but get marked Resolved.

## Format

Each risk: **Title** — likelihood (low/med/high), impact (low/med/high). **Mitigation:** the plan. **Trigger:** the signal that says "this risk is now real, act on it." **Owner:** CJ for v1.

## Active risks

### Scope creep mid-build — likelihood high, impact high

**Mitigation:** the v2 wishlist (`docs/product/v2-wishlist.md`) is the parking lot for new ideas. Every "while we're at it" thought goes there. Weekly check against the spec and the sprint plan during the Friday wrap-up. After week 6, no new features enter the v1 scope; only deferred items can be cut.

**Trigger:** finding yourself adding a feature that is not in the spec. Even a small one. Even a "quick" one. Especially a "quick" one. Three of these in a single week is the signal that the discipline is slipping.

**Owner:** CJ.

### Burnout at week 6-8 — likelihood medium, impact high

**Mitigation:** lower the bar to "ship something every week." A small completed feature beats a half-built large one. Weeks 6-8 are particularly fatigue-prone because the novelty has worn off and the launch is still distant. Plan reduced hours during this stretch if needed; cut weeks rather than push.

**Trigger:** two consecutive weeks where the goal is not met. A skipped Friday wrap-up. Avoiding opening the project for several days in a row.

**Owner:** CJ.

### Design system drift — likelihood medium, impact medium

**Mitigation:** the design system was just locked in Wave 4 (Cal.com-aligned). The risk is implementing components with off-spec radii, inline hex values, default shadcn theme remnants, or a forgotten anti-pattern from `docs/design/anti-patterns.md`. Mitigation: design system docs reviewed weekly during the build, anti-patterns doc as the discipline mechanism, strict token use enforced by code review (no inline hex, no off-spec radii).

**Trigger:** opening the dev server and noticing two cards with different radii on the same page. Catching a default shadcn `bg-slate-50` in a recent commit. Finding a Source Serif reference that should not exist.

**Owner:** CJ.

### Visual identity feels too generic — likelihood medium, impact medium

**Mitigation:** the Cal.com-aligned system is a foundation, not the whole identity. The Middlemist-specific composite components (`{component.proposal-block-pricing}`, `{component.invoice-line-item-row}`, `{component.client-portal-update-card}`, `{component.task-kanban-column}`) carry the product identity. The visual system is the frame; the modules are the picture. If the showcase weeks (10, 12, 14) produce surfaces that read as "this could be any SaaS," the modules need more specificity, not the visual system more decoration.

**Trigger:** showing a screenshot of the public proposal view to a peer and the response is "it looks fine" rather than "this is unusual." If the surfaces feel interchangeable with Cal.com, Linear, or Vercel screenshots, the modules need to carry more product-specific weight.

**Owner:** CJ.

### Multi-tenant data leak — likelihood low, impact catastrophic

**Mitigation:** the four-layer enforcement model from `docs/architecture/multi-tenancy.md`: repository pattern, withAuth wrapper, public-link tables, two-user isolation tests. The custom ESLint rule `no-direct-prisma` catches direct Prisma imports. Every new repository function ships with an isolation test before the PR merges. CI fails if any test is missing the isolation pattern.

**Trigger:** a test that should be checking isolation but is mocking the database instead. A repository function that does not take userId as its first argument. A query that uses `findUnique` instead of `findFirst` (the former does not enforce a where clause that includes userId).

**Owner:** CJ. This risk is the one that justifies the four-layer model. A leak would close out the product.

### Email deliverability — likelihood medium, impact medium

**Mitigation:** DKIM, SPF, and DMARC configured for the production domain in week 1 (per `sprint-plan.md`). Resend dashboard monitored weekly for bounce rate, complaint rate, and inbox placement. Use real-feeling sender addresses (not "noreply@"). Avoid words and patterns that trigger spam filters. The bounce webhook updates the User's `emailBounceCount` so deliverability issues are visible in-product.

**Trigger:** test emails landing in spam during week 7. Bounce rate above 2% in the Resend dashboard. Users reporting that magic-link emails are not arriving.

**Owner:** CJ.

### FX API outage — likelihood low, impact low

**Mitigation:** cached `FxRate` table with daily refresh via Inngest cron. If the upstream API (exchangerate.host) is down, the daily job retries per Inngest's default policy. If rates become older than 48 hours, the dashboard surfaces a small warning to the user. Manual rate override exists in settings as a last resort.

**Trigger:** Inngest dashboard showing repeated `fx.refresh` failures over more than 24 hours. User reports a stale-rate warning persisting.

**Owner:** CJ.

### FiscPlus deadlines collide with Middlemist sprint — likelihood high, impact medium

**Mitigation:** FiscPlus is CJ's other portfolio project. Deadlines on FiscPlus take precedence because Middlemist is self-paced and FiscPlus has external accountability. When FiscPlus has a heavy week, reduce Middlemist hours rather than abandon. The sprint plan accommodates 12-15 hours per week; some weeks may drop to 5-8 hours and that is acceptable as long as the discipline holds.

**Trigger:** a FiscPlus deadline within a week. Middlemist work falling below 5 hours for two consecutive weeks.

**Owner:** CJ.

### Author abandons project at week 4-5 — likelihood medium, impact total

**Mitigation:** ship something every week, no matter how small. Post progress publicly (Twitter, IndieHackers) at every phase boundary so there is external accountability. The "build in public" cadence keeps the project alive when motivation dips. A shipped week beats an unshipped week, even when the shipped feature is small.

**Trigger:** three consecutive weeks without a deploy. A backlog of unfinished work that makes opening the project feel daunting. Talking about Middlemist in past tense.

**Owner:** CJ.

### Architectural debt accumulates — likelihood medium, impact medium

**Mitigation:** ADRs (`docs/decisions/`) for meaningful architectural decisions. Opportunistic refactor when a pattern becomes clear (typically every 2-3 weeks during the build). Week 15 is the explicit polish week; some of that time is dedicated to refactoring patterns that did not stabilize during the modules.

**Trigger:** finding the same code copy-pasted in three places. A pattern that was supposed to be temporary becoming permanent. A "temporary" hack from week 4 still in the code at week 12.

**Owner:** CJ.

### Client portal magic-link abuse — likelihood low, impact medium

**Mitigation:** rate limiting on the magic-link request endpoint via Upstash (5 requests per email per hour). Tokens are 32 bytes of entropy and stored hashed; only the hash is checked at verify time. Token TTL is 1 hour. Audit logging of every magic-link request and verify attempt. If a client reports unauthorized access, the freelancer can revoke all active sessions for that client in one click from the client detail page.

**Trigger:** Sentry showing a spike of magic-link verify attempts for a single email. A user reporting unexpected portal access.

**Owner:** CJ.

### Recruiters and clients do not engage with the case study — likelihood medium, impact medium

**Mitigation:** the case study is the goal of the project. Mitigation begins before launch: build in public during weeks 8-15 (the high-leverage feature weeks), share screenshots with the developer audience on Twitter and IndieHackers, link the case study from cjjutba.com prominently, and produce the 90-second demo video as the second-most-important deliverable after the product itself.

**Trigger:** the case study published with no traffic in the first two weeks. Recruiters not asking about it. A six-month gap with no engagement after launch.

**Owner:** CJ.

### AI dependency creates fragile code — likelihood medium, impact medium

**Mitigation:** Claude Code is the primary collaborator on this build. The risk is that AI-generated code passes type checks but fails subtle semantics — boundary conditions, multi-tenant isolation, edge cases. Mitigation: human review of every commit before merging. Isolation tests catch most multi-tenant issues. Opportunistic refactor when AI patterns produce duplicated code. The week-15 polish includes a manual pass over the most-AI-touched modules.

**Trigger:** finding a multi-tenant test that mocks Prisma instead of using a real database. A pattern that compiles but the runtime semantics are wrong (e.g., a date comparison that works for some timezones but not others). A subtle bug that took multiple sessions to surface.

**Owner:** CJ.

### Visual system changes again mid-build — likelihood low, impact high

**Mitigation:** the visual system change in Wave 4 (deprecating the moss/7px/Source Serif direction in favor of Cal.com-aligned) cost zero days only because it happened pre-build. A mid-build change would cost at least a week of rework — possibly more. Mitigation: the system is locked. If a change is genuinely needed, write an ADR that supersedes ADR 0007 and weighs the cost of the change against the cost of shipping with the current system. The ADR is the discipline mechanism.

**Trigger:** the temptation to change the primary color, the radius scale, or the font pairing during weeks 8-15. Reading the design docs and feeling unsettled by a specific decision.

**Owner:** CJ. The single most expensive thing to do during the sprint is decide the visual system was wrong after week 6.

## Review cadence

This document is reviewed at every phase boundary:

- **End of week 3** (end of Phase 1): foundational risks (scope, design drift, multi-tenancy enforcement).
- **End of week 7** (end of Phase 2): mid-build risks (burnout, scope creep, email deliverability).
- **End of week 10** (end of Phase 3): showcase-surface risks (visual identity, public proposal quality).
- **End of week 15** (end of Phase 4): launch-readiness risks (architectural debt, AI fragility, polish completeness).

After each review, update mitigations, mark resolved risks as Resolved (but leave them in the document), and add new risks discovered during the phase. The register at launch is the artifact for the case study: a record of what was anticipated, what materialized, and how each was handled.
