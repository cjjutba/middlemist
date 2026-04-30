# Design system overview

Middlemist's visual system is adapted from Cal.com. It is a clean modern-SaaS interface, not a decorated editorial document. White canvas, near-black primary actions, Inter Display + Inter type pair, light-gray feature cards, and a single dark footer that closes every page. The product reads as confidently engineered. It does not try to impress through ornament.

This page is the entry point to the design system. It states the direction, explains why, fixes three operating principles, names the visual identity, sets the rule for resolving design questions, and points to the rest of the docs.

## Direction

The system favors generous whitespace, single primary action per band, hairline borders over heavy shadows, and monochrome at the action layer. Typography splits into two voices: Inter Display for display, Inter for everything else. The blue accent is a guest, not a host. Pastels are reserved for avatars and tag pills; they never colonize buttons or headings. The dark surface is rare on purpose: footers, the featured pricing tier (post-v1), toasts, and tooltips are the only places it appears.

The locked tokens for color, type, spacing, and radius live in the supporting docs. They are referenced by name throughout the codebase. Inline hex, off-spec radii, and ad-hoc font weights are not allowed. When in doubt about an emphasis decision, choose bigger Inter Display before bolder.

## Why this direction

The project ships with shadcn/ui as the component library. shadcn defaults sit close to the modern-SaaS visual language — Cal.com is a sibling project in that sense, not a distant style. Adopting Cal.com-aligned tokens means the build leans with the framework instead of fighting it. That pays off as speed during construction and consistency across surfaces once shipped. It also means the visual language is familiar to the people who will read this case study: developers, design-aware founders, and recruiters who know Cal, Linear, Vercel, and Stripe at a glance.

The earlier visual direction (deep moss accent, 7px corners, Source Serif 4 in document views, botanical motifs) is deprecated. It read as decorated; it would have required custom illustration that distracted from the modules. The Cal.com-aligned system is a better match for a portfolio piece built by one developer over a fixed timeline because it lets the modules carry the product identity. The signature detail of Middlemist is not the wrapper — it is the proposal-block-pricing card, the invoice line-item row, the project hub with its tabs, and the client portal that closes with a dark footer. Those are the differentiators. The frame around them is restrained on purpose.

## Three design principles

These three principles are how Middlemist resolves design questions when the answer is not obvious. They sit above the rest of the design docs.

### 1. White canvas with light-gray cards is the default rhythm. The dark footer closes every page.

Every page on the marketing surface, every page in the freelancer app, every public document, and every client portal page follows the same surface pacing: white background, occasional light-gray content cards, a dark footer at the bottom. Surface modes never repeat in two consecutive bands without reason. Dark is reserved for the footer and a small set of components (toasts, tooltips, the featured pricing tier when it lands in v2). This rhythm is what gives the product its consistent visual identity without requiring decorative work.

### 2. Type voice splits cleanly: Inter Display for display, Inter for everything else.

There are two type voices in the product and the boundary is strict. Inter Display 600 with negative letter-spacing carries display sizes — h1, h2, large card titles, plan prices, hero headlines. Inter (regular weight 400, with 500 and 600 for emphasis) carries everything else — body copy, UI labels, table cells, captions, button labels, navigation. Source Serif 4 is not loaded. Editorial body in document views is Inter, not a serif. The boundary does not blur because each voice does a different job: Inter Display draws the eye to a page's anchor; Inter does the reading and the work.

### 3. Monochrome at the action layer.

The primary button, the headline, and the active state of a navigation item all share the same color: `{colors.primary}` `#111111`. The primary CTA is never blue, never accent-colored, never gradient-filled. The accent blue exists, but it lives quietly in inline body links and the rare badge highlight ("New," "Customer story"). Pastels exist, but they live in avatar fills and tag pills. The action layer reads in a single value scale. This is the most common mistake to avoid when adapting shadcn defaults: the default theme picks indigo or violet for primary; replace it with `#111111` immediately and never look back.

## Visual identity

In one paragraph: Middlemist looks like a confident, modestly designed SaaS tool built by someone who cares about typography and whitespace. The first thing a visitor sees is type — a bold Inter Display headline against generous white space — and then a product mockup card showing real product UI rather than a marketing illustration. Sections alternate between white and light-gray. Buttons are small, near-black, and rounded at 8 pixels. Status pills carry semantic colors but never fill an entire surface. The page closes with a dark footer that is the only dark band on the page. There are no gradients, no glass effects, no abstract blobs. The product is the aesthetic.

## How design decisions get made

When a design question comes up during the build, prefer the answer that reads as clean modern-SaaS over the answer that reads as decorated or experimental. When two answers both read as clean modern-SaaS, pick the one that uses fewer visual elements: fewer borders, fewer fills, fewer fonts, fewer sizes. When emphasis is needed, increase the Inter Display size before reaching for color or weight. When color is needed, prefer a `{component.status-pill}` (semantic-colored, paired with text) over a colored background on a larger surface. When in doubt about a choice, look at how Cal.com solves the same surface, then make the Middlemist version specific to the freelance-ops domain.

The anti-patterns doc is the discipline mechanism for the inverse case: the moves that make a product look AI-generated, decorated, or off-brand. Read it during code review. The most common drift is back toward shadcn defaults (slate palette, indigo primary, default Geist) or toward AI marketing copy ("seamless," "powerful," "transform"). Both are caught by the anti-patterns doc.

## What this doc set covers

This wave produces twelve design documents. Together they describe Middlemist's tokens, components, layout patterns, public-facing views, references, and anti-patterns at the level of detail needed to build the product without re-deciding visual questions every session.

The docs are referenced in code by token name. A button in the codebase reads `{component.button-primary}`, not "the primary button"; a card reads `{component.feature-icon-card}`, not "the white card with a hairline border." Token discipline is what makes the design system load into Claude Code context cleanly: the tokens are the shared vocabulary.

## What is deferred

Three things are deliberately out of scope for this wave:

- **Brand logo design beyond the wordmark.** The wordmark is "middlemist" set in Inter Display 600 lowercase with a small circle mark. A more elaborate brandmark may come in v2, but it is not required for v1 launch.
- **Marketing illustration system beyond the product-mockup-card pattern.** Middlemist will not build a custom illustration library. The cards-with-product-UI-fragments approach replaces the illustration job for v1.
- **Full Figma kit.** The token system is the source of truth, and shadcn provides the implementation primitives. A separate Figma kit is nice-to-have for v2 but does not block any build week.

## Pointer table

| Topic | File |
|---|---|
| Type scale, font loading, pairing | `typography.md` |
| Color tokens, semantic layer, contrast | `color.md` |
| Spacing scale, radius scale, layout widths | `spacing-and-radius.md` |
| Motion durations, easing, reduced motion | `motion.md` |
| App Shell, Document Shell, page layouts | `layout-patterns.md` |
| Component tokens and specs | `component-patterns.md` |
| Lucide icons, product-mockup illustration | `icons-and-illustration.md` |
| Empty, loading, error states | `empty-and-loading-states.md` |
| Public proposal, invoice, client portal | `public-views.md` |
| External design references | `references.md` |
| What not to do | `anti-patterns.md` |

When a question crosses several files (for example, "how should the public invoice header look"), start from the layout pattern, then the component pattern, then the public-views doc for module-specific guidance. The anti-patterns doc is read last as a check.
