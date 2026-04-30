# Component patterns

This is the canonical inventory of components in Middlemist. Every component has a token name. Every spec references the locked tokens from `typography.md`, `color.md`, and `spacing-and-radius.md`. Variants of a component live as sibling entries (`-active`, `-focused`, `-disabled`).

This doc is long because the design system is composed. Read it once end-to-end at the start of the build; refer back to specific entries as components get implemented.

## Navigation

### `{component.top-nav}`

The top navigation bar on every authenticated page. 64 pixels tall, `{colors.canvas}` background, `{colors.hairline-soft}` 1-pixel bottom border. Three regions: wordmark left, command palette trigger center, notifications + profile right.

- Container: `height: 64px`, `padding: 0 24px`, `background: {colors.canvas}`, `border-bottom: 1px solid {colors.hairline-soft}`
- Wordmark: Inter Display 600, 18px, `{colors.ink}`, with an inline circle mark
- Center region: holds `{component.command-palette}` trigger, max-width 240px

### `{component.nav-pill-group}`

The signature pill-in-pill component. A rounded pill container that holds 2-5 items, where the active item is highlighted as a smaller filled pill. Used for category filters, step indicators in onboarding, view toggles.

- Outer container: `padding: 4px`, `background: {colors.surface-soft}`, `border-radius: {rounded.pill}` (9999px), inline-flex
- Inner items (`{component.category-tab}`): `padding: 8px 16px`, Inter 500 14px, `{colors.muted}` text, `border-radius: {rounded.pill}` (inherits from group)
- Active item (`{component.category-tab-active}`): `background: {colors.canvas}`, `color: {colors.ink}`, subtle `box-shadow: 0 1px 2px rgba(0,0,0,0.05)`

```tsx
<div className="bg-surface-soft rounded-pill inline-flex p-1">
  <button className="text-nav-link text-muted rounded-pill px-4 py-2">All</button>
  <button className="text-nav-link text-ink bg-canvas rounded-pill px-4 py-2 shadow-sm">
    Active
  </button>
  <button className="text-nav-link text-muted rounded-pill px-4 py-2">Archived</button>
</div>
```

### `{component.app-sidebar}` and items

The vertical sidebar in the App Shell.

- `{component.app-sidebar}`: `width: 220px`, `background: {colors.canvas}`, `border-right: 1px solid {colors.hairline}`, `padding: 24px 12px`
- Section caption: `{typography.caption}`, uppercase, `{colors.muted-soft}`, padding-left 12px, padding-top 16px on subsequent sections
- `{component.app-sidebar-item}` (default): `padding: 8px 12px`, Inter 500 14px, `{colors.body}`, `border-radius: {rounded.md}` (8px), with a 16px Lucide icon on the left
- `{component.app-sidebar-item-active}`: `background: {colors.surface-card}`, `color: {colors.ink}`

### `{component.dropdown-menu}`

The Radix DropdownMenu primitive themed to Middlemist tokens. Used for profile menu, contextual actions on rows, "More" buttons.

- Container: `min-width: 180px`, `background: {colors.canvas}`, `border: 1px solid {colors.hairline}`, `border-radius: {rounded.md}` (8px), `padding: 4px`, `box-shadow: 0 4px 12px rgba(0,0,0,0.08)`
- Item: `padding: 8px 12px`, Inter 500 14px, `{colors.body}`, `border-radius: {rounded.sm}` (6px)
- Item active state: `background: {colors.surface-card}`, `color: {colors.ink}`
- Separator: `height: 1px`, `background: {colors.hairline}`, `margin: 4px 0`

### `{component.command-palette}`

The Cmd+K overlay. A modal that opens centered at the top third of the viewport, containing a search input and a result list grouped by entity type.

- Overlay: `background: rgba(0,0,0,0.4)`, fades in over 200ms
- Container: `width: 600px`, `max-width: calc(100vw - 32px)`, `top: 20vh`, `background: {colors.canvas}`, `border-radius: {rounded.lg}` (12px), `box-shadow: 0 12px 32px rgba(0,0,0,0.15)`
- Search input: full-width, `padding: 16px 20px`, Inter 400 16px, `border: none`, `border-bottom: 1px solid {colors.hairline}`
- Result group header: `{typography.caption}`, uppercase, `{colors.muted}`, `padding: 8px 16px`
- Result row: `padding: 10px 16px`, Inter 400 14px, `{colors.body}`, with optional Lucide icon on the left and `{component.kbd-key}` shortcut on the right
- Active result row: `background: {colors.surface-card}`, `color: {colors.ink}`

```tsx
<div className="fixed inset-0 bg-black/40">
  <div className="bg-canvas mx-auto mt-[20vh] w-full max-w-[600px] rounded-lg shadow-2xl">
    <input
      className="text-body-md border-hairline w-full border-b px-5 py-4 focus:outline-none"
      placeholder="Search clients, projects, proposals..."
    />
    <div>
      <div className="text-caption text-muted px-4 py-2 uppercase">Clients</div>
      <button className="text-body-sm text-body bg-surface-card text-ink flex w-full items-center justify-between px-4 py-2.5">
        <span>Mangosteen Studio</span>
        <kbd className="text-muted-soft text-xs">⏎</kbd>
      </button>
    </div>
  </div>
</div>
```

## Buttons

### `{component.button-primary}`

The primary action button. Near-black `{colors.primary}` background, white text, 8px radius.

- Default: `background: {colors.primary}`, `color: {colors.on-primary}`, `padding: 12px 20px` (md size), `border-radius: {rounded.md}` (8px), `font: {typography.button}` (Inter 600 14px)
- `{component.button-primary-active}` (press state): `background: {colors.primary-active}` `#242424`, transition 150ms ease-out
- Disabled: `opacity: 0.5`, `cursor: not-allowed`
- Sizes: sm (8 × 14, 12px font), md (12 × 20, 14px font, default), lg (14 × 24, 16px font)

```tsx
<button className="bg-primary text-on-primary text-button active:bg-primary-active rounded-md px-5 py-3 transition-colors duration-150 disabled:opacity-50">
  Send proposal
</button>
```

### `{component.button-secondary}`

The secondary action button. White background, hairline border, ink text.

- Default: `background: {colors.canvas}`, `border: 1px solid {colors.hairline}`, `color: {colors.ink}`, `padding: 12px 20px`, `border-radius: {rounded.md}`, `font: {typography.button}`
- Active: `background: {colors.surface-card}`, transition 150ms

### `{component.button-icon-circular}`

A 36 × 36 circular button that holds a single 16-20px Lucide icon. Used for toolbar actions, notification bell, kebab menus, close buttons in modals.

- Default: `width: 36px`, `height: 36px`, `border-radius: {rounded.full}` (50%), `background: {colors.canvas}`, `border: 1px solid {colors.hairline}`, icon color `{colors.body}`
- Active: `background: {colors.surface-card}`

### `{component.button-text-link}`

A text-only inline link. Used for tertiary actions, "Decline" alongside a primary "Accept", and inline links inside body copy.

- Default: `color: {colors.brand-accent}`, Inter 500 14px or inherits parent size, `text-decoration: none`
- Focus: `text-decoration: underline`, `text-decoration-color: currentColor`, transition 150ms

### `{component.button-destructive}`

A destructive action button (delete, archive permanently). Uses `{colors.error}` text on white background, with a transition to error background on press.

- Default: `background: {colors.canvas}`, `border: 1px solid {colors.error}`, `color: {colors.error}`, `padding: 12px 20px`, `border-radius: {rounded.md}`
- Active: `background: {colors.error}`, `color: {colors.on-primary}`, 150ms transition

## Inputs

### `{component.text-input}`

The default text input. Hairline border, white background, 8px radius. Asymmetric padding (vertical < horizontal).

- Default: `background: {colors.canvas}`, `border: 1px solid {colors.hairline}`, `padding: 10px 14px`, `border-radius: {rounded.md}` (8px), `font: {typography.body-md}`
- `{component.text-input-focused}`: `border-color: {colors.primary}`, `box-shadow: 0 0 0 2px rgba(17,17,17,0.08)`, transition 150ms
- `{component.text-input-error}`: `border-color: {colors.error}`, `box-shadow: 0 0 0 2px rgba(239,68,68,0.1)`
- Disabled: `background: {colors.surface-card}`, `color: {colors.muted}`

```tsx
<input
  type="text"
  className="bg-canvas border-hairline text-body-md placeholder:text-muted focus:border-primary focus:ring-primary/10 w-full rounded-md border px-3.5 py-2.5 focus:ring-2 focus:outline-none"
  placeholder="Client name"
/>
```

### `{component.textarea}`

Same as text-input but with `min-height: 96px` and `resize: vertical`.

### `{component.select}`

The Radix Select primitive themed. Visual shape matches `{component.text-input}` with a Lucide chevron-down icon on the right at 16px.

### `{component.checkbox}`

A 16 × 16 checkbox with `{rounded.xs}` (4px) radius.

- Default: `width: 16px`, `height: 16px`, `border: 1px solid {colors.hairline}`, `background: {colors.canvas}`, `border-radius: {rounded.xs}`
- Checked: `background: {colors.primary}`, white check icon (Lucide check at 12px)

### `{component.radio}`

A 16 × 16 radio with `{rounded.full}` radius.

### `{component.toggle-switch}`

A 36 × 20 toggle switch.

- Off: `background: {colors.surface-strong}`, knob `background: {colors.canvas}`, knob translates left
- On: `background: {colors.primary}`, knob translates right

## Cards

### `{component.feature-card}`

The light-gray card. Used for abstract feature claims, testimonial quotes, value propositions on marketing pages.

- `background: {colors.surface-card}` `#f5f5f5`
- `border-radius: {rounded.lg}` (12px)
- `padding: {spacing.xl}` (32px)
- No border. The light-gray surface against white canvas provides the boundary.

```tsx
<div className="bg-surface-card rounded-lg p-8">
  <h3 className="text-title-md text-ink">Proposals that read like documents</h3>
  <p className="text-body-md text-body mt-2">
    Block-based editor with saved templates and per-client branding.
  </p>
</div>
```

### `{component.feature-icon-card}`

A white card with a hairline border and a small Lucide icon at the top. Used for feature lists in 3-up grids, project cards on dashboard, invoice cards in client portal.

- `background: {colors.canvas}`
- `border: 1px solid {colors.hairline}`
- `border-radius: {rounded.lg}` (12px)
- `padding: {spacing.xl}` (32px)
- Icon: 24px Lucide, stroke 1.5, `{colors.ink}`, with `{spacing.md}` (16px) below before the title

### `{component.product-mockup-card}`

A white card that contains a real product UI fragment at smaller scale. Used in the hero band and feature sections to show what the product looks like rather than illustrating it.

- `background: {colors.canvas}`
- `border: 1px solid {colors.hairline}`
- `border-radius: {rounded.xl}` (16px)
- `padding: 0` (the UI fragment inside sets its own padding)
- Optional: subtle drop shadow `0 4px 12px rgba(0,0,0,0.08)` for slight elevation

### `{component.testimonial-card}`

A `{colors.surface-card}` card containing a quote and an author attribution.

- `background: {colors.surface-card}`
- `border-radius: {rounded.lg}` (12px)
- `padding: {spacing.lg}` (24px)
- Quote: `{typography.body-md}` `{colors.ink}`, no italics, no quote marks
- Author row: `{component.avatar-circle}` + name (`{typography.title-sm}` `{colors.ink}`) + role (`{typography.caption}` `{colors.muted}`)

### `{component.pricing-tier-card}` and featured

Used post-v1 if pricing is added. The featured tier inverts the surface to dark.

- Standard tier: `background: {colors.canvas}`, `border: 1px solid {colors.hairline}`, `border-radius: {rounded.lg}`, `padding: {spacing.xl}`
- Featured tier (`{component.pricing-tier-card-featured}`): `background: {colors.surface-dark}`, all text in `{colors.on-dark}`/`{colors.on-dark-soft}`, primary CTA stays `{colors.primary}` (no, wait — on dark surface, the CTA inverts to white-on-black — see notes in the doc)

### `{component.empty-state-card}`

The empty state container. Used when a list has no items.

- `background: {colors.canvas}`
- `border: 1px dashed {colors.hairline}` (the dashed border distinguishes it from a real card)
- `border-radius: {rounded.lg}` (12px)
- `padding: {spacing.xxl} {spacing.xl}` (48px vertical, 32px horizontal)
- Vertically centered content

## Editor and document surfaces

These are Middlemist-specific composite components that carry the product identity.

### `{component.proposal-editor-shell}`

The full-screen proposal editor surface. White canvas, no sidebar (the App Shell sidebar collapses), with a header row and a centered writing column.

- Header row: 64px tall, contains editable proposal title (Inter Display `{typography.display-sm}` inline-edit), `{component.status-pill}`, "Save draft" `{component.button-secondary}`, "Send" `{component.button-primary}`
- Writing column: max 720px, centered, `{colors.canvas}`
- Block area: each block is wrapped in `{component.proposal-block}` with hover-equivalent affordances on focus only

### `{component.proposal-block}` wrapper

Each proposal block sits in this wrapper. The wrapper provides per-block selection, drag handle, and "add block below" affordance.

- `padding: {spacing.lg}` (24px) horizontal, varies vertical per block type
- On focus: drag handle appears on the left (small Lucide grip-vertical icon, 16px, `{colors.muted}`)
- Below the block, on focus, an "+ Add block" `{component.button-text-link}` appears

### Specific proposal blocks

- **`{component.proposal-block-heading}`**: a single h2-style line at `{typography.display-md}`
- **`{component.proposal-block-text}`**: free-form rich text (Tiptap output) at `{typography.body-md}`
- **`{component.proposal-block-scope}`**: a title (`{typography.title-md}`) + bulleted list with 16px Lucide check-circle bullets in `{colors.success}`
- **`{component.proposal-block-deliverables}`**: title + checklist with Lucide checks in `{colors.muted}` (the freelancer is listing what gets delivered, not what's done)
- **`{component.proposal-block-timeline}`**: numbered phase rows. Each row: phase number in `{typography.code}` `{colors.muted-soft}` (left), phase name in `{typography.body-md}` `{colors.ink}` (center), duration in `{typography.code}` `{colors.muted}` (right)
- **`{component.proposal-block-pricing}`**: a clean line-item table inside a `{component.product-mockup-card}` shape. Header row in `{typography.caption}` uppercase tracking `{colors.muted}`. Body rows in `{typography.body-md}`. Subtotal/tax/total stack on the right; total in `{typography.display-sm}`
- **`{component.proposal-block-terms}`**: title + body in `{typography.body-md}` `{colors.body}` Inter (NOT serif). Slightly tighter line-height (1.5).
- **`{component.proposal-block-signature}`**: read-only signature row. Typed name in `{typography.title-md}` over a thin underline, business name + date below in `{typography.body-sm}` `{colors.muted}`
- **`{component.proposal-block-image}`**: full-width image within the column with optional caption in `{typography.caption}` `{colors.muted-soft}` below

### `{component.invoice-line-item-row}`

A single row in the invoice line-item table.

- Description (left): Inter 400 16px `{colors.ink}`, may wrap to two lines
- Quantity (center): Inter 400 14px `{colors.body}`, tabular-nums, right-aligned
- Unit price (center-right): same, with currency code in `{typography.code}` next to the number
- Total (right): Inter 600 16px `{colors.ink}`, tabular-nums, right-aligned
- Row separator: 1px `{colors.hairline-soft}`

### `{component.invoice-totals-stack}`

The subtotal/tax/total stack on the right side of the invoice.

- Subtotal: label `{typography.body-sm}` `{colors.muted}` left, value `{typography.body-md}` `{colors.ink}` right
- Tax (if any): same
- Divider: 1px `{colors.hairline}` 16px above and below
- Total: label `{typography.title-md}` `{colors.ink}` left, value `{typography.display-sm}` `{colors.ink}` right with currency code in `{typography.code}` `{colors.muted}` after

### `{component.client-portal-update-card}`

An update entry on the client portal project view.

- `background: {colors.surface-card}`
- `border-radius: {rounded.lg}`
- `padding: {spacing.lg}`
- Top row: avatar (24px) + author name (`{typography.title-sm}` `{colors.ink}`) + posted date (`{typography.caption}` `{colors.muted}`)
- Body: rich-text rendered output at `{typography.body-md}` `{colors.body}`
- Optional pinned indicator: small "Pinned" badge in top-right at `{typography.caption}` `{colors.muted-soft}` with a pin icon

### `{component.task-kanban-column}`

A vertical column on the project Tasks tab kanban view.

- Column header: status name (`{typography.title-sm}` `{colors.ink}`) + count (`{typography.caption}` `{colors.muted}`) on the right
- Column body: vertical stack of task cards, gap `{spacing.sm}` (12px)
- Each task card: white surface, hairline border, `{rounded.md}` radius, padding `{spacing.md}`, contains title + due date

## Tags and badges

### `{component.badge-pill}`

A generic small pill for category tags or "New" labels.

- `background: {colors.surface-card}` (default) or pastel at low opacity (rare)
- `padding: 4px 10px`
- `border-radius: {rounded.pill}`
- `font: {typography.caption}` `{colors.body}`

### `{component.status-pill}`

A semantic-colored pill for entity statuses (proposal: draft/sent/accepted/declined; invoice: draft/sent/paid/overdue/void; task: todo/doing/done).

- Padding 4 × 10, radius `{rounded.pill}`, font `{typography.caption}` weight 500
- Variants by status:
  - **Neutral** (draft): `background: {colors.surface-card}`, `color: {colors.muted}`
  - **In progress** (sent, doing): `background: {colors.brand-accent}/10`, `color: {colors.brand-accent}` (background uses 10% opacity tint)
  - **Success** (paid, accepted, done): `background: {colors.success}/10`, `color: {colors.success}`
  - **Warning** (overdue, expiring): `background: {colors.warning}/10`, `color: #b45309` (darker text for contrast)
  - **Error** (void, declined): `background: {colors.error}/10`, `color: {colors.error}`

```tsx
<span className="rounded-pill text-caption bg-success/10 text-success inline-flex items-center px-2.5 py-1 font-medium">
  Paid
</span>
```

### `{component.avatar-circle}`

A circular avatar image or initial fallback.

- `width: 36px`, `height: 36px`, `border-radius: {rounded.full}`
- With image: `object-fit: cover`
- Without image: pastel background (one of `{colors.badge-orange}`/`pink`/`violet`/`emerald`, picked by hash from name) with white initials in Inter 600 14px

### `{component.rating-stars}`

Used post-v1 for testimonial cards. Five 14px Lucide star icons, filled `{colors.warning}` for rated, outline `{colors.surface-strong}` for unrated.

## Tabs and filters

### `{component.category-tab}` and active

Inside a `{component.nav-pill-group}`. See nav-pill-group entry for full spec.

### `{component.tab-underline}`

The project detail tabs (Tasks/Time/Updates/Proposals/Invoices) and other multi-section detail pages.

- Container: horizontal flex, `border-bottom: 1px solid {colors.hairline}`
- Tab item: `padding: 12px 16px`, Inter 500 14px, `{colors.muted}` (default), `{colors.ink}` (active)
- Active tab indicator: 2px high `{colors.primary}` underline at the bottom of the active tab

## Tables and lists

### `{component.data-table}`

The default table for high-density list views (Invoices, Time entries) and document-internal tables (invoice line items).

- `background: {colors.canvas}`
- `border: 1px solid {colors.hairline}`
- `border-radius: {rounded.lg}` (12px)
- Header row: `background: {colors.surface-soft}`, `padding: 10px 16px`, `font: {typography.caption}` uppercase letter-spacing-tracked, `{colors.muted}`
- Body rows: `padding: 12px 16px`, Inter 400 14px, `{colors.body}`, separated by `{colors.hairline-soft}`
- Numeric columns: `tabular-nums`, right-aligned
- Sortable header: a small Lucide chevron-up-down icon in `{colors.muted-soft}` next to the label

### `{component.list-row}`

A simpler list row for less-dense lists. No table chrome; rows separated by hairline-soft dividers.

### `{component.kbd-key}`

A small inline keyboard key indicator. Used in command palette to show shortcuts and in tooltips.

- `padding: 2px 6px`
- `background: {colors.surface-card}`
- `border: 1px solid {colors.hairline}`
- `border-radius: {rounded.xs}` (4px)
- `font: {typography.code}` 12px

## Overlay

### `{component.modal}` and overlay

A centered modal dialog.

- Overlay `{component.modal-overlay}`: `background: rgba(0,0,0,0.4)`
- Container: `width: 480px` (sm), `560px` (md), `720px` (lg). `background: {colors.canvas}`. `border-radius: {rounded.lg}` (12px). `box-shadow: 0 12px 32px rgba(0,0,0,0.15)`
- Header: `padding: {spacing.lg}` (24px), title in `{typography.title-lg}` `{colors.ink}`, close button (`{component.button-icon-circular}`) on the right
- Body: `padding: {spacing.xl}` (32px) by default
- Footer: `padding: {spacing.lg}` (24px), bottom row of buttons (secondary on left, primary on right)

### `{component.sheet-right}`

A right-edge sliding panel. Used for the saved-blocks library inside the proposal editor and for mobile sidebar.

- `width: 480px` (default), `100vw - 32px` on mobile
- `background: {colors.canvas}`
- `border-radius: {rounded.lg}` (12px) on the left edge only (top-left and bottom-left corners)
- Slides in from the right over 300ms ease-out

### `{component.toast}`

A sonner-style toast notification.

- `background: {colors.surface-dark}`
- `color: {colors.on-dark}`
- `padding: 12px 16px`
- `border-radius: {rounded.md}` (8px)
- `box-shadow: 0 8px 24px rgba(0,0,0,0.15)`
- Anchored to bottom-right of viewport
- Auto-dismisses after 4 seconds

### `{component.tooltip}`

A small hover label.

- `background: {colors.surface-dark-elevated}` `#1a1a1a`
- `color: {colors.on-dark}`
- `padding: 6px 10px`
- `border-radius: {rounded.sm}` (6px)
- `font: {typography.caption}`

## CTA bands and footer

### `{component.cta-band-light}`

A full-width light band on marketing pages with a heading and primary CTA.

- `background: {colors.canvas}` or `{colors.surface-card}` depending on surface pacing
- `padding: {spacing.section}` (96px) above and below
- Centered content: heading at `{typography.display-md}`, optional subhead at `{typography.body-md}` `{colors.muted}`, primary CTA below

### `{component.footer}`

The dark footer that closes every page. Only one per page.

- `background: {colors.surface-dark}` `#101010`
- `padding: {spacing.xxl} {spacing.lg}` (48px vertical, 24px horizontal min)
- Inner content max width matches the page (1200px on app, 880px on document, 720px on portal)
- Wordmark in `{colors.on-dark}` Inter Display 600 18px
- Links in `{colors.on-dark-soft}` Inter 500 14px
- Copyright in `{colors.on-dark-soft}` `{typography.caption}`

```tsx
<footer className="bg-surface-dark text-on-dark px-6 py-12">
  <div className="mx-auto flex max-w-[1200px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
    <div className="font-display text-title-md flex items-center gap-2">
      <span className="bg-on-dark size-3 rounded-full" />
      middlemist
    </div>
    <nav className="text-body-sm text-on-dark-soft flex gap-6">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/contact">Contact</a>
    </nav>
    <p className="text-caption text-on-dark-soft">© {new Date().getFullYear()} CJ Jutba</p>
  </div>
</footer>
```

## Hero (marketing only)

### `{component.hero-band}`

The hero section of the marketing landing page.

- `background: {colors.canvas}`
- `padding: 120px 0` (extra-tall to give the hero presence)
- Inner content: 7-5 grid (text left, mockup right) on desktop; stacks on mobile
- Heading: `{typography.display-xl}` (64px) Inter Display 600 -2px tracking
- Subheading: `{typography.body-md}` `{colors.body}`, max-width 480px
- Primary CTA: `{component.button-primary}` lg size + `{component.button-text-link}` "See how it works"

### `{component.hero-app-mockup-card}`

The product mockup card that occupies the right 5 columns of the hero grid.

- `background: {colors.canvas}`
- `border: 1px solid {colors.hairline}`
- `border-radius: {rounded.xl}` (16px)
- `box-shadow: 0 12px 32px rgba(0,0,0,0.12)` (the only place a heavier shadow appears)
- Contains a miniature App Shell screenshot (the actual dashboard at smaller scale, not an illustration)

## Component composition rule

When designing a new feature, do not invent new components. Compose from this list. If a need genuinely cannot be met by composing existing components, the new component goes in this doc with a token name before it goes in code. The discipline is what keeps the system coherent.
