# Icons and illustration

Middlemist uses one icon family and no marketing illustration system. Icons are functional, small, and consistently weighted. Where a marketing surface would normally use illustration, the product instead shows real product UI fragments inside a `{component.product-mockup-card}`. The result reads as "show, do not illustrate."

This doc fixes the icon family, the rendering rules, the illustration approach, the wordmark and logo, and the favicon and Open Graph image.

## Icons

The icon family is **Lucide React**. It is already in the stack and has the right visual character: lightly stroked, geometric, broad coverage.

### Stroke and size

Lucide icons render at three standard sizes:

| Size | Use |
|---|---|
| 16px | Inline with `{typography.body-sm}` (button labels, small buttons, table cell adornments) |
| 20px | Inline with `{typography.body-md}` (default UI icons, sidebar items, dropdown rows) |
| 24px | Larger UI accents (feature icon card titles, modal headers) |

Stroke width is **1.5** at all sizes. The default Lucide stroke is 2; lowering it to 1.5 reads as more refined and matches Cal.com's character. Set the stroke globally:

```tsx
import { Icon as LucideIcon } from "lucide-react";

<LucideIcon name="search" size={20} strokeWidth={1.5} />
```

Or apply via CSS:

```css
.lucide {
  stroke-width: 1.5;
}
```

### Color

Icons inherit text color by default. A 16px Lucide icon next to body text picks up `{colors.body}`. A 20px Lucide icon in a sidebar item picks up `{colors.body}` (default) or `{colors.ink}` (active).

The exception: a few icons act as semantic accents and get a fixed color regardless of context. A check-circle icon in a `{component.proposal-block-scope}` bullet uses `{colors.success}` `#10b981`. A warning triangle in an alert uses `{colors.warning}`. An x-circle in a `{component.text-input-error}` uses `{colors.error}`. These are the exceptions, not the rule.

### Decorative versus functional

A decorative icon (one that adds visual weight to a feature card title) is paired with text — the text carries the meaning, the icon is supplementary. A functional icon (one that is the entire button label, like a kebab menu or a close-X) requires an `aria-label` for screen readers. The component implementations encode this: `{component.button-icon-circular}` always takes an `aria-label` prop.

### Forbidden

- **Emoji as icons.** Never. Emoji rendering varies wildly by platform; the visual identity becomes inconsistent across operating systems. Lucide is the only icon family in the product.
- **Mixed icon families.** Do not import from Heroicons, Phosphor, or Feather alongside Lucide. The visual character drifts even when sizes and strokes match.
- **Icon-only navigation without labels at desktop.** The sidebar shows labels at `lg` breakpoint. Below `lg`, labels collapse but tooltips appear on focus.
- **Decorative icons on every paragraph.** Restraint matters. Most paragraphs do not need an icon next to them.

## Illustration approach

Cal.com solves the marketing-illustration problem by skipping illustrations and showing product UI inside cards instead. Middlemist follows the same approach.

The mechanism is the `{component.product-mockup-card}`: a white card with a hairline border, rounded at `{rounded.xl}` (16px), holding a smaller-scale rendering of actual product UI. Examples:

- A landing-page hero shows a `{component.hero-app-mockup-card}` containing a miniature dashboard with the sidebar, top nav, and a "Today" panel visible.
- A "proposals" feature section shows a `{component.product-mockup-card}` containing a miniature `{component.proposal-block-pricing}` with three line items and a total — at smaller scale, but rendered with the real component, not an illustration of one.
- An "invoices" feature section shows a `{component.product-mockup-card}` containing a small `{component.invoice-line-item-row}` table with a `{component.invoice-totals-stack}`.
- A "client portal" feature section shows a `{component.product-mockup-card}` with a stack of `{component.client-portal-update-card}` items.

The reason this works: showing the actual product is more credible than illustrating a fantasy version of it. When the screenshot looks polished, the product reads as polished. When the illustration looks polished, the reader has no idea whether the product matches.

### What is not used

- **unDraw, isometric character illustrations, doodle-style illustrations.** The marketing surface does not use any of them. They read as decorative and they age quickly.
- **Stock photography.** No.
- **Custom illustrations of the product features.** No. The product UI is the illustration.
- **The botanical / camellia motif.** Earlier plans referenced a camellia (the "middlemist" botanical) as a brand motif. That direction is deprecated. The wordmark and the small circle mark are the brand visual; nothing else.
- **Decorative hero backgrounds (gradients, blobs, abstract shapes).** No. The hero band is a flat white surface with text on the left and a `{component.hero-app-mockup-card}` on the right.

## Wordmark and logo

The wordmark is the primary brand visual. It reads "middlemist" lowercase, set in Inter Display 600, with optical kerning. To the left of the wordmark sits a small filled circle ("the dot") that acts as the brandmark.

Specifications:

- **Wordmark text:** "middlemist" all lowercase. Inter Display 600. Letter-spacing -0.5px at the rendered size for visual tightness.
- **Default size:** 18-22px (top nav uses 18px; landing hero uses 22px or larger).
- **Color on light surfaces:** `{colors.primary}` `#111111`.
- **Color on dark surfaces (footer):** `{colors.on-dark}` `#ffffff`.
- **Circle mark:** a filled circle 60% of the wordmark's cap height, sitting at the baseline. On light surfaces, the circle is `{colors.primary}`. On dark surfaces, the circle is `{colors.on-dark}`.
- **Spacing between circle and wordmark:** 0.4× cap height.

The wordmark is rendered as text in HTML, not as an SVG asset, so it scales freely and inherits color via CSS. The circle is a simple `<span>` with rounded corners.

```tsx
<a href="/" className="inline-flex items-center gap-2 font-display text-[18px] font-semibold text-ink">
  <span className="size-3 rounded-full bg-current" />
  middlemist
</a>
```

The same component on a dark surface inherits white through `text-on-dark`:

```tsx
<a href="/" className="inline-flex items-center gap-2 font-display text-[18px] font-semibold text-on-dark">
  <span className="size-3 rounded-full bg-current" />
  middlemist
</a>
```

A more elaborate logo design (perhaps with the camellia motif refined into a glyph) is a v2 conversation. The wordmark is sufficient for v1.

## Favicon

The favicon is the circle mark alone, no wordmark.

- **Format:** ICO (32 × 32) for legacy browsers, SVG for modern. Apple touch icon at 180 × 180 PNG.
- **Color:** `{colors.primary}` `#111111` filled circle on `{colors.canvas}` `#ffffff` background.
- **File location:** `public/favicon.ico`, `public/icon.svg`, `public/apple-touch-icon.png`.

A future revision may render the favicon as a more detailed glyph; the simple circle is sufficient at the small sizes a favicon is rendered at.

## Open Graph image

The OG image is what social platforms (Twitter, LinkedIn, Slack previews) show when a Middlemist URL is shared.

- **Dimensions:** 1200 × 630.
- **Background:** `{colors.canvas}` `#ffffff`.
- **Left side (60% width):** wordmark large at top, tagline below in Inter Display 600 at `{typography.display-md}` (36px). Tagline reads: "A freelance operations tool for solo developers."
- **Right side (40% width):** a small `{component.product-mockup-card}` containing a miniature proposal preview. The card uses `{rounded.xl}` (16px) and a soft drop shadow.
- **No dark surfaces, no gradients, no abstract shapes.** The OG image is the wordmark, the tagline, and a product preview.

The OG image is generated dynamically at build time using `@vercel/og` (Next.js's edge-rendered OG generator) so it stays in sync with the wordmark/tagline if those ever change. The font references in the OG generator use the same Inter Display variable file the rest of the product uses.

## When you are tempted

When a screen feels like it needs an illustration, do not draw one. Look at the screen. If the issue is empty space, the screen probably needs better content (a useful empty state) or it needs less space (tighter padding, smaller container). If the issue is "this looks plain," the screen probably needs a `{component.product-mockup-card}` showing a relevant fragment of the product. The product is the visual. Illustrations are not.

When an icon feels like it needs custom art, do not draw it. Lucide has nearly two thousand icons. The right one almost certainly exists. If the right one truly does not exist (a specific freelance-domain concept like "retainer billing"), pair two existing icons or substitute a text label. Custom icon work is a v2 conversation.
