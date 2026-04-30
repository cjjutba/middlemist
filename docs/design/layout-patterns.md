# Layout patterns

Middlemist has two primary page layouts and a handful of specialized variants. The two primaries cover most of the product: the **App Shell** (freelancer dashboard) is what the freelancer sees while working, and the **Document Shell** (client portal, public proposal, public invoice) is what the client sees while reading. The variants are auth, onboarding, list views, detail views, editors, and settings.

This doc fixes the structure of each layout, the responsive breakpoints, and the page-by-page recipes that compose the structures into specific routes.

## App Shell

The App Shell is the layout for every page inside the `(app)` route group: dashboard, today, clients, projects, proposals, invoices, time, settings. It has three regions stacked: top nav, sidebar + content, no footer.

### Top nav

`{component.top-nav}` sits at the top of every authenticated page. It is 64 pixels tall, `{colors.canvas}` white, and ends with a `{colors.hairline-soft}` 1-pixel bottom border. The nav has three regions:

- **Left:** the wordmark "middlemist" lowercase set in Inter Display 600 with a small circle mark. The wordmark is a link to `/dashboard`.
- **Center:** the `{component.command-palette}` trigger. A pill-shaped button at `{rounded.pill}`, 240 pixels wide, with a Lucide search icon on the left and the placeholder "Search or jump to..." in `{colors.muted}`. Clicking or pressing Cmd+K opens the full command palette overlay.
- **Right:** a `{component.button-icon-circular}` for notifications (Lucide bell icon, with a red dot when unread notifications exist), and a `{component.dropdown-menu}` triggered by an `{component.avatar-circle}` for the freelancer's profile menu (Settings, Sign out).

### Sidebar

`{component.app-sidebar}` is 220 pixels wide on desktop, anchored to the left edge below the top nav, `{colors.canvas}` white, with a `{colors.hairline}` 1-pixel right border. It contains navigation items grouped into sections, each section preceded by a small caption.

The section headers use `{typography.caption}` (13px, weight 500), `{colors.muted-soft}`, uppercase letter-spacing-tracked. The section dividers are no extra spacing — the caption itself separates the groups visually.

The navigation items are:

- **Workspace section:** Today, Dashboard
- **Records section:** Clients, Projects, Proposals, Invoices
- **Tracking section:** Time
- **Settings section:** Settings (collapsed sub-nav inside)

Each item is a `{component.app-sidebar-item}` (default state) or `{component.app-sidebar-item-active}` (current route). The active state uses `{colors.surface-card}` background with `{colors.ink}` text; the default state has no background and `{colors.body}` text.

### Content area

The content sits to the right of the sidebar, max-width 980px (1200 - 220), centered horizontally inside the available space. Top padding is `{spacing.xxl}` (48px) below the top nav; bottom padding is `{spacing.xxl}` (48px) before the page ends.

Sections within content are separated by `{spacing.xl}` (32px) to `{spacing.xxl}` (48px). The exact value depends on the visual weight of the sections — heavier sections (a kanban board) get the larger gap; lighter sections (a small stats row) get the smaller.

There is no footer on App Shell pages. The footer is reserved for marketing and document layouts.

### Responsive

- At `lg` (1024px+): sidebar 220px, content max 980px.
- Below `lg` (≤1023px): sidebar collapses to a 60px icon rail. Icons remain visible; labels disappear. The active item shows the label as a tooltip on focus.
- Below `md` (≤767px): sidebar collapses to a slide-in `{component.sheet-right}` triggered by a hamburger button in the top nav (which appears only at this breakpoint). Top nav simplifies: wordmark on left, hamburger on right; command palette and notifications collapse into the slide-in.
- Below `sm` (≤639px): all of the above plus content padding tightens from `{spacing.xxl}` to `{spacing.lg}` (24px) on each side.

## Document Shell

The Document Shell is the layout for every client-facing page: public proposal view (`/p/[token]`), public invoice view (`/i/[token]`), client portal home (`/portal/(client)`), client portal project view (`/portal/(client)/projects/[id]`). It has three regions stacked: branded header, centered content column, dark footer.

### Branded header

A 60-80 pixel band at the top of the page, `{colors.canvas}` white, with the freelancer's logo (small image, 32-40px tall) and business name (`{typography.title-md}` `{colors.ink}`) on the left. The header carries the freelancer's brand, not Middlemist's. There is no navigation in the header — the document is the page.

For multi-document views (client portal home), the header may include the freelancer's name only; for single-document views (public proposal, public invoice), the header includes the document number/identifier on the right (`{typography.code}` `{colors.muted}`).

### Centered content column

The content column is centered horizontally, `{colors.canvas}` white, with one of three max widths:

- **720px** for public proposal view, client portal home, client portal project view. The narrower width supports comfortable reading of body copy.
- **880px** for public invoice view. The line-item table needs the room.

Vertical padding inside the column is `{spacing.xxl}` (48px) to `{spacing.section}` (96px) at the top and bottom, with `{spacing.lg}` (24px) to `{spacing.xl}` (32px) between content blocks. The exact spacing comes from the public-views doc per page.

### Dark footer

`{component.footer}` sits at the bottom of every Document Shell page. It is `{colors.surface-dark}` `#101010` background, `{colors.on-dark}` text, and contains:

- The wordmark "middlemist" in `{colors.on-dark}` on the left
- A short row of links (Privacy, Terms, Contact) in `{colors.on-dark-soft}` on the right
- A copyright line in `{colors.on-dark-soft}` `{typography.caption}` below

The footer is the only dark surface on the page. Its presence closes the page consistently and signals "this document is presented by Middlemist for {freelancer}." It does not say "powered by Middlemist" in the document body — that would violate the principle that the client view is sacred. The footer carries the attribution quietly.

### Responsive

The Document Shell is mobile-first by structure. The centered column scales from its max width down to the viewport width minus `{spacing.lg}` (24px) on each side. The dark footer stacks its contents vertically below `md` (≤767px). The branded header narrows but never collapses — the freelancer's logo and name stay visible.

## Specific page layouts

The pages below compose the two shells with module-specific content. Each entry is a one-paragraph recipe.

**Auth pages (`/login`, `/signup`, `/reset-password`, `/magic-link/request`).** Centered, narrow column at 400px max. White canvas. Wordmark at the top in `{typography.title-lg}`. A single form below: heading at `{typography.display-md}`, subheading at `{typography.body-md}` `{colors.muted}`, then the form fields with `{spacing.md}` between them, then the primary `{component.button-primary}` full-width. A small `{component.button-text-link}` below for the alternate action ("Need an account? Sign up"). No footer.

**Onboarding (`/onboarding/*`).** Centered, narrow column at 480px max. White canvas. A `{component.nav-pill-group}` at the top showing the four steps (Profile, Business, Branding, Done), with the current step active. The step content fills the column: a heading at `{typography.display-sm}`, subheading at `{typography.body-md}` `{colors.muted}`, the form fields, and a row at the bottom with a `{component.button-text-link}` "Back" on the left and a `{component.button-primary}` "Continue" on the right.

**Dashboard (`/dashboard`).** App Shell with content max 980px. Sections in order: a "Today" panel showing what is due today (overdue invoices, pending proposals, today's tasks), an "Active projects" 3-up `{component.feature-icon-card}` grid showing up to six current projects, a "Recent activity" `{component.feature-card}` listing the last ten audit-log entries in a compact list, a "Quick stats" 4-up small grid (active projects count, pending invoices total, time logged this week, hours billed this month), a "Quick actions" row of four `{component.button-secondary}` buttons (New client, New project, New proposal, New invoice). Each section has `{spacing.xxl}` (48px) above and below.

**List pages (Clients, Projects, Proposals, Invoices, Time).** App Shell with content max 980px. A page header row at the top: page title in `{typography.display-md}`, a row of filter `{component.button-secondary}` and a primary `{component.button-primary}` for "New X" on the right. Below the header, a `{component.data-table}` for high-density lists (Invoices, Time entries) or a 3-up `{component.feature-icon-card}` grid for card lists (Projects). The Clients list uses a `{component.data-table}` with avatar + name + company columns. Empty state uses the `{component.empty-state-card}` pattern from the empty-states doc.

**Detail pages (Project hub, Client detail, Proposal detail, Invoice detail).** App Shell with content max 980px. A page header with the entity name in `{typography.display-md}`, a `{component.status-pill}` next to it, and an action row to the right (Edit, Archive, etc.). Below the header, a `{component.tab-underline}` with the entity's sub-sections. For the Project hub, the tabs are Overview, Tasks, Time, Updates, Proposals, Invoices. Each tab swaps the content panel below.

**Editor pages (Proposal builder, Invoice builder).** App Shell with full-width writing area (no left sidebar — the App Shell sidebar collapses to icon rail when an editor opens, or hides entirely depending on viewport). The editor has its own header row with the entity title (editable inline), a `{component.status-pill}`, a "Save draft" `{component.button-secondary}`, and a primary `{component.button-primary}` "Send" or "Mark sent". The writing area takes the full content width. A `{component.sheet-right}` slides in from the right when the freelancer clicks "Add block" or "Saved blocks library" — it is dismissible by clicking outside.

**Settings (`/settings/*`).** App Shell with a left sub-nav inside the content area. The sub-nav is shaped like a small `{component.app-sidebar}` (200px wide) with sections for Profile, Business, Branding, Email, Reminders, Data export. The settings content sits to the right at max 720px. Each settings page is a focused form with one or two sections.

**Public proposal view (`/p/[token]`).** Document Shell at 720px content. Branded header with freelancer logo + name. Document content with proposal title, blocks, and at the bottom an accept/decline band. Dark footer closes the page. The full structure is in `public-views.md`.

**Public invoice view (`/i/[token]`).** Document Shell at 880px content. Branded header with freelancer logo + name + invoice number. Document content with bill-from/bill-to, line-item table, totals stack, notes, payment instructions. A prominent "View as PDF" `{component.button-secondary}` near the totals. Dark footer closes the page.

**Client portal home (`/portal/(client)`).** Document Shell at 720px content. Branded header. Greeting "Hi {client_name}" in `{typography.display-md}`. A list of project cards (one per project) using `{component.feature-icon-card}` shape, each showing project name, status pill, and last-update caption. Dark footer.

**Client portal project view (`/portal/(client)/projects/[id]`).** Document Shell at 720px content. Branded header. Project name in `{typography.display-lg}`, status pill + dates beneath. Description (markdown rendered). Sections in order: Updates feed, Tasks (client-visible only), Time entries (if enabled), Invoices (small `{component.feature-icon-card}` per invoice), Proposals (same shape). Dark footer.

## Responsive breakpoints

The system uses Tailwind's default breakpoints with mobile-first defaults.

| Breakpoint | Min width | Use                             |
| ---------- | --------- | ------------------------------- |
| (default)  | 0         | Mobile portrait                 |
| sm         | 640px     | Mobile landscape, small tablet  |
| md         | 768px     | Tablet portrait                 |
| lg         | 1024px    | Tablet landscape, small desktop |
| xl         | 1280px    | Desktop                         |
| 2xl        | 1536px    | Large desktop (rare)            |

The most consequential breakpoint is `lg` because it is where the App Shell sidebar collapses. The next most consequential is `md` because it is where data tables become stacked cards and modals lose their padding generosity.

## Specific responsive rules

A short list of the responsive rules that apply across pages:

- **App Shell sidebar:** 220px above `lg`, 60px icon rail at `lg` and `md`, slide-in sheet below `md`.
- **Document Shell:** centered column scales linearly with viewport, never below `{spacing.lg}` (24px) horizontal padding.
- **Data tables:** at `md` and below, tables become stacked card lists. Each row becomes a card with the column labels visible inside.
- **Modals:** at `sm` and below, modals fill the screen edge to edge with `{spacing.lg}` (24px) padding instead of `{spacing.xl}` (32px).
- **Hero band on marketing surface:** 7-5 grid (text 7 cols, mockup 5 cols) on desktop; stacks to single column at `md` and below.
- **3-up feature card grids:** stack to 1-column at `md`, optionally 2-column at `sm` if the cards are short.
- **Top nav:** simplifies at `md` (hamburger replaces sidebar), narrows the command palette to a search icon at `sm`.
- **Touch targets:** any interactive surface at `md` and below has a minimum tap area of 44 × 44 pixels per Apple HIG. Padding adjusts up if the resting size is smaller.
