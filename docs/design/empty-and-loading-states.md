# Empty, loading, and error states

Empty states, loading states, and error states are not afterthoughts. They are visible to every user at some point — a freelancer signing up sees an empty dashboard before they have any clients, a slow database query forces a loading state on a list view, a network failure produces an error state that the user has to recover from. The product feels finished or unfinished based on how these states read.

This doc fixes the empty-state structure, lists the canonical empty-state copy per module, fixes the loading-state patterns, and fixes the error-state recovery shape.

## Empty states are quality signals

Cal.com-aligned restraint does not mean ignoring empty states. A bare list view with "No data" is a tell that the designer skipped this surface. The product handles empty states by treating them as a small surface to design.

### Structure

The `{component.empty-state-card}` pattern from `component-patterns.md` carries every empty state in the product.

- Container: `background: {colors.canvas}`, `border: 1px dashed {colors.hairline}`, `border-radius: {rounded.lg}` (12px), `padding: {spacing.xxl} {spacing.xl}` (48px vertical, 32px horizontal). The dashed border distinguishes the empty state from a real card and signals "something will live here."
- Vertically centered content with `{spacing.md}` (16px) gap between elements.
- **Optional icon:** a 32-48px Lucide icon at `{colors.muted-soft}` color. Used when an icon clarifies the entity (a folder icon for projects, a file-text icon for proposals). Often omitted to keep the surface quiet.
- **Heading:** `{typography.display-sm}` (28px) `{colors.ink}`. Brief, human, never patronizing. "Nothing here yet" not "Oops, looks like there's nothing here!"
- **Description:** `{typography.body-md}` `{colors.muted}`. A single sentence. Tells the user what they would see if there were data, or what to do to fill the space.
- **Primary action:** a single `{component.button-primary}` with the canonical action for the entity (e.g., "Add your first client"). No secondary buttons. Empty states are not multi-decision moments.

```tsx
<div className="flex flex-col items-center gap-4 px-8 py-12 bg-canvas border border-dashed border-hairline rounded-lg">
  <FolderIcon size={40} strokeWidth={1.5} className="text-muted-soft" />
  <h2 className="text-display-sm text-ink">No projects yet</h2>
  <p className="max-w-md text-center text-body-md text-muted">
    Create a project to start tracking work, time, and updates.
  </p>
  <button className="px-5 py-3 bg-primary text-on-primary text-button rounded-md">
    New project
  </button>
</div>
```

### Per-module empty states

Each module has a canonical empty-state copy. Use these strings; do not invent new ones at the implementation moment.

| Module | Heading | Description | Action |
|---|---|---|---|
| Clients list | "No clients yet" | "Add your first client to start sending proposals." | New client |
| Projects list | "No projects yet" | "Create a project to start tracking work." | New project |
| Proposals list | "No proposals yet" | "Build your first proposal in minutes." | New proposal |
| Invoices list | "No invoices yet" | "Generate an invoice from a project to bill your client." | New invoice |
| Tasks (per project) | "No tasks yet" | "Break the project into tasks." | New task |
| Updates (per project) | "No updates yet" | "Post an update to keep your client in the loop." | New update |
| Time entries (per project) | "No time logged yet" | "Start the timer or log a manual entry." | Log time |
| Today view | "Nothing due today" | "Enjoy the calm." | (no action) |
| Search no results | "Nothing matched" | "Try fewer words." | (no action) |
| Notifications empty | "All caught up" | "Notifications will appear here when there's something new." | (no action) |
| Saved blocks library | "No saved blocks yet" | "Save a block from any proposal to reuse it later." | (no action) |
| Saved pricing items | "No saved pricing items yet" | "Save a pricing line from any proposal to reuse it later." | (no action) |
| Audit log (filtered) | "No matching entries" | "Try a different filter." | (no action) |

The "no action" states are intentional. Some empty states have nothing for the user to do at this moment — they will fill in over time. Forcing a button on those states reads as nervous.

### Tone

The copy is direct and short. No exclamation marks. No "Oops!" or "Whoops!" or "Looks like." No emoji. No exhortation ("Get started today!"). The voice is the same as the rest of the product: calm, declarative, helpful.

## Loading states

Loading states occur when the product is fetching data, processing a mutation, or rendering a slow view. The product handles three loading patterns.

### Skeleton (preferred)

For full-page or full-section loads, render a skeleton that matches the actual layout. The skeleton has the same shape as the eventual content: card edges in the right places, text rows of approximately the right length, table rows of the right count.

- Skeleton boxes: `background: {colors.surface-card}`, `border-radius` matching the actual element being loaded
- Shimmer animation: a horizontal gradient (light → lighter → light) translates across the box every 1.5 seconds, paused when `prefers-reduced-motion: reduce`
- Skeleton text rows: 12-16px tall, varying widths (60%, 80%, 90%) to suggest paragraph rhythm
- Skeleton card: same outer shape as the real card, with skeleton content inside

```tsx
<div className="p-6 bg-canvas border border-hairline rounded-lg">
  <div className="h-4 w-3/5 skeleton mb-3 rounded-sm" />
  <div className="h-3 w-4/5 skeleton mb-2 rounded-sm" />
  <div className="h-3 w-2/5 skeleton rounded-sm" />
</div>
```

The skeleton always matches the real layout. A skeleton that does not match the real layout creates a layout shift when the data arrives, which is jarring.

### Within-button spinner

For mutations triggered by a button click (Save, Send, Submit), the button itself shows the loading state by replacing its label with a spinner. The button stays width-stable: the spinner takes the same horizontal space the label took.

```tsx
<button
  disabled={isSubmitting}
  className="px-5 py-3 bg-primary text-on-primary text-button rounded-md disabled:opacity-70"
>
  {isSubmitting ? <Spinner size={16} /> : "Send proposal"}
</button>
```

The spinner is a 16px Lucide loader-2 icon spinning at 1 rotation per second, color `{colors.on-primary}` (white).

### Full-page spinner (forbidden as default)

A full-page centered spinner is **not** the default. It reads as the lazy version of a loading state. Use a skeleton instead.

The single exception is route-level loading where no layout context is yet available — for example, during the brief moment before a server-rendered page arrives. Next.js's `loading.tsx` file at the route level can use a centered minimal placeholder. In practice, server components arrive fast enough that this is rarely visible.

## Error states

Errors fall into three categories: data fetch errors, validation errors, and unexpected runtime errors. Each has a distinct treatment.

### Data fetch error (whole section failed to load)

When a section of a page fails to load (a list view's data fetch errors out, an external service is down), the section renders as a `{component.feature-card}`-shaped error state.

- Container: `background: {colors.canvas}`, `border: 1px solid {colors.hairline}`, `border-radius: {rounded.lg}`, `padding: {spacing.xl}` (32px)
- Content: a small Lucide alert-circle icon at `{colors.warning}` 24px, a heading at `{typography.title-md}` `{colors.ink}` ("Something went wrong"), a body sentence at `{typography.body-md}` `{colors.body}` describing what failed in human terms ("We couldn't load your projects."), and a "Try again" `{component.button-secondary}`.

The error never exposes a stack trace, a database ID, or a technical error code. If the user reports the issue, the audit log and Sentry breadcrumb on the server side carry the diagnostic detail.

### Validation error (within a form)

When a form field has invalid input, the field shows a `{component.text-input-error}` state and an error message below.

- Field border: `{colors.error}`, focus ring `{colors.error}/10`
- Error message below: `{typography.caption}` `{colors.error}`, prefixed with a 12px Lucide alert-circle icon
- Form-level summary (for multi-field errors): a `{colors.error}/5` background panel above the form with a list of the validation errors

The field reverts to default state on next focus or input change. The error message persists until the field becomes valid.

### Unexpected runtime error (full page failed)

When a full page errors out (a server component throws), the error boundary catches and renders a centered error page.

- Layout: full viewport, centered narrow column at 480px
- Heading: "Something went wrong" at `{typography.display-md}` `{colors.ink}`
- Body: a single paragraph at `{typography.body-md}` `{colors.body}` ("An unexpected error occurred. We've logged it and will look into it. You can try refreshing the page.")
- Action: a "Refresh" `{component.button-primary}` and a `{component.button-text-link}` "Back to dashboard"

This state does not blame the user, does not show a code, does not request a screenshot. It logs to Sentry server-side and recovers as much as possible.

## State transitions

Three transitions matter for state quality:

- **Loading → loaded:** the skeleton's shape matches the loaded shape, so the transition is a content swap, not a layout shift. The user sees the data appear in place.
- **Loaded → empty:** a list that becomes empty (after the user deletes the last item) transitions immediately to the empty state — no flash of "0 results" before the empty card.
- **Loading → error:** a fetch that fails replaces the skeleton with the error card. The error card lives at the section level, not the page level — the rest of the page remains usable.

These transitions are not animated. The state changes are immediate. Adding fade or slide transitions to state changes makes the interface feel slow and adds no information.

## Quick checklist for new features

When adding a new list, page, or section, ensure all four states are designed:

1. **Default:** the loaded-with-data state.
2. **Empty:** the loaded-with-no-data state, using `{component.empty-state-card}` and the canonical copy.
3. **Loading:** a skeleton that matches the default layout.
4. **Error:** a feature-card-shaped error state with a recovery action.

A feature is not done if any of these four states is undesigned. The definition of done in `planning/definition-of-done.md` makes this explicit.
