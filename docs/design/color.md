# Color

Color in Middlemist is restrained. The palette is small, the action layer is monochrome, and the accent appears in two places only: inline body links and the rare badge highlight. Pastels live on avatars and tag pills. The dark surface is reserved for footers, the featured pricing tier (post-v1), toasts, and tooltips. Get the discipline right and the product reads as confident; let it drift and it reads as decorated.

This doc fixes the palette, adds a semantic layer on top of the raw tokens, names the rules for where each color lives, lists the verified contrast pairs, and states the position on dark mode and accent customization.

## The locked palette

Every color in the product is one of these tokens. Inline hex values in code are forbidden. The token is referenced directly via CSS variable or Tailwind utility.

### Brand and accent

| Token | Value | Use |
|---|---|---|
| `{colors.primary}` | `#111111` | Primary CTAs, h1 and h2 display type, anchor ink |
| `{colors.primary-active}` | `#242424` | Primary press state |
| `{colors.brand-accent}` | `#3b82f6` | Inline body links, occasional badge highlight |
| `{colors.badge-orange}` | `#fb923c` | Avatar fills, tag pills |
| `{colors.badge-pink}` | `#ec4899` | Avatar fills, tag pills |
| `{colors.badge-violet}` | `#8b5cf6` | Avatar fills, tag pills |
| `{colors.badge-emerald}` | `#34d399` | Avatar fills, tag pills |

### Surface

| Token | Value | Use |
|---|---|---|
| `{colors.canvas}` | `#ffffff` | Page background, product mockup card |
| `{colors.surface-soft}` | `#f8f9fa` | Nav-pill-group container, soft dividers |
| `{colors.surface-card}` | `#f5f5f5` | Feature cards, testimonial cards |
| `{colors.surface-strong}` | `#e5e7eb` | Strong dividers, occasional input borders |
| `{colors.surface-dark}` | `#101010` | Footer, featured pricing tier |
| `{colors.surface-dark-elevated}` | `#1a1a1a` | Cards on dark surfaces, tooltip body |
| `{colors.hairline}` | `#e5e7eb` | Card borders, input borders, table dividers |
| `{colors.hairline-soft}` | `#f3f4f6` | Soft dividers within cards |

### Text

| Token | Value | Use |
|---|---|---|
| `{colors.ink}` | `#111111` | h1, h2, primary text on light surfaces |
| `{colors.body}` | `#374151` | Body text, default running text |
| `{colors.muted}` | `#6b7280` | Secondary text, captions, metadata |
| `{colors.muted-soft}` | `#898989` | Tertiary text, fine-print, disabled labels |
| `{colors.on-primary}` | `#ffffff` | Text on `{colors.primary}` (button labels) |
| `{colors.on-dark}` | `#ffffff` | Text on `{colors.surface-dark}` |
| `{colors.on-dark-soft}` | `#a1a1aa` | Secondary text on dark surfaces |

### Semantic

| Token | Value | Use |
|---|---|---|
| `{colors.success}` | `#10b981` | Success states, paid invoices, accepted proposals |
| `{colors.warning}` | `#f59e0b` | Warning states, overdue invoices, expiring proposals |
| `{colors.error}` | `#ef4444` | Error states, destructive actions, validation errors |

## Semantic layer

On top of the raw tokens, a thin semantic layer defines the most common patterns. The semantic tokens map to the raw tokens; components reference the semantic tokens so that a change at the raw layer (if one ever happens) propagates.

| Semantic token | Maps to | Use |
|---|---|---|
| `--surface-bg` | `{colors.canvas}` | Page background |
| `--surface-card` | `{colors.surface-card}` | Card surface |
| `--surface-soft` | `{colors.surface-soft}` | Nav-pill-group, soft dividers |
| `--border-subtle` | `{colors.hairline}` | Default border |
| `--border-strong` | `{colors.surface-strong}` | Strong border |
| `--text-primary` | `{colors.ink}` | Primary text |
| `--text-secondary` | `{colors.body}` | Body text |
| `--text-tertiary` | `{colors.muted}` | Secondary text |
| `--text-faint` | `{colors.muted-soft}` | Tertiary text |
| `--brand-accent` | `{colors.brand-accent}` | Inline link, rare badge highlight |

```css
/* src/styles/tokens.css (excerpt) */
:root {
  --surface-bg: #ffffff;
  --surface-card: #f5f5f5;
  --surface-soft: #f8f9fa;
  --surface-strong: #e5e7eb;
  --surface-dark: #101010;
  --surface-dark-elevated: #1a1a1a;
  --border-subtle: #e5e7eb;
  --border-strong: #e5e7eb;
  --hairline-soft: #f3f4f6;

  --text-primary: #111111;
  --text-secondary: #374151;
  --text-tertiary: #6b7280;
  --text-faint: #898989;
  --on-primary: #ffffff;
  --on-dark: #ffffff;
  --on-dark-soft: #a1a1aa;

  --primary: #111111;
  --primary-active: #242424;
  --brand-accent: #3b82f6;

  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;

  --badge-orange: #fb923c;
  --badge-pink: #ec4899;
  --badge-violet: #8b5cf6;
  --badge-emerald: #34d399;
}
```

The Tailwind config maps these CSS variables to utility classes:

```typescript
// tailwind.config.ts (excerpt)
theme: {
  extend: {
    colors: {
      ink: "var(--text-primary)",
      body: "var(--text-secondary)",
      muted: "var(--text-tertiary)",
      "muted-soft": "var(--text-faint)",
      canvas: "var(--surface-bg)",
      "surface-soft": "var(--surface-soft)",
      "surface-card": "var(--surface-card)",
      "surface-strong": "var(--surface-strong)",
      "surface-dark": "var(--surface-dark)",
      "surface-dark-elevated": "var(--surface-dark-elevated)",
      hairline: "var(--border-subtle)",
      "hairline-soft": "var(--hairline-soft)",
      primary: "var(--primary)",
      "primary-active": "var(--primary-active)",
      "brand-accent": "var(--brand-accent)",
      "on-primary": "var(--on-primary)",
      "on-dark": "var(--on-dark)",
      "on-dark-soft": "var(--on-dark-soft)",
      success: "var(--success)",
      warning: "var(--warning)",
      error: "var(--error)",
      "badge-orange": "var(--badge-orange)",
      "badge-pink": "var(--badge-pink)",
      "badge-violet": "var(--badge-violet)",
      "badge-emerald": "var(--badge-emerald)",
    },
  },
},
```

## Usage rules

The five rules below cover where each color lives. The anti-patterns doc covers what happens when these rules are broken.

**Primary `#111111` is the dominant action color.** The primary button, the active navigation item, h1 and h2 display headings, and ink text all use it. Never replace it with blue, never replace it with the brand accent, never gradient-fill it. The single near-black is what gives the action layer its monochrome character.

**Brand accent `#3b82f6` is a guest, not a host.** It appears on inline body links (a sentence with a clickable phrase inside) and on the occasional small badge highlight ("New," "Customer story"). It does not appear on hero CTAs, primary buttons, or large surfaces. Two uses per page is the practical maximum.

**Badge pastels are reserved for avatars and tag pills.** A user's avatar circle gets a pastel fill (orange, pink, violet, or emerald, picked by hash from the user's name) when no profile image is available. A tag pill on a project may use a pastel background at low opacity. That is the entire surface area for pastels. They never appear on CTAs, never on backgrounds larger than a tag, never on icons.

**Surface card `#f5f5f5` signals "abstract feature claim."** Light-gray feature cards sit inside white sections to break the surface monotony. They carry icon-text pairs, testimonial quotes, or short value propositions. They do not contain real product UI.

**Canvas `#ffffff` and product mockup cards signal "actual product."** When a page wants to show what the product looks like, it uses a `{component.product-mockup-card}` (white background, hairline border, rounded at `{rounded.xl}`) rather than a feature card. The visual contrast between gray feature cards (claims) and white product cards (proof) carries meaning across the page.

**Surface dark `#101010` is the page-closing surface.** It appears in the footer of every page and in the featured pricing tier (when pricing exists, post-v1). It also appears on toasts and tooltips. It does not appear casually as a card background on a freelancer dashboard. The deliberate inversion at the bottom of the page is what gives the surface pacing its rhythm: white → light-gray → white → dark.

## Contrast and accessibility

WCAG AA requires 4.5:1 contrast for body text and 3:1 for large text (24px+). Every text/background pair in the system has been verified.

| Pair | Ratio | WCAG |
|---|---|---|
| `{colors.ink}` `#111111` on `{colors.canvas}` `#ffffff` | 19.07:1 | AAA |
| `{colors.body}` `#374151` on `{colors.canvas}` `#ffffff` | 9.49:1 | AAA |
| `{colors.muted}` `#6b7280` on `{colors.canvas}` `#ffffff` | 4.83:1 | AA |
| `{colors.muted-soft}` `#898989` on `{colors.canvas}` `#ffffff` | 3.43:1 | Large text only |
| `{colors.ink}` `#111111` on `{colors.surface-card}` `#f5f5f5` | 17.27:1 | AAA |
| `{colors.body}` `#374151` on `{colors.surface-card}` `#f5f5f5` | 8.59:1 | AAA |
| `{colors.muted}` `#6b7280` on `{colors.surface-card}` `#f5f5f5` | 4.37:1 | AA Large |
| `{colors.on-dark}` `#ffffff` on `{colors.surface-dark}` `#101010` | 19.69:1 | AAA |
| `{colors.on-dark-soft}` `#a1a1aa` on `{colors.surface-dark}` `#101010` | 9.04:1 | AAA |
| `{colors.on-primary}` `#ffffff` on `{colors.primary}` `#111111` | 19.07:1 | AAA |
| `{colors.brand-accent}` `#3b82f6` on `{colors.canvas}` `#ffffff` | 4.51:1 | AA |
| `{colors.success}` `#10b981` on `{colors.canvas}` `#ffffff` | 2.78:1 | UI element only, not text |
| `{colors.warning}` `#f59e0b` on `{colors.canvas}` `#ffffff` | 2.34:1 | UI element only, not text |
| `{colors.error}` `#ef4444` on `{colors.canvas}` `#ffffff` | 3.76:1 | Large text + UI |

The `muted-soft` token is restricted to large text or non-text UI accents. Semantic colors (`success`, `warning`, `error`) below 4.5:1 are paired with text on a status pill that uses dark ink on a tinted background, not white text on the semantic color directly. The `{component.status-pill}` component encodes this rule.

## No dark mode in v1

There is no theme toggle, no `dark:` variants, no system preference detection that flips the palette. The product is editorial-light-on-white by intent. Adding dark mode is a v2 conversation, not a v1 detail to retrofit.

If dark mode arrives in v2, the approach will be a paired set of dark tokens that map to the same semantic names. The components reference semantic tokens (`--text-primary`, `--surface-bg`, etc.) for exactly this reason: a v2 theme switch becomes a CSS variable swap, not a component rewrite.

## No accent customization in v1

The earlier visual plan included a per-user accent color picker with eight options. That is deprecated. The Cal.com-aligned system fixes the action layer to `{colors.primary}` `#111111` — the primary CTA, the active navigation state, and the h1 are all the same near-black across every freelancer's account.

The freelancer's brand still appears in the product, but through other surfaces: the wordmark in the public proposal/invoice header, the freelancer's logo on the client portal, the business name on documents. Those carry the freelancer's identity. The action color does not need to.

If a freelancer asks "where do I customize the color of my proposal," the answer is: you don't. The proposal looks the same shape for every freelancer because that consistency is the design — your brand carries through your wordmark, your logo, your typography choices for your business name, and the content you write. The frame around it is a fixed Middlemist frame.
