# Spacing and radius

Spacing and radius are the two scales that make Middlemist's surfaces feel calm. The spacing scale governs whitespace between elements, padding inside surfaces, and gap between cards. The radius scale governs how soft each corner reads — buttons, inputs, cards, modals. Both are locked to a small set of values. Off-scale spacing or radius is the most common source of "this looks slightly off" that shows up in review.

This doc fixes the two scales, lists the rules for where each value lives, and pairs padding with radius for the most common components.

## The spacing scale

Base unit is 4 pixels. Eight tokens cover every spacing decision in the product.

| Token               | Value | Use                                                                   |
| ------------------- | ----- | --------------------------------------------------------------------- |
| `{spacing.xxs}`     | 4px   | Tight gaps between inline elements (icon + text inside a chip)        |
| `{spacing.xs}`      | 8px   | Small gaps inside compact rows, between icon and label                |
| `{spacing.sm}`      | 12px  | Default gap between form fields, padding inside small badges          |
| `{spacing.md}`      | 16px  | Default gap between groups, padding inside table cells                |
| `{spacing.lg}`      | 24px  | Padding inside compact cards, gutters between cards in 3-up grid      |
| `{spacing.xl}`      | 32px  | Padding inside feature cards, gap between page sections inside a card |
| `{spacing.xxl}`     | 48px  | Gap between major page sections in app surfaces                       |
| `{spacing.section}` | 96px  | Gap between major editorial bands on marketing pages                  |

Tailwind utilities map to the standard 4-unit step (`space-x-2` = 8px, `p-4` = 16px, etc.). The token names exist for spec clarity; in code, the Tailwind utility is what gets written.

## Spacing rules

The rules below cover how the scale gets used in practice. The general principle: smaller values inside surfaces, larger values between surfaces, the largest values between sections of a page.

### Inside cards and forms

- Between two adjacent form fields: `{spacing.sm}` (12px) for compact forms, `{spacing.md}` (16px) for default.
- Between two groups of related fields (a "personal info" group and a "billing info" group): `{spacing.lg}` (24px) or `{spacing.xl}` (32px).
- Between a section heading and the first field below it: `{spacing.md}` (16px).
- Between the last field and the submit button: `{spacing.xl}` (32px).

### Page-level

- Between two sections within a card-bound page (a list view with multiple panels): `{spacing.xl}` (32px) or `{spacing.xxl}` (48px).
- Between two major editorial bands on a marketing or landing page: `{spacing.section}` (96px) above and below each band.
- Between the last section and the footer: `{spacing.section}` (96px).

### Document layouts (proposal, invoice, client portal)

- Between two block types in a proposal (text → scope → deliverables): `{spacing.lg}` (24px) by default, `{spacing.xl}` (32px) when the next block is a heading.
- Between the document title and the first content block: `{spacing.xl}` (32px).
- Between the last content block and the accept/sign band: `{spacing.xxl}` (48px).
- Between the accept/sign band and the footer: `{spacing.xxl}` (48px) to `{spacing.section}` (96px).

## Padding inside common surfaces

The padding values below are the canonical sizes per surface type. Buttons and inputs carry asymmetric padding (vertical < horizontal) so the label sits visually centered without the surface feeling too tall.

| Surface                           | Padding                          | Notes                                                        |
| --------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| `{component.button-primary}` (md) | 12px × 20px                      | Vertical × horizontal. 14px label fits with 1.0 line-height. |
| `{component.button-primary}` (sm) | 8px × 14px                       | Compact size for inline use.                                 |
| `{component.button-primary}` (lg) | 14px × 24px                      | Hero CTA size.                                               |
| `{component.text-input}`          | 10px × 14px                      | 14px label inside fits comfortably.                          |
| `{component.feature-card}`        | `{spacing.xl}` (32px)            | Generous interior.                                           |
| `{component.feature-icon-card}`   | `{spacing.xl}` (32px)            | Same as feature card; the icon eats some space.              |
| `{component.testimonial-card}`    | `{spacing.lg}` (24px)            | Slightly tighter; the quote does the heavy lifting.          |
| `{component.product-mockup-card}` | varies (native to UI inside)     | The card holds product UI; the UI sets its own padding.      |
| `{component.pricing-tier-card}`   | `{spacing.xl}` (32px)            | Inside the gray surface or dark surface (featured tier).     |
| `{component.modal}` body          | `{spacing.xl}` (32px)            | Excludes header/footer rows.                                 |
| `{component.modal}` header        | `{spacing.lg}` (24px)            | Title + close button row.                                    |
| `{component.modal}` footer        | `{spacing.lg}` (24px)            | Action buttons row.                                          |
| `{component.sheet-right}` body    | `{spacing.xl}` (32px)            | Right-hand sliding panel for editor blocks.                  |
| `{component.empty-state-card}`    | `{spacing.xxl}` × `{spacing.xl}` | Vertical larger than horizontal to feel intentional.         |

## Layout widths

Every page in the product picks one of four layout widths. Mixing them on a single page is allowed only when the inner section explicitly uses a narrower column for emphasis.

| Layout                   | Max width                              | Use                                                                  |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------------- |
| Freelancer app content   | 1200px (sidebar 220px + content 980px) | Dashboard, list views, detail views, editors                         |
| Document layout (wide)   | 880px                                  | Public invoice view (table needs the room)                           |
| Document layout (narrow) | 720px                                  | Public proposal view, client portal home, client portal project view |
| Auth pages               | 400px                                  | Login, signup, password reset, magic-link request                    |
| Onboarding step content  | 480px                                  | Each onboarding step is a single focused choice                      |

The freelancer app content is responsive: the 220px sidebar collapses to a 60px icon rail at the `lg` breakpoint and lower (≤1023px), then to a slide-in `{component.sheet-right}` at the `md` breakpoint and lower (≤767px). The document layouts narrow with the viewport but never lose vertical rhythm — the `{spacing.lg}` to `{spacing.xl}` block gaps are preserved.

## The radius scale

Six tokens cover every rounded corner in the product. The scale is intentional: 8/12/16 is the modern-SaaS rhythm. Smaller values read as system-UI; larger values read as consumer-app. Middlemist sits in between.

| Token            | Value        | Use                                           |
| ---------------- | ------------ | --------------------------------------------- |
| `{rounded.xs}`   | 4px          | Badge accents (rare); small inline indicators |
| `{rounded.sm}`   | 6px          | Small inline buttons, dropdown items          |
| `{rounded.md}`   | 8px          | CTA buttons, text inputs, category tabs       |
| `{rounded.lg}`   | 12px         | Content cards (feature, pricing, testimonial) |
| `{rounded.xl}`   | 16px         | Hero mockup card                              |
| `{rounded.pill}` | 9999px       | Nav-pill-group, badge pills                   |
| `{rounded.full}` | 9999px / 50% | Avatars, icon buttons                         |

The maximum corner on a card is `{rounded.xl}` (16px). Going beyond that reads as too soft for the product's tone. The minimum for buttons is `{rounded.md}` (8px); going smaller reads as system-UI.

## Why these radii

Cal.com uses 8/12/16 for buttons, cards, and hero mockups respectively. Linear uses 6/8/12. Vercel uses 6/8. Stripe uses 6/8/12. The 8/12/16 step in Middlemist sits squarely in the modern-SaaS range.

The earlier plan used 7px as the signature radius across all surfaces. That direction is deprecated. A single radius applied to buttons and cards equally either looks too soft on small surfaces (7px on a 32px button) or too sharp on large surfaces (7px on a 320px-wide card). The differentiated scale solves both: 8px on buttons reads as crisp; 12px on cards reads as soft; 16px on hero mockups reads as inviting.

## Padding and radius pairings

The pairings below are the canonical combinations. A new component should pick its padding and radius from the table; it does not invent a new pair.

| Component                              | Padding                      | Radius                                 |
| -------------------------------------- | ---------------------------- | -------------------------------------- |
| `{component.button-primary}` (md)      | 12 × 20                      | `{rounded.md}` (8px)                   |
| `{component.button-secondary}`         | 12 × 20                      | `{rounded.md}` (8px)                   |
| `{component.button-icon-circular}`     | 0 (icon-only, 36×36 surface) | `{rounded.full}`                       |
| `{component.text-input}`               | 10 × 14                      | `{rounded.md}` (8px)                   |
| `{component.checkbox}`                 | 0 (16×16 surface)            | `{rounded.xs}` (4px)                   |
| `{component.feature-card}`             | `{spacing.xl}` (32px)        | `{rounded.lg}` (12px)                  |
| `{component.feature-icon-card}`        | `{spacing.xl}` (32px)        | `{rounded.lg}` (12px)                  |
| `{component.testimonial-card}`         | `{spacing.lg}` (24px)        | `{rounded.lg}` (12px)                  |
| `{component.pricing-tier-card}`        | `{spacing.xl}` (32px)        | `{rounded.lg}` (12px)                  |
| `{component.product-mockup-card}`      | (native)                     | `{rounded.xl}` (16px)                  |
| `{component.hero-app-mockup-card}`     | (native)                     | `{rounded.xl}` (16px)                  |
| `{component.modal}`                    | `{spacing.xl}` (32px) body   | `{rounded.lg}` (12px)                  |
| `{component.sheet-right}`              | `{spacing.xl}` (32px)        | `{rounded.lg}` (12px) — left edge only |
| `{component.toast}`                    | 12 × 16                      | `{rounded.md}` (8px)                   |
| `{component.tooltip}`                  | 6 × 10                       | `{rounded.sm}` (6px)                   |
| `{component.avatar-circle}`            | 0 (36×36 surface)            | `{rounded.full}`                       |
| `{component.badge-pill}`               | 4 × 10                       | `{rounded.pill}`                       |
| `{component.status-pill}`              | 4 × 10                       | `{rounded.pill}`                       |
| `{component.nav-pill-group}` container | 4 (track inset)              | `{rounded.pill}`                       |
| `{component.category-tab}`             | 8 × 16                       | `{rounded.pill}` (inherits from group) |

When in doubt about a new component, pick the padding-radius pair from the closest existing component. Cards are 32px padding with 12px radius; small interactive surfaces are 12 × 20 with 8px radius; pills are tightly padded with full radius. Those three patterns cover the vast majority of new components.
