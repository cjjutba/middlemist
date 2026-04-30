# Public views

The public proposal view, the public invoice view, and the client portal are the three surfaces clients see. They are the showcase pages. A freelancer's client opens Middlemist for ~5 minutes per engagement: when the proposal arrives, when the invoice arrives, and occasionally to check on the project. Every visual detail of those minutes affects whether the freelancer reads as professional.

The overarching principle for these views: clean modern-SaaS document layout, not editorial. White canvas, Inter Display headings, Inter body, hairline dividers, dark footer that closes the page. Source Serif 4 is not used. The earlier editorial direction (serif body, ornamented borders, decorative accents) is deprecated.

This doc fixes the structure for each public view, the per-block specs in the proposal, the table and totals shape in the invoice, and the portal layouts.

## Public proposal view

Route: `/p/[token]`. The freelancer creates a proposal and shares the public link with the client. The client opens it in their browser. No authentication required. The page renders server-side from the proposal's public token.

### Layout

Document Shell at 720px content width on `{colors.canvas}` white. Top branded header, centered content column, bottom dark footer.

**Branded header.** 60-80px tall band at the top of the page. Left: freelancer's logo (small image, 32-40px tall) + business name in `{typography.title-lg}` `{colors.ink}`. Right: the date the proposal was sent, in `{typography.caption}` `{colors.muted}` (e.g., "Sent April 20, 2026").

**Title block.** Below the header, with `{spacing.xl}` (32px) above. The proposal title in `{typography.display-lg}` (48px) Inter Display 600 -1.5px tracking. Below the title in `{spacing.md}` (16px), the validUntil date in `{typography.body-sm}` `{colors.muted}` (e.g., "Valid until May 4, 2026").

**Content blocks.** Each block in sequence with `{spacing.lg}` (24px) to `{spacing.xl}` (32px) between them. The exact spacing depends on adjacency: block-of-text → block-of-text uses 24px; block-of-text → heading-block uses 32px.

**Accept band.** After the last content block, with `{spacing.xxl}` (48px) above. The accept band contains a primary `{component.button-primary}` "Accept proposal" (lg size, full-width or 240px wide) and a `{component.button-text-link}` "Decline" below the primary.

**View as PDF.** Below the accept band with `{spacing.lg}` (24px) above, a `{component.button-text-link}` "View as PDF" linking to the rendered PDF version. Smaller than the accept buttons because most clients accept in the browser; the PDF is a courtesy.

**Footer.** `{component.footer}` in `{colors.surface-dark}` `#101010`. Even on a public proposal view. The footer closes the page consistently with the rest of the product.

### Per-block specs

Each block type has its own visual treatment. The block-by-block specs below are the canonical patterns. The proposal editor builds these blocks and the public view renders them in the same shape.

**`{component.proposal-block-heading}`.** A single h2-level line at `{typography.display-md}` (36px) `{colors.ink}`. Used to introduce a major section ("The work," "What you will receive," "How long it will take").

**`{component.proposal-block-text}`.** Free-form rich text rendered from Tiptap output. `{typography.body-md}` (16px) Inter 400 `{colors.body}`. Inline links use `{colors.brand-accent}` with underline on focus. No italics for entire paragraphs; bold for inline emphasis only.

**`{component.proposal-block-scope}`.** A title in `{typography.title-md}` (18px) `{colors.ink}` ("Scope" by default), followed by a bulleted list. Each bullet has a 16px Lucide check-circle icon in `{colors.success}` on the left and the scope item text at `{typography.body-md}` `{colors.body}`. The check-circle is the bullet — there is no additional bullet character. The visual rhythm of the colored checks gives the scope block its character.

**`{component.proposal-block-deliverables}`.** Same shape as scope but with a different bullet: a 16px Lucide square (empty checkbox shape) in `{colors.muted}`. The freelancer is listing what will be delivered, not what is done; the muted square reads as forward-looking. The title is `{typography.title-md}` "Deliverables" or whatever the freelancer set.

**`{component.proposal-block-timeline}`.** A title at `{typography.title-md}` ("Timeline"), followed by numbered phase rows. Each row has three columns:

- Left: phase number in `{typography.code}` (JetBrains Mono 14px) `{colors.muted-soft}` (e.g., "01", "02", "03") in a 32px wide column
- Center: phase name in `{typography.body-md}` `{colors.ink}`, with optional sub-line in `{typography.body-sm}` `{colors.muted}` describing what happens in the phase
- Right: duration in `{typography.code}` `{colors.muted}` (e.g., "2 weeks", "5 days")

Rows separated by `{colors.hairline-soft}` 1px dividers with `{spacing.md}` (16px) above and below each row.

**`{component.proposal-block-pricing}`.** The most visually distinctive block. A line-item table inside a `{component.product-mockup-card}` shape (white surface, hairline border, `{rounded.xl}` 16px radius).

Inside the card:

- Header row: `{typography.caption}` (13px, weight 500) uppercase letter-spacing-tracked `{colors.muted}`. Columns: "Item", "Qty", "Price", "Total".
- Body rows: each line item. Description in `{typography.body-md}` `{colors.ink}` (left, may wrap to 2 lines). Qty in `{typography.body-md}` `{colors.body}` tabular-nums right-aligned. Price in `{typography.body-md}` `{colors.body}` tabular-nums with currency code in `{typography.code}` `{colors.muted}` next to the number. Total in `{typography.body-md}` weight 600 `{colors.ink}` tabular-nums.
- Row separator: 1px `{colors.hairline-soft}`.
- Below the table, on the right (40-50% of card width): a `{component.invoice-totals-stack}`-style stack. Subtotal, optional tax (label and value), and a horizontal `{colors.hairline}` divider. Total in `{typography.display-sm}` (28px) Inter Display 600 -0.5px tracking `{colors.ink}` with currency code in `{typography.code}` `{colors.muted}` after.

**`{component.proposal-block-terms}`.** A title at `{typography.title-md}` ("Terms" or whatever the freelancer set), followed by body text in `{typography.body-md}` `{colors.body}` Inter (NOT serif). Slightly tighter line-height (1.5 standard, but visually more dense because of the legal/structured nature). Lists use Lucide's small dot bullet at `{colors.muted-soft}`.

**`{component.proposal-block-signature}`** (read-only freelancer side). A small block at the bottom of the proposal showing the freelancer's signature line. Typed name in `{typography.title-md}` (18px) `{colors.ink}` over a thin `{colors.hairline}` underline (the typed name sits 4px above the underline). Below the underline in `{spacing.xs}` (8px), the business name + date in `{typography.body-sm}` `{colors.muted}`.

**`{component.proposal-block-image}`.** A full-width image within the column. Optional caption below in `{typography.caption}` `{colors.muted-soft}` italics.

### Accept dialog

When the client clicks "Accept proposal," a `{component.modal}` (sm size, 480px wide) opens.

- Header: "Accept proposal" in `{typography.title-lg}`
- Body: a single instruction line ("Type your full name to confirm acceptance.") in `{typography.body-md}` `{colors.body}`, followed by a `{component.text-input}` for the name
- Below the input: an explainer in `{typography.caption}` `{colors.muted}` ("This serves as your electronic signature.")
- Footer: a `{component.button-text-link}` "Cancel" on the left and a `{component.button-primary}` "Confirm acceptance" on the right

On submit, the proposal status updates to accepted; the client is redirected back to the proposal view, which now shows an "Accepted" status pill at the top and a small confirmation banner.

### Decline action

The "Decline" link does not open a modal. It performs the action immediately and shows a "Proposal declined" state. The reason is that requiring a client to submit a form to decline adds friction and feels manipulative. Decline is one click.

## Public invoice view

Route: `/i/[token]`. Visually similar to the proposal view but optimized for displaying a tabular invoice.

### Layout

Document Shell at **880px** content width (wider than proposal because the line-item table needs the room). White canvas, branded header, content, dark footer.

**Branded header.** Same as proposal: freelancer logo + business name on the left. On the right: invoice number in `{typography.code}` `{colors.muted}` (e.g., "INV-2026-0042"), and the issued/due dates below the number in `{typography.caption}` `{colors.muted}`.

**Status pill.** Below the header on the left, with `{spacing.lg}` (24px) above. A `{component.status-pill}` showing the invoice status (Draft, Sent, Paid, Overdue, Void).

**Bill-from / Bill-to row.** Below the status with `{spacing.xl}` above. Two columns. Left: the freelancer's billing details (business name, address, tax ID if set, email) at `{typography.body-md}` `{colors.body}`. Right: the bill-to client (client name, company, email, address). Each has a small caption header above ("Bill from", "Bill to") at `{typography.caption}` uppercase `{colors.muted-soft}`.

**Line-item table.** A `{component.data-table}`-shaped table with rounded `{rounded.lg}` outer container and hairline border.

- Header row: `background: {colors.surface-soft}`, `padding: 12px 16px`, `{typography.caption}` uppercase `{colors.muted}`. Columns: "Description" (left, flex), "Qty" (right-aligned, 80px), "Unit price" (right-aligned, 120px), "Total" (right-aligned, 120px).
- Body rows: `{component.invoice-line-item-row}` (see `component-patterns.md`). Description in `{typography.body-md}` `{colors.ink}`. Numeric columns in `{typography.body-md}` tabular-nums right-aligned. Currency code in `{typography.code}` `{colors.muted}` next to monetary values.
- Row separator: 1px `{colors.hairline-soft}`.

**Totals stack.** Below the table on the right (matching the table's right edge), with `{spacing.md}` (16px) above. The `{component.invoice-totals-stack}`:

- Subtotal: label `{typography.body-sm}` `{colors.muted}` left, value `{typography.body-md}` `{colors.ink}` right
- Tax (if applicable): same shape
- Discount (if applicable): same shape, value in red parentheses if negative
- Divider: 1px `{colors.hairline}` 16px above and below
- **Total: label `{typography.title-md}` `{colors.ink}` left, value `{typography.display-sm}` (28px) Inter Display 600 -0.5px tracking `{colors.ink}` tabular-nums right, with currency code in `{typography.code}` `{colors.muted}` after**

**Notes block** (optional). Below the totals with `{spacing.xl}` above. A `{typography.title-md}` "Notes" header followed by `{typography.body-md}` `{colors.body}` body text. Used for thank-you notes, payment terms, or context.

**Payment instructions** (optional). Below the notes. A `{typography.title-md}` "Payment instructions" header followed by a structured bulleted list at `{typography.body-md}` showing payment options (bank transfer details, GCash, PayPal, etc.).

**View as PDF.** A `{component.button-secondary}` (lg size) "View as PDF" near the totals. More prominent than on the proposal view because clients often save invoices as PDF for their records.

**Footer.** `{component.footer}` in `{colors.surface-dark}`.

## Client portal home

Route: `/portal/(client)`. The client signs in via magic link and lands here. They see a list of their projects.

### Layout

Document Shell at 720px content. White canvas, branded header (freelancer's name only, no document number), centered content, dark footer.

**Greeting.** Below the header with `{spacing.xl}` above. "Hi {client_name}" in `{typography.display-md}` (36px) `{colors.ink}`.

**Project list.** Below the greeting with `{spacing.xl}` above. A vertical list of `{component.feature-icon-card}` cards, one per project, full-width within the column.

Each card:

- Top row: project name in `{typography.title-md}` (18px) `{colors.ink}` on the left; `{component.status-pill}` on the right
- Below the top row: last update line in `{typography.caption}` `{colors.muted}` ("Last updated 3 days ago" or "No updates yet")
- The card is a link to the project view

No stats, no charts, no progress bars. Just a list of projects.

**Footer.** `{component.footer}` dark.

## Client portal project view

Route: `/portal/(client)/projects/[id]`. The client clicks into a project from the portal home and sees the project's details.

### Layout

Document Shell at 720px content. White canvas, branded header, centered content, dark footer.

**Project header.** Project name in `{typography.display-lg}` (48px) `{colors.ink}`. Below the name with `{spacing.md}` above: a row containing a `{component.status-pill}` and the project dates ("Started Mar 15, 2026 · Ongoing") in `{typography.body-sm}` `{colors.muted}`.

**Description.** Below the header with `{spacing.xl}` above. The project description as markdown-rendered Tiptap output at `{typography.body-md}` `{colors.body}`.

**Sections in order.** Each section has a `{typography.title-lg}` heading at the top with `{spacing.xxl}` above:

1. **Updates.** A vertical stack of `{component.client-portal-update-card}` cards, newest first. Pinned updates appear first regardless of date with a small "Pinned" indicator. Each card shows the update author, date, and rich-text body.
2. **Tasks** (client-visible only). A simple list, not a kanban. Each task: status icon (Lucide circle for todo, half-filled for doing, check-circle for done) + title at `{typography.body-md}` + due date at `{typography.caption}` `{colors.muted}` on the right. Tasks marked private to the freelancer do not appear here.
3. **Time entries** (if the freelancer enabled client visibility on time tracking). A simple `{component.data-table}` showing date, description, hours. No rates exposed unless the freelancer chose to.
4. **Invoices.** Each invoice as a small `{component.feature-icon-card}` with invoice number, status pill, total, and a "View invoice" link.
5. **Proposals.** Same shape as invoices: small cards per proposal with status pill, title, and a "View proposal" link.

Sections appear only if they have content. An empty Updates section, for example, is omitted from the project view. The empty-states pattern is for the freelancer's app, not the client portal — the client should not see "No updates yet" because that reads as the freelancer being absent.

**Footer.** `{component.footer}` dark.

## Why these views are different from the freelancer app

Three reasons drive the different treatment:

1. **The client is reading, not working.** The freelancer's app is a tool — sidebar nav, density, filters, command palette. The client's view is a document — a single column, generous whitespace, one path through the page.
2. **The client sees Middlemist for minutes per engagement.** Every detail matters more because there are fewer details. A misaligned price column on an invoice is forgivable in an app the freelancer uses every day; on an invoice the client sees once, it is the impression.
3. **The freelancer's brand carries through.** The Document Shell uses the freelancer's logo and name in the header. The Cal.com-aligned restraint of the rest of the surface lets the freelancer's brand register without competition.

These three views are the highest-leverage surfaces in the product. Build them with extra care during weeks 10, 12, and 14 of the sprint plan. Capture screenshots for the case study from these views first.
