# 0007: Visual System Adapted from Cal.com

**Date:** 2026-04-30
**Status:** Accepted (supersedes the initial moss / 7px / Source Serif direction described informally during early Wave 1 drafts)

## Context

The earliest Wave 1 design direction proposed an editorial, document-feeling visual identity: a deep moss accent (`#5A7A4F`), a 7px signature corner radius applied to every card and input, Source Serif 4 for body copy in public document views (proposals, invoices, the client portal), Inter Display + Inter for app chrome, and a botanical motif (the camellia) carrying the brand mark. The thinking was that Middlemist's client-facing surfaces should read as printed correspondence rather than as another SaaS product.

That direction was revised before any production code shipped. Two pressures forced the change. First, the build is being shipped solo over a fixed timeline; the editorial direction would have required custom illustration work (the camellia mark, decorative detailing on document views, hand-tuned serif/sans pairings) that would have stolen weeks from feature work. Second, the case-study audience for cjjutba.com is developers, design-aware founders, and recruiters; that audience reads Cal, Linear, Vercel, and Stripe-style visual languages instantly. Adopting a Cal.com-aligned system means the visual frame disappears and the modules carry the identity — the proposal-block-pricing card, the invoice line-item row, the project hub, the client portal — which are what the case study actually demonstrates.

The decision was also consistent with the chosen component library. shadcn/ui defaults sit close to the modern-SaaS visual language; Cal.com is a sibling project in that sense. Adopting Cal.com-aligned tokens lets the build lean with the framework instead of fighting it.

## Decision

The visual system is adapted from Cal.com:

- **Color.** Primary `#111111` (near-black) for CTAs, h1/h2 display, active nav. Brand accent `#3b82f6` used sparingly on inline links. Surfaces alternate canvas `#ffffff`, surface-soft `#f8f9fa`, surface-card `#f5f5f5`, with surface-dark `#101010` reserved for the footer, the (post-v1) featured pricing tier, toasts, and tooltips. Pastels (`#fb923c`, `#ec4899`, `#8b5cf6`, `#34d399`) are reserved for avatar fills and tag pills only.
- **Typography.** Inter Display (weight 600, negative letter-spacing -0.5 to -2px) for display sizes; Inter (400/500/600) for everything else. Inter Display substitutes for Cal Sans, which is licensed and unavailable. JetBrains Mono for code, IDs, and invoice numbers. Source Serif 4 is not loaded.
- **Radius scale.** 4 / 6 / 8 / 12 / 16 / pill / full. Buttons and inputs use 8px; content cards use 12px; the hero mockup card uses 16px; avatars and badge pills are fully rounded. The 7px signature radius is dropped.
- **Spacing.** 4px base unit. 96px section padding between editorial bands. 32px card internal padding (24px for testimonial and product-mockup cards).
- **Surface pacing.** Alternate white → light-gray → white → product-mockup → white → dark-footer. Never repeat the same surface mode in two consecutive bands. The dark surface is rare on purpose.
- **Elevation.** Flat by default. Hairline borders on inputs and some cards. Subtle drop shadows only when needed; never heavy shadows, neumorphism, or glassmorphism.

The Wave 1 design folder (`docs/design/overview.md`, `color.md`, `typography.md`) reflects these tokens. Subsequent waves expand into spacing, layout, components, public-views, and an anti-patterns doc.

## Consequences

**Positive.**

- The visual frame is familiar to the case-study audience; the modules carry the identity, which matches the principle that the project (and the documents it produces) is the central object.
- shadcn/ui defaults align closely with the chosen tokens. The build leans with the framework instead of fighting it, which is solo-developer velocity.
- Token discipline (referencing `{colors.primary}`, `{rounded.lg}`, `{typography.display-md}` in code) is straightforward to enforce because the tokens are few and the boundaries are sharp.
- Public document views remain readable without a serif: the contrast between Inter Display headings and Inter body produces editorial gravitas at typographic scale, with no font-loading cost beyond the two faces already in the app chrome.

**Negative.**

- The visual identity is less distinctive in a market that already includes Cal.com (and Linear, Vercel, Stripe). A discerning eye will recognize the lineage. The mitigation is that the Middlemist product surface is different (freelance ops, not scheduling), and the differentiation lives in the modules rather than in the chrome.
- The botanical / editorial / signature-color identity is lost. Some of the early personality of the brief is gone. This is the trade for shipping speed and frame familiarity.
- Future visual differentiation has to come from the product surfaces themselves (the proposal block, the invoice document, the client portal home) rather than from the app chrome. That is harder than picking a distinctive accent color and adding a botanical mark, and it is the right kind of harder.

## Alternatives Considered

**Original editorial direction (moss / 7px / Source Serif / camellia mark).** Rejected for the reasons above: too much custom illustration work for a solo build, less familiar visual frame for the case-study audience, less aligned with shadcn defaults.

**Linear-aligned monochrome with a stronger accent.** Considered. Linear's surfaces are excellent and the type discipline is similar. Rejected because Linear's signature look depends on dense tabular UIs that do not fit the proposal/invoice/portal surfaces, which need to feel document-like even without a serif.

**shadcn/ui defaults unchanged.** Considered as the laziest possible path. Rejected because the default theme picks indigo or violet for primary; replacing it with `#111111` is the single most important customization to make the product not read as "another shadcn shell."
