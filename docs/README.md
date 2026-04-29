# Middlemist documentation

This folder is the source of truth for what Middlemist is, how it is built, and why specific decisions were made. It exists to keep one human (CJ) and one assistant (Claude Code) in alignment across many short sessions over many months. If you are confused about a feature, a constraint, or a tradeoff, the answer should be here. If it is not, write it down.

The docs are written for two audiences in parallel: a human reading them on cjjutba.com as a portfolio narrative, and Claude Code loading them into context at the start of a coding session. Style is direct. No marketing language. Code blocks where helpful. ASCII diagrams over Mermaid. Specs match the shipped product, and when the product changes, the spec is updated in the same PR.

## Folder map

- `product/` — what Middlemist is and what it is not. Overview, principles, glossary, and a parking lot for v2 ideas.
- `architecture/` — cross-cutting technical concerns: data model, multi-tenancy, background jobs, email, file uploads, PDF, audit log, search, FX, public links.
- `decisions/` — Architectural Decision Records (ADRs). One file per decision that constrains future code. Numbered, dated, immutable once accepted.
- `security/` — authentication, authorization, public-link risk model, rate limiting, threat assumptions. (Wave 2.)
- `spec/` — one file per v1 module: a complete description of the user-visible behavior, the data shape, the routes, the actions, and the tests. (Wave 3.)
- `ui/` — the design system, layout primitives, accent rules, component inventory, and editorial conventions. (Wave 3.)
- `ops/` — environments, secrets, deployment, observability, runbooks. (Wave 4.)
- `planning/` — the sprint plan, the milestone map, the build order, and a rolling change log. (Wave 4.)
- `assets/` — screenshots and diagrams referenced from the docs. (Filled as features ship.)

## How to use this when starting a Claude Code session

1. The harness loads `CLAUDE.md` automatically. That file is the always-on context.
2. If you are working on a specific module, also load the matching `docs/spec/<module>.md`. Each spec lists the architecture and security files it depends on; load those too.
3. If you are touching cross-cutting infrastructure (jobs, email, files, PDF, search, FX, audit, tenancy), load the matching `docs/architecture/<topic>.md`.
4. If you are about to introduce a new architectural pattern, skim the ADRs in `docs/decisions/` to see whether someone already considered the alternatives. If not, write a new ADR first, then implement.
5. If you find yourself asking "what was the reason for X," check the ADR index. If the reason is not captured anywhere, capture it now.

The docs are not exhaustive. They cover the things that are not derivable from reading the code: motivations, trade-offs, invariants, scope boundaries. Implementation details that the code already makes obvious do not belong in docs.

## Decisions are recorded as ADRs

The format and process for ADRs lives in `decisions/README.md`. The short version: any decision that constrains future code (a stack choice, an architectural pattern, a naming convention with broad reach) gets an ADR. Implementation specifics do not.

Numbering is monotonic, four-digit zero-padded: `0001-stack-choice.md`, `0002-nextjs-fullstack-vs-separate-backend.md`. Status starts as Proposed and is updated to Accepted, Superseded, or Deprecated as the decision evolves.

## Build plan

The current sprint plan and milestone map will live in `planning/sprint-plan.md` (Wave 4). Until that file exists, the build order is implicit in the v1 module list in `product/overview.md` and the dependency notes in each architecture doc.

## What is in this folder right now (Wave 1)

- `product/`: overview, principles, glossary, v2-wishlist.
- `architecture/`: overview, tech-stack, data-model, multi-tenancy, background-jobs, email-system, file-uploads, pdf-generation, audit-log, search, fx-and-currency, public-links.
- `decisions/`: README plus ADRs 0001 through 0006.

The remaining wave docs (`security/`, `spec/`, `ui/`, `ops/`, `planning/`) are produced in subsequent sessions. Wave 2 covers security and the first half of feature specs. Wave 3 covers UI, the remaining specs, and the test strategy. Wave 4 covers operations and the planning artifacts.

## Conventions

- Headings: one `#` for the document title; `##` for sections; `###` for subsections; avoid going deeper than `####`.
- Code: realistic, not pseudo-code. Use the actual stack (Prisma syntax, Next.js 15 App Router, TypeScript strict).
- Cross-references: relative paths only, e.g., `[multi-tenancy](../architecture/multi-tenancy.md)`.
- Tone: direct. No filler. No emojis. No em dashes (CJ does not use them).
- Length: as long as the topic warrants and no longer. If you find yourself padding to hit a target, the topic is not yet well-defined.

When the docs and the code disagree, the code is the truth and the docs need updating. Open a PR.
