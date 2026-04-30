# Typography

Typography in Middlemist is the load-bearing element of the visual identity. Color is restrained, illustration is restrained, motion is restrained. Type carries the personality. The system is two voices, one display and one text, with strict rules about which voice does which job. Get the type right and the rest of the surface looks correct without effort. Get it wrong and no amount of layout polish will recover it.

This doc is the canonical type scale, the loading strategy, the pairing rules across surfaces, and the discipline notes that prevent the most common drift.

## The type scale

The scale is locked. Twelve tokens cover every surface in the product. Sizes use pixel values; line heights are unitless multipliers; letter-spacing is in pixels because the negative tracking on display sizes is the signature detail.

| Token | Size | Weight | Line height | Letter-spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 64px | 600 | 1.05 | -2px | Marketing h1 |
| `{typography.display-lg}` | 48px | 600 | 1.1 | -1.5px | Section heads |
| `{typography.display-md}` | 36px | 600 | 1.15 | -1px | Sub-section heads, card titles |
| `{typography.display-sm}` | 28px | 600 | 1.2 | -0.5px | CTA-band heads, plan prices |
| `{typography.title-lg}` | 22px | 600 | 1.3 | -0.3px | Plan names, page titles |
| `{typography.title-md}` | 18px | 600 | 1.4 | 0 | Feature card titles |
| `{typography.title-sm}` | 16px | 600 | 1.4 | 0 | Small card titles, list labels |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | Default running text |
| `{typography.body-sm}` | 14px | 400 | 1.5 | 0 | Footer body, fine-print |
| `{typography.caption}` | 13px | 500 | 1.4 | 0 | Badge labels, captions |
| `{typography.code}` | 14px | 400 | 1.5 | 0 | Code, invoice numbers, IDs |
| `{typography.button}` | 14px | 600 | 1.0 | 0 | Standard button labels |
| `{typography.nav-link}` | 14px | 500 | 1.4 | 0 | Top-nav menu items |

Display tokens use Inter Display at weight 600. Title, body, caption, button, and nav-link tokens use Inter. Code uses JetBrains Mono. The boundaries between voices are non-negotiable: a body paragraph is never set in Inter Display, a display heading is never set in plain Inter without negative letter-spacing.

## Font loading

Fonts load via `next/font/google` so they are self-hosted at build time, served from the same origin, and free of external CSS requests. Three families load:

- **Inter Display** — weights 400, 500, 600, 700. Used at weight 600 for display tokens. Weights 400/500/700 load for completeness even though 600 is the only one currently referenced. This avoids a future migration when a new use surfaces.
- **Inter** — weights 400, 500, 600. The default sans family. Weight 400 is body; 500 is caption and nav-link; 600 is title, button, and emphasis.
- **JetBrains Mono** — weights 400, 500. The mono family. Weight 400 is the default; 500 is reserved for emphasis in code blocks (rare).

Source Serif 4 is **not** loaded. Earlier plans referenced it for editorial body in document views; that direction is deprecated. Public proposal and invoice views use Inter for body.

The fonts are exposed to Tailwind via CSS variables set on the root element. The Tailwind config maps `font-display`, `font-sans`, and `font-mono` to those variables.

```typescript
// src/app/layout.tsx
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const interDisplay = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interDisplay.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

Note: `Inter_Tight` is the closest available `next/font/google` family for "Inter Display" given that the actual Cal Sans face is licensed and Inter Display is delivered as the Tight cut on Google Fonts. The negative letter-spacing applied per-size approximates the Cal Sans look. If the production version of Inter Display becomes available in `next/font/google` under a different name, swap the import — no other code changes.

## CSS variables and Tailwind config

```css
/* src/styles/tokens.css (excerpt) */
:root {
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}
```

```typescript
// tailwind.config.ts (excerpt)
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["64px", { lineHeight: "1.05", letterSpacing: "-2px", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-1.5px", fontWeight: "600" }],
        "display-md": ["36px", { lineHeight: "1.15", letterSpacing: "-1px", fontWeight: "600" }],
        "display-sm": ["28px", { lineHeight: "1.2", letterSpacing: "-0.5px", fontWeight: "600" }],
        "title-lg": ["22px", { lineHeight: "1.3", letterSpacing: "-0.3px", fontWeight: "600" }],
        "title-md": ["18px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
        "title-sm": ["16px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "caption": ["13px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
        "code": ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "button": ["14px", { lineHeight: "1.0", letterSpacing: "0", fontWeight: "600" }],
        "nav-link": ["14px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
      },
    },
  },
};

export default config;
```

A display headline in JSX therefore reads:

```tsx
<h1 className="font-display text-display-lg text-ink">Stop chasing freelance work across six tools.</h1>
```

The class `font-display` selects the Inter Display family; `text-display-lg` carries the size, line-height, letter-spacing, and weight together.

## Pairing rules across surfaces

Three surfaces pair fonts differently. The rules below are exhaustive; nothing else is allowed.

**Freelancer dashboard (the authenticated app).** Body and UI text in Inter. Page titles (h1) and large card titles in Inter Display at the appropriate display size. Status pills, captions, and table headers in Inter. Numeric columns (invoice amounts, time entries, totals) use the `tabular-nums` feature so digits align.

**Public proposal view (`/p/[token]`) and public invoice view (`/i/[token]`).** Document title (h1) in Inter Display at `{typography.display-lg}`. Section heads in Inter Display at `{typography.display-md}`. Body, terms, line-item table cells, and notes all in Inter. Source Serif is not used. The contrast between Inter Display and Inter still produces editorial gravitas without a serif: a 48px Inter Display heading paired with 16px Inter body reads as a designed document.

**Email templates.** Inter only, falling back to a system sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) for clients that strip web fonts. Email clients vary widely in font support; using a single family with sane fallbacks is more reliable than attempting to render Inter Display in a transactional message. Headings within emails use Inter at weight 600; body uses Inter at 400.

**Marketing surface (cjjutba.com case study, future Middlemist marketing pages).** Same as the freelancer dashboard rules: Inter Display for display, Inter for body. The hero h1 is `{typography.display-xl}` (64px). Below the hero, section heads step down to `{typography.display-lg}` (48px) and `{typography.display-md}` (36px) per visual hierarchy.

## Hierarchy rules

A few rules govern how multiple sizes coexist on a page:

- **Maximum four type sizes per screen.** A page that uses display-lg + display-md + body-md + caption is well-organized. A page that adds title-lg + title-md is starting to muddle. If a screen needs more sizes, it usually needs better information architecture, not more type tokens.
- **Never bold and italic simultaneously.** Italic is reserved for inline emphasis (rare) and book titles. If a phrase needs both, it does not need both — pick one.
- **Underline is for inline links only.** Section headings are not underlined. Buttons are not underlined. Tabs are not underlined except for the `{component.tab-underline}` pattern, which is a specific component and not a general typographic move.
- **All caps with letter-spacing is for `{typography.caption}` only**, and only on tags, table headers, and section dividers in the sidebar. Never on body, headings, or buttons.
- **Numbers in tables use `font-feature-settings: 'tnum'`** so columns align. The `tabular-nums` Tailwind utility sets this.

## Discipline notes

Five rules that catch the most common drift.

**Cal Sans substitute.** The actual Cal Sans face is licensed and not redistributable. Inter Display at weight 600 with the negative letter-spacing values in the scale above is the substitute. Without the negative tracking it reads as off-brand: the headline looks generic. The negative tracking is what makes it feel intentional. Always set letter-spacing for display sizes; never leave it at zero.

**Display weight stays 600.** Never 700, never 500. The scale is calibrated to weight 600. A 700 Inter Display headline reads as too heavy for the surrounding light surfaces. A 500 reads as too thin and loses the anchor. Keep it at 600.

**Body in Inter Display is forbidden.** No exceptions. The Inter Display tracking is too tight for reading more than a few words. A paragraph set in Inter Display at 16px is uncomfortable; a paragraph set in Inter at 16px is correct. If a section feels like it wants Inter Display body, it usually wants a `{component.feature-card}` with an Inter Display title and Inter body — the title carries the display voice, the body does the reading.

**Display headline in plain Inter is forbidden.** Equally damaging. A 48px h1 set in Inter regular looks generic and fails to anchor the page. The page needs a display voice. Use Inter Display 600 with negative tracking, or step the size down to a `{typography.title-lg}` and use it as a smaller title.

**Numbers in tables use tabular figures.** A line-item table where the rightmost digits do not align reads as careless. Apply `tabular-nums` to any column of numbers — invoice amounts, time entries, totals, counts. The `{component.invoice-line-item-row}` and `{component.invoice-totals-stack}` components do this by default.
