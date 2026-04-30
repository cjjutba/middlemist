# Motion

Motion in Middlemist is subtle, fast, and purposeful. It communicates state — a button pressed, a modal opening, a toast appearing — and nothing else. There are no bouncy springs, no parallax, no scroll-jacking, no autoplay video on the landing page. The product reads as engineered, not theatrical.

This doc fixes the motion principles, the duration scale, the easing curves, the reduced-motion behavior, and the per-component motion specifics.

## Motion principles

Three principles govern every motion decision in the product.

**Motion communicates state, not personality.** A button that briefly darkens on press tells the user the click registered. That is communication. A button that bounces, scales, or rotates on press tells the user the designer wanted to look clever. That is personality. The product avoids the second category.

**Faster than a user notices.** The duration scale tops out at 300ms because anything slower starts to feel like the interface is responding to itself rather than to the user. The default is 150ms — fast enough that the motion reads as a crisp acknowledgement, slow enough that it does not feel jittery on slower hardware.

**Reduced motion is respected without ceremony.** Users who set `prefers-reduced-motion: reduce` get the state changes (color shifts, opacity transitions) but not the spatial transitions (slides, translates). The behavior is one CSS media query at the global level; individual components do not need to handle it.

## Duration scale

Four durations cover every motion in the product. Picking a duration is a matter of matching the kind of change to the right speed.

| Duration | Easing | Use |
|---|---|---|
| 150ms | ease-out | State changes: button press, hover-equivalent shifts, focus rings |
| 200ms | ease-in-out | Layout shifts: accordion open/close, dropdown open, tab switch |
| 300ms | ease-out | Page-level: modal enter, sheet slide, page transition (rare) |
| 0ms | none | Critical user actions: form submission, navigation away from current page |

A button press uses 150ms because the change is small (background color shifts from `{colors.primary}` to `{colors.primary-active}`) and the user expects an immediate response. A modal entering uses 300ms because the change is large (a new surface fades and translates into view) and the slower duration helps the eye locate the new content.

Form submission uses 0ms — the button does not animate while submitting; instead, the label is replaced with a spinner and the surface stays width-stable. The user already chose to act; animation between their click and the action would make the product feel slow.

## Easing curves

Two easing curves cover every motion. Both are CSS cubic-bezier values that match the modern-SaaS rhythm.

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

`--ease-out` is the default. Movement starts fast and decelerates into the final state. Used for press, focus, modal enter, sheet enter, page transition.

`--ease-in-out` is for symmetric movements: accordion that closes the same way it opened, dropdown that retracts the same way it expanded, tab content that swaps with a brief crossfade.

The classic browser easings (`ease`, `ease-in`, `ease-out`, `ease-in-out`) are not used. They feel mechanical compared to the cubic-bezier curves above. Always reference the CSS variable, not the built-in keyword.

## Reduced motion

The global stylesheet honors `prefers-reduced-motion: reduce` by stripping translates and scales while preserving color/opacity transitions. This is the standard approach across Cal.com, Linear, and Vercel.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
    /* Color transitions still happen; spatial ones do not. */
    transform: none !important;
  }
}
```

The result: a user with reduced motion enabled still sees the button darken on press, the focus ring fade in, the disabled state fade in. They do not see the modal slide in from below or the toast translate from off-screen — those changes appear instantly.

## Forbidden motion patterns

The list below is the discipline mechanism. Each pattern is forbidden because it reads as decorated rather than engineered.

- **Bouncy springs and overshoot.** No `cubic-bezier` curves that overshoot 1.0 in the y-axis. The two easings above are the entire palette.
- **Parallax scrolling.** Background images or text that move at a different rate than the foreground are forbidden. Pages scroll at one rate.
- **Scroll-jacking.** The browser scroll event is not hijacked. No "scroll to reveal" full-screen takeovers, no horizontal scroll triggered by vertical input.
- **Autoplay video on landing.** The landing page does not autoplay video. If a demo exists, it is a static product mockup card or a "click to play" video.
- **Animated stat counters.** The dashboard does not count up "0 → 12 active projects" on load. The number renders at its final value.
- **Marquee text or scrolling logos.** Logos and text are static.
- **Hover effects that scale or rotate.** Cards do not lift, scale, or rotate on hover. Subtle background or border-color shifts only — and per Cal.com discipline, hover is not documented as a state in the design system. The default and active states are documented.
- **Page transitions in v1.** Navigation between pages in the freelancer app does not animate. Next.js's default behavior (server-rendered, instant) is correct. Client-side route transitions are not added.

## Per-component motion specifics

The components below have specific motion behaviors. All other components follow the global default (150ms ease-out for state changes, 200ms ease-in-out for layout shifts).

### Buttons

A `{component.button-primary}` press transitions `background-color` from `{colors.primary}` to `{colors.primary-active}` over 150ms ease-out. The change is visible to the user as a brief darkening. There is no scale, no shadow shift, no transform.

A `{component.button-icon-circular}` follows the same transition.

The `{component.button-text-link}` underline appears on focus (not on hover), 150ms ease-out, by transitioning `text-decoration-color` from transparent to `currentColor`.

### Modals and sheets

`{component.modal}` enters with a two-step composite: the overlay fades in from 0 to 1 over 200ms ease-out, and the modal body fades in (0 → 1 opacity) and translates 8px upward (translateY(8px) → translateY(0)) over 200ms ease-out, starting at the same time as the overlay. Exit is the inverse, 200ms ease-out.

`{component.sheet-right}` enters by translating from `translateX(100%)` to `translateX(0)` over 300ms ease-out. The overlay behind it fades in at the same time. Exit is the inverse.

### Toasts

`{component.toast}` enters by translating from `translateY(100%)` (off-screen below) to `translateY(0)` and fading from 0 to 1 over 300ms ease-out. The toast auto-dismisses after 4 seconds. Dismissal animates over 200ms ease-out by reversing the translate and fade.

### Loading skeletons

A skeleton boxes uses a shimmer animation: a horizontal gradient (linear-gradient from `{colors.surface-card}` through `{colors.surface-soft}` back to `{colors.surface-card}`) translates across the surface every 1.5 seconds in a continuous loop. The animation pauses when `prefers-reduced-motion: reduce`.

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-card) 0%,
    var(--surface-soft) 50%,
    var(--surface-card) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}
```

### Dropdowns and tooltips

`{component.dropdown-menu}` opens with opacity 0 → 1 and a 4px translateY (translate from 4px above to 0) over 150ms ease-out. The menu is anchored to the trigger; no scale animation.

`{component.tooltip}` appears after a 600ms hover delay, fading in over 100ms. Disappears immediately on mouse leave.

### Focus rings

A focus ring on a button or input appears via a `box-shadow` transition (transparent to `0 0 0 2px rgba(17, 17, 17, 0.2)`) over 150ms ease-out. Removal is also 150ms.

## Motion discipline check

Before adding any motion to a new component, ask: does this motion communicate a state change? If yes, use the duration that matches the kind of change (150ms for color/opacity, 200ms for layout, 300ms for spatial). If no, the motion is decoration and is removed.

Hover styling is not part of the design system per Cal.com discipline. The default and active/pressed states are documented; hover is not. This prevents the product from accumulating subtle "lift on hover" or "scale on hover" effects that read as decorated. A surface that needs to indicate interactivity uses a cursor change and the active/pressed state, not a hover transform.
