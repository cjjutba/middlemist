# Architectural Decision Records

This folder holds ADRs: short documents that capture decisions which constrain future code. The point of an ADR is not to argue the case again later; it is to make sure the case was argued the first time, written down, and findable.

## When to write an ADR

Write an ADR when a decision will:

- **Constrain future code** in a way that would be expensive to reverse. Picking Prisma over Drizzle is an ADR; picking the variable name `userId` over `user_id` is not (the codebase rule lives in `CLAUDE.md`).
- **Introduce a new architectural pattern** that other code will follow. The first repository function does not need an ADR (the pattern came in with the project), but introducing a new caching layer, a new auth flow, or a new background-job convention does.
- **Choose between credible alternatives** where the loser is not obviously wrong. If two options were genuinely considered, future-you will want to know why one was picked.

If the decision could be reversed in a Friday afternoon without breaking anything, it does not need an ADR.

## When NOT to write an ADR

- **Implementation details** that fall out of an existing decision. "We used React Hook Form for the new client form" does not need an ADR; "We standardized on React Hook Form for all forms" does.
- **Single-feature choices** that do not constrain other features. The choice of which icon set to use on the dashboard does not warrant an ADR.
- **Conventions captured in `CLAUDE.md`**. Naming, lint rules, forbidden patterns. ADRs are about decisions; conventions are about consistency.
- **Reversible product decisions** that will be re-evaluated regularly. "We chose to ship onboarding in v1.1 instead of v1.0" is a planning decision, not an architectural one.

When in doubt, ask "if this decision turns out wrong, will reversing it require touching many files?" If yes, write an ADR.

## Format

Every ADR is a markdown file with this structure:

```markdown
# NNNN — <kebab-case title>

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by NNNN | Deprecated

## Context

What is the situation that requires a decision? What problem are we solving? What constraints apply? Two to four short paragraphs.

## Decision

What was decided. State it clearly and concretely. One paragraph or a short bullet list.

## Consequences

Both positive and negative. What does this make easy? What does it make hard? What does it lock us into?

## Alternatives Considered

Briefly: what else was on the table, and why did the chosen option win? One paragraph or a short list per alternative is enough.
```

The four sections are required; everything else is optional. Keep ADRs short. A long ADR is a signal that the decision is unclear or that several decisions are bundled.

## Numbering

Files are named `NNNN-kebab-case-title.md`, four-digit zero-padded, monotonic. The current next number is one higher than the highest ADR in the folder. Numbers do not get reused, even if an ADR is deleted (which should be rare; supersede is the usual pattern).

Examples:

- `0001-stack-choice.md`
- `0002-nextjs-fullstack-vs-separate-backend.md`
- `0017-replace-resend-with-postmark.md`

## Status values

- **Proposed**: written but not yet accepted. Used briefly during PR review.
- **Accepted**: the decision is in force. Code should follow it.
- **Superseded**: a newer ADR replaces this one. The header gains `Superseded by NNNN-...` and a one-line note pointing forward. The body is preserved as written.
- **Deprecated**: the decision no longer applies but no replacement exists. Used when, for example, a stack component is removed entirely.

ADRs are not edited after acceptance, except for the status field. If the situation changes, write a new ADR that supersedes the old one. The history matters; rewriting an old ADR to match new reality erases the trail.

## How to supersede

To replace ADR `0007` with ADR `0023`:

1. Write `0023-...` with full Context, Decision, Consequences, and Alternatives. The Context section explains why the previous decision no longer holds and what changed (in the project, in the world, in the team).
2. Update `0007-...`:
   - Status changes to `Superseded by 0023-...`.
   - Add a short header note: `> Superseded by [0023](./0023-...)`.
   - Do not delete or edit the original body.
3. Link from `0023` back to `0007` in the Alternatives section.

The result is two readable ADRs that describe the journey: what was decided, what changed, and what is in force now.

## Index

Numbered ADRs live in this folder. There is no separate index; the file names are descriptive enough that the directory listing is the index.

The current ADRs (Wave 1):

- `0001-stack-choice.md`
- `0002-nextjs-fullstack-vs-separate-backend.md`
- `0003-prisma-vs-drizzle.md`
- `0004-inngest-vs-bullmq.md`
- `0005-react-pdf-vs-puppeteer.md`
- `0006-shared-db-row-level-tenancy.md`

Subsequent waves and ongoing development will add ADRs in numeric order.
