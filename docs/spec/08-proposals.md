# Module 08 — Proposals

## Purpose

The proposal builder is the largest single feature in v1 and the surface that most differentiates Middlemist from a generic invoicing tool. A proposal is a block-based document the freelancer composes, sends to a client, and tracks through view, accept, decline, or expire. The accepted proposal can be converted into a project with one action. The public link viewer is the client's first impression of the freelancer's brand. The PDF export is the artifact that lives on after the engagement.

This module covers the editor, the saved-blocks library, saved pricing items, proposal templates, the public viewer at `/p/[token]`, the accept and decline flows, and the conversion to a project.

## In Scope (v1)

- Create, save, send, and track proposals through the full status lifecycle.
- Block-based editor with nine block types: heading, text (Tiptap rich text), scope, deliverables, timeline, pricing, terms, signature, image.
- Variables inside the body that resolve at render time: `{client_name}`, `{client_company}`, `{project_name}`, `{date_sent}`, `{valid_until}`, `{price_total}`.
- Saved blocks library, saved pricing items library, and full proposal templates.
- Public viewer at `/p/[token]` rendering the proposal read-only with a branded shell.
- Accept and decline actions on the public route, with typed-name "signature" capture.
- PDF export server-side via `@react-pdf/renderer`.
- One-click "Convert to project" on accept.
- Regenerate public token (revoke + reissue).
- Per-proposal `validUntil` date driving the `expired` status (set by cron).

## Out of Scope (v1)

- **Cryptographic e-signature.** Cut to v2; v1 captures typed name + IP + user agent + timestamp as the legal record. ADR 0009 (post-v1) will document a real e-signature integration if added.
- **Multi-recipient routing.** Cut to v2; one proposal, one client.
- **Per-proposal analytics dashboard (heatmaps, time-on-block).** Cut to v2.
- **AI-suggested content.** Cut to v2.
- **Payment-on-accept (deposit).** Cut to v2; depends on payment processing being added.
- **Branching pricing options (good/better/best).** Cut to v2.
- **Comments or questions from the client on the proposal.** Cut to v2; the client portal is read-only.
- **Version history with diff view.** Cut to v2; v1 keeps no per-edit history.

## Data Model

Uses `Proposal`, `SavedBlock`, `SavedPricingItem`, `ProposalTemplate`. Relevant `Proposal` columns: `id`, `userId`, `clientId`, `projectId` (nullable), `title`, `blocksJson`, `currency`, `totalAmount`, `status`, `publicToken`, `validUntil`, `sentAt`, `viewedAt`, `acceptedAt`, `declinedAt`, `acceptanceSignatureName`, `acceptanceSignatureAt`, `acceptanceIp`.

`blocksJson` is a typed array of block objects:

```ts
type Block =
  | { type: "heading", id: string, level: 1 | 2 | 3, text: string }
  | { type: "text", id: string, doc: TiptapDoc }
  | { type: "scope", id: string, items: { id: string, title: string, description?: string }[] }
  | { type: "deliverables", id: string, items: { id: string, title: string, description?: string }[] }
  | { type: "timeline", id: string, items: { id: string, label: string, dateRange: { from: string, to?: string } | { description: string } }[] }
  | { type: "pricing", id: string, items: { id: string, description: string, quantity: number, unitPrice: number, total: number, currency: Currency, savedPricingItemId?: string }[], showTotals: boolean }
  | { type: "terms", id: string, doc: TiptapDoc }
  | { type: "signature", id: string, prompt?: string }
  | { type: "image", id: string, url: string, caption?: string };
```

Status enum: `draft | sent | viewed | accepted | declined | expired`.

## User Flows

### Create from blank or from template

1. From `/(app)/proposals`, the user clicks `{component.button-primary}` "New proposal." A `{component.modal}` (md) opens with a choice: blank, or pick from `ProposalTemplate` rows.
2. The user picks a client (`{component.select}` from `clients.repo.listForClientPicker`), an optional project, an optional template, and clicks Continue.
3. The action `createProposal` inserts a draft row, generates the `publicToken`, and routes to `/(app)/proposals/[id]/edit`.

### Edit

1. The editor at `/(app)/proposals/[id]/edit` renders the proposal as a stack of blocks. Each block sits inside a `{component.proposal-block}` wrapper with hover controls (drag handle, type-aware action menu).
2. A `{component.button-primary}` "Add block" at the bottom opens a `{component.dropdown-menu}` listing the nine block types.
3. A right-side `{component.sheet-right}` titled "Library" provides three tabs: Blocks (saved blocks), Pricing items, Templates. Clicking an entry inserts it into the current proposal.
4. Saving is automatic on a 1-second debounce; the action `updateProposal` writes `blocksJson` and recomputes `totalAmount` from any pricing blocks. The header shows "Saved" in `{typography.caption}` `{colors.muted}` after each save.
5. A `{component.button-text-link}` "Save as block" appears in each block's action menu, and "Save as pricing item" appears for individual rows in pricing blocks. Both call `saveBlock` / `savePricingItem`.

### Send

1. From the editor header, `{component.button-primary}` "Send" opens a `{component.modal}` with a preview of the email subject and body (sourced from `EmailSettings`), the recipient's email (read-only), and a `validUntil` date picker.
2. Submit calls `sendProposal`. The action transitions the status from `draft` to `sent`, sets `sentAt = now` and `validUntil`, emits `proposal.sent` Inngest event, and writes audit.
3. The Inngest handler sends the `proposal-sent` email with `view_link = /p/[token]`.

### Public view (`/p/[token]`)

1. The client opens the link. Middleware applies the per-token rate limit. The Server Component at `app/p/[token]/page.tsx` calls `proposalsRepo.findByPublicToken(token)`.
2. If not found: render generic "this proposal is no longer available."
3. If status is `expired`, `accepted`, or `declined`: render the proposal but disable accept/decline.
4. Render: top band with freelancer logo + business name (`{typography.title-lg}`) + sent date right-aligned in `{typography.caption}` `{colors.muted}`; title in `{typography.display-lg}`; blocks rendered in sequence with `{spacing.lg}` between; bottom: large `{component.button-primary}` "Accept proposal" + `{component.button-text-link}` "Decline." Footer is `{component.footer}` (dark surface).
5. The Server Component writes audit `proposal.viewed` (with IP and UA) and emits `proposal.viewed` Inngest event. The handler sets `viewedAt` if null and notifies the freelancer.

### Accept

1. Client clicks "Accept proposal." A `{component.modal}` opens with a `{component.text-input}` for typed name and a button "I accept."
2. Submit calls the `acceptProposalPublic` server action (no auth, token-based). The action verifies status (`sent` or `viewed`), captures `acceptanceSignatureName`, `acceptanceSignatureAt = now`, `acceptanceIp`, transitions status to `accepted`, emits `proposal.accepted` Inngest event, and (if `projectId IS NULL`) calls `convertProposalToProject` synchronously.
3. The conversion creates a new `Project` with the proposal's title, the client, the proposal's currency, and (if a pricing block exists) the total amount as `budgetAmount`. The proposal's `projectId` is set to the new project.
4. The page re-renders showing "Proposal accepted" and a thank-you note. The freelancer gets an email + in-app notification.

### Decline

1. Client clicks "Decline." A small `{component.modal}` confirms and optionally accepts a reason in a `{component.textarea}`.
2. Submit calls `declineProposalPublic`. The action transitions to `declined`, sets `declinedAt`, optionally stores the reason in the audit metadata, and emits `proposal.declined`.

### Expire (cron)

1. The `proposals.check-expired` cron (daily 00:15 UTC) finds proposals where `status IN ('sent', 'viewed') AND validUntil < now`.
2. For each, it transitions status to `expired`, writes audit `proposal.expired`. No email is sent on expiry in v1.

### Regenerate public token

1. From the proposal detail header `{component.dropdown-menu}`, "Regenerate token." Confirm modal explains the prior URL stops working.
2. Action `regenerateProposalToken` issues a new nanoid(21), updates, writes `proposal.regenerated-token` audit. The detail page surfaces the new URL with a copy button.

## UI Surfaces

### `/(app)/proposals` — list

- Page heading "Proposals" in `{typography.display-md}`.
- Top bar: `{component.nav-pill-group}` "All / Draft / Sent / Accepted / Declined / Expired"; right side `{component.button-primary}` "New proposal."
- Body: `{component.data-table}` with columns Title / Client / Status (`{component.status-pill}`) / Total / Sent / Last activity.
- Empty state: `{component.empty-state-card}`.

### `/(app)/proposals/[id]/edit` — editor

App shell + max-width 1080px content area. Key components:

- Header band: title `{component.text-input}` (large, no border, types as `{typography.display-md}`); status pill; actions row right-aligned with "Send," "Preview," and a `{component.dropdown-menu}` for "Save as template," "Regenerate token," "Delete."
- Editor area: vertical stack of `{component.proposal-block}` wrappers. Each wrapper uses `{rounded.lg}` and `{colors.surface-card}` on hover; otherwise transparent. The wrappers carry left-side drag handles and right-side action menus.
- Block-specific renders use Middlemist-specific composite tokens: `{component.proposal-block-pricing}` (table layout with line items), `{component.proposal-block-scope}` (numbered list with descriptions), `{component.proposal-block-timeline}` (vertical milestone strip), `{component.proposal-block-terms}` (Tiptap rendered output), `{component.proposal-block-signature}` (preview of where the client signs), `{component.proposal-block-image}` (full-width image with caption).
- Right `{component.sheet-right}` library panel toggled by a "Library" `{component.button-secondary}` in the header.
- Bottom: "Add block" button.
- Auto-save indicator in the header.

### `/(app)/proposals/new` — modal route

`{component.modal}` for the create flow described above.

### `/(app)/proposals/[id]/preview` — preview

A read-only render of the proposal in the same shell the public viewer uses. Used by the freelancer to check before sending. Header has a "Back to edit" `{component.button-text-link}`.

### Public `/p/[token]` — client viewer

- Outer shell: `{colors.canvas}` background, max-width 880px content column centered, page padding `{spacing.xl}` top, `{spacing.section}` bottom (so the dark footer feels like the close).
- Top: freelancer logo (left, max 64px tall) + business name in `{typography.title-lg}` + sent date right-aligned in `{typography.caption}` `{colors.muted}`.
- Title: `{typography.display-lg}`. Below the title, "for {client_name}" in `{typography.body-md}` `{colors.muted}`.
- Blocks render in order. Block-internal styles match the editor's preview render. The pricing block's totals row uses `{typography.display-sm}` for the grand total.
- Bottom CTA: large `{component.button-primary}` "Accept proposal" (full-width on mobile, max 320px on desktop) with `{component.button-text-link}` "Decline" beneath.
- After acceptance: replace CTA area with a `{component.feature-card}` showing a success message + the typed name + accepted date.
- Footer: `{component.footer}` (dark surface), even on this public page. The footer carries the freelancer's wordmark (mapped to `{colors.on-dark}`) and "Powered by Middlemist" text.

States: expired/declined/accepted views render the proposal but with the CTA region replaced by a status banner. Rate-limit-exceeded renders a generic "try again later" page (no proposal content).

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `createProposal` | `createProposalSchema` (clientId, projectId?, templateId?, title) | `{ ok: true, data: { id } }` | Inserts draft; generates `publicToken`. Writes audit. |
| `updateProposal` | `updateProposalSchema` (id, blocksJson?, title?, validUntil?) | `{ ok: true, data: Proposal }` | Recomputes `totalAmount`; auto-saved by editor. |
| `sendProposal` | `{ id, validUntil? }` | `{ ok: true, data: Proposal }` | Transitions to `sent`, sets `sentAt` and `validUntil`. Emits `proposal.sent`. Writes audit. |
| `regenerateProposalToken` | `{ id }` | `{ ok: true, data: { newToken } }` | New nanoid(21); writes audit. |
| `expireProposal` | `{ id }` | `{ ok: true }` | Used by cron. Status → `expired`. |
| `convertProposalToProject` | `{ proposalId }` | `{ ok: true, data: { projectId } }` | Inserts a Project; sets `Proposal.projectId`. Writes audit. |
| `saveBlock` | `{ name, blockJson }` | `{ ok: true, data: { id } }` | Inserts SavedBlock. |
| `saveAsTemplate` | `{ proposalId, name, defaultValidDays? }` | `{ ok: true, data: { id } }` | Copies the proposal's blocks into a `ProposalTemplate`. |
| `savePricingItem` | `{ name, description?, rate, currency }` | `{ ok: true, data: { id } }` | Inserts SavedPricingItem. |
| `acceptProposalPublic` | `{ token, signatureName }` (no auth) | `{ ok: true, data: { projectId? } }` | Public action; rate-limited. Validates status, captures signature/IP/UA, transitions, optionally converts to project. |
| `declineProposalPublic` | `{ token, reason? }` (no auth) | `{ ok: true }` | Public action; rate-limited. Transitions to declined. |
| `deleteProposal` | `{ id }` | `{ ok: true }` | Hard deletes a draft. Sent/accepted/declined proposals cannot be deleted (use status). |

## Repository Functions

In `src/lib/repositories/proposals.repo.ts`:

- `findById(userId, id)`.
- `findByPublicToken(token)` — non-tenant; only returns a row for token equality.
- `list(userId, { status?, clientId?, projectId? })`.
- `create(userId, input)` — generates `publicToken`.
- `update(userId, id, input)` — `updateMany`, recomputes `totalAmount`.
- `setStatus(userId, id, status, transitionData)` — handles all status transitions; the `transitionData` carries `sentAt`, `viewedAt`, `acceptedAt`, etc., per the target status.
- `regeneratePublicToken(userId, id)`.
- `setProjectId(userId, id, projectId)` — used by the conversion path.
- `getForCron(now)` — returns proposals eligible for expiry; not tenant-scoped because the cron processes across all users.

In `src/lib/repositories/saved-blocks.repo.ts`, `saved-pricing-items.repo.ts`, and `proposal-templates.repo.ts`: standard CRUD patterns.

## Validation Rules

- **Title.** 1–200 characters.
- **Currency.** Required; ISO-4217 from supported set; not editable after `sent`.
- **`blocksJson`.** Validated against the typed block-array schema in `src/lib/schemas/proposal-blocks.schema.ts`. Each block type has its own zod sub-schema. Tiptap docs in text/terms blocks validated against the sanitized allowlist.
- **`totalAmount`.** Computed from pricing blocks; not accepted from input. Sum of `quantity * unitPrice` across all pricing block items, in the proposal's currency.
- **`validUntil`.** Optional. If set, must be `> sentAt` at send time.
- **Signature name (accept).** 1–120 characters, trimmed. Required.
- **Decline reason.** 0–1000 characters; optional.

## Permissions and Tenant Isolation

Standard for authenticated paths. The two public actions (`acceptProposalPublic`, `declineProposalPublic`) take a token, look up by `publicToken`, and validate the status. They never accept a `userId` from input; the proposal's row carries the freelancer's `userId` for downstream side effects (audit, notifications, conversion to project).

A two-user isolation test asserts: user A cannot read or write user B's proposals; `findByPublicToken` returns user B's proposal only for user B's exact token; the conversion action attaches the new project to user B (the proposal's owner) when triggered by a public accept.

## Audit and Notifications

Audit actions: `proposal.created`, `proposal.sent`, `proposal.viewed`, `proposal.accepted`, `proposal.declined`, `proposal.expired`, `proposal.regenerated-token`, `proposal.deleted`.

Audit metadata:

- `proposal.viewed`: `{ ip, userAgent }`.
- `proposal.accepted`: `{ signatureName, ip, userAgent }`.
- `proposal.declined`: `{ reason?, ip, userAgent }`.
- `proposal.sent`: `{ to: clientEmail, validUntil }`.

In-app notifications: `proposal.viewed`, `proposal.accepted`, `proposal.declined` surface in the bell-icon feed (see [14-in-app-notifications](./14-in-app-notifications.md)).

## Emails Sent

- `proposal-sent.tsx` to client on `proposal.sent`.
- `proposal-viewed.tsx` to freelancer on first `proposal.viewed` event.
- `proposal-accepted.tsx` to freelancer on `proposal.accepted`.
- `proposal-declined.tsx` to freelancer on `proposal.declined`.

The proposal-sent template uses customizable subject and body (see [15-email-customization](./15-email-customization.md)).

## Background Jobs

- `proposal.sent` event handler: sends email; sets `Update.emailSentAt` equivalent (here it's the audit and the `sentAt` column).
- `proposal.viewed` event handler: sets `viewedAt` if null; sends freelancer notification email; writes notification.
- `proposal.accepted` event handler: sends freelancer email; writes notification.
- `proposal.declined` event handler: sends freelancer email; writes notification.
- `proposals.check-expired` cron (daily 00:15 UTC): finds and expires.

## PDF generation

`/api/pdf/public/proposal/[token]` (route handler) — public, rate-limited. Renders the proposal using `@react-pdf/renderer`. The PDF template lives in `src/lib/pdf/templates/Proposal.tsx`. The PDF uses ink (`#111111`) for headings and dividers, Inter Display for the title and section heads, Inter for body, JetBrains Mono for line item numbers. See `docs/architecture/pdf-generation.md`.

The freelancer's authenticated path at `/api/pdf/proposal/[id]` returns the same PDF for the freelancer's preview.

## Edge Cases and Decisions

- **Multiple opens of a sent proposal.** Only the first `proposal.viewed` audit event sets `viewedAt`; subsequent views still write audit entries (for the activity panel) but do not re-set the column or re-fire the email.
- **Editing a sent proposal.** The editor permits edits but flags an `{component.alert-banner}` "This proposal has been sent. Edits will not re-send the email or change what the client has already seen." The change is captured by `updatedAt` and a future ADR (post-v1) may switch to versioned edits.
- **Accept after expiry.** The action checks status; if `expired`, returns `{ ok: false, error: "PROPOSAL_EXPIRED" }`. The public page surfaces the expiry banner and refuses the click.
- **Accept of a proposal that has no pricing block.** Allowed; `totalAmount` stays null. The conversion still happens, with the new project's `budgetAmount` left null.
- **Convert a proposal that already has a `projectId`.** Treated as already-converted; the accept handler does not re-create the project. The notification still fires.
- **Public accept hits the rate limiter mid-flow.** Rare; the page surfaces a "try again" message. The proposal stays in `sent`/`viewed` until the action succeeds.
- **PDF for a proposal with images that fail to fetch.** The PDF render falls back to a placeholder image element so the document still renders. The freelancer's preview surfaces a warning.
- **Saved block edits after insertion.** Inserting a saved block copies the JSON; subsequent edits to the saved block do not propagate to existing proposals.

## Definition of Done

- All twelve server actions implemented and typed.
- The block-array zod schema is the single source of truth used by both the editor and the public renderer.
- A two-user isolation test for `proposals.repo.ts` covers every function including `findByPublicToken`.
- A Vitest test exercises the status-transition table: draft → sent → viewed → accepted, draft → sent → declined, sent → expired by cron.
- A Playwright e2e test signs in, builds a proposal with a pricing block, sends it, opens the public URL in a clean browser context, accepts it, and asserts the project is created.
- The PDF render produces a snapshot that matches a fixture.
- The customizable email pipeline picks up overrides from `EmailSettings`.
- The list page, the editor, the preview page, and the public viewer all match the design tokens (verified visually against `docs/design/`).
- Screenshots of the editor, the public viewer (with hero block visible), the accept modal, the post-accept state, and the rendered PDF captured.
