# Product overview

Middlemist is a freelance operations tool for solo developers. It connects the lifecycle of a single freelance engagement end-to-end, from first contact to final paid invoice, in one product. The goal is not to be a CRM, not to be a Notion replacement, and not to be a generic SaaS shell. The goal is to be the tool a solo freelancer reaches for between waking up and starting work, and the tool their client opens to read what the freelancer just sent them.

## The lifecycle Middlemist covers

A freelance engagement in Middlemist follows one path:

```
lead → proposal → project → work (tasks + time + updates) → invoice → paid
```

Each step produces something the next step needs. A proposal is built against a saved client. An accepted proposal becomes a project (or attaches to one). A project tracks tasks, time entries, and posted updates. The work bills out as one or more invoices. The invoice gets paid (tracked manually in v1, no payment processor) and the engagement closes.

Two things stay constant through the lifecycle: the client and the freelancer's brand. The client sees the same name, logo, accent, and signature on the proposal, the invoice, and the portal. The freelancer sees the project as the spine: tasks, time, updates, and money all attach to one project record.

## The relationship at the center

Middlemist models a single freelancer-to-client relationship. One freelancer has many clients. Each client belongs to exactly one freelancer. A project belongs to exactly one freelancer and exactly one client. There is no shared workspace, no team account, no multi-party ownership. This is by design: the product is for solo freelancers and the data model reflects that.

This narrowing is the most important product decision. It is what lets the schema stay small, the access model stay simple (every row carries `userId`), and the UI stay focused. Anything that would require multi-party ownership (a project shared between two freelancers, a client co-managed by an agency partner, a sub-contractor with limited access) is explicitly out of scope.

## Who this is for

**Primary user:** CJ Jutba. A freelance full-stack developer in the Philippines who works with international clients, often in different currencies, on engagements that range from short fixed-fee projects to multi-month retainers. He needs the proposal-to-paid loop to be fast, branded, and quiet — no vendor noise, no irrelevant features, no client-facing surface that looks like a SaaS dashboard.

**Secondary users:** other solo creative freelancers (other developers first; designers, copywriters, and consultants if the model holds). The product is built for CJ's workflow first; if it generalizes, that is a happy outcome, not a target.

## What this is not

Middlemist is **not** for agencies. The data model has no concept of teammates, roles, or shared ownership. Adding it would require a schema rewrite, not a feature flag.

Middlemist is **not** for teams. There is one user per account. A user has many clients; clients do not have many users.

Middlemist is **not** an invoicing-only tool. If invoicing were the goal, Wave or Hello Bonsai would be a faster fit. The point of Middlemist is the connection between the proposal you send and the invoice you bill, against the project that links them.

Middlemist is **not** a proposal-only tool. The proposal builder is one feature, not the product.

Middlemist is **not** trying to replace Notion, Linear, or Things. The task list inside Middlemist is small on purpose: it tracks what the freelancer needs to do for one client on one project this week. It is not a personal task manager.

Middlemist is **not** an "all-in-one freelancer platform." It picks a narrow operations slice and tries to be excellent at it. Time tracking is included because it produces line items on invoices; expense tracking is not, because it does not.

## Portfolio context

CJ is building Middlemist for two reasons. The first is pragmatic: he wants the tool. He has been stitching together Notion, Wave, and Google Docs for years and the seams show. The second is professional: he wants to ship a polished, complete product as a portfolio piece on cjjutba.com. The case study writes itself if the product is good.

This dual purpose explains the constraints. The product has to be small enough for one developer to ship over a fixed timeline, complete enough to actually be used in CJ's freelance practice, and polished enough to read as a portfolio centerpiece. That is the bar. Every scope decision in `principles.md` and `v2-wishlist.md` is a consequence of that bar.

## Success criteria

- Shipped to production on `middlemist.app` (placeholder domain).
- Used by CJ for a real client engagement end-to-end (proposal sent, project run, invoice paid).
- A case study published on cjjutba.com with screenshots, an architecture summary, and the lessons.
- Source-of-truth docs (this folder) complete enough that a stranger could understand what was built and why.

Anything beyond that is a v2 conversation.
