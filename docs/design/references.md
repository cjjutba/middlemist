# References

These are the products and surfaces Middlemist studies for visual and interaction patterns. They are inspiration, not source material. The point of studying them is to understand the principles that make the surfaces work, then apply those principles to Middlemist's domain. Copying a layout pixel-for-pixel produces a derivative; understanding the principle produces a coherent product that happens to share a visual lineage.

A few are read closely; most are skimmed for one specific element. The notes below name the takeaway for each.

## Cal.com — cal.com

The primary reference. Middlemist's design system is adapted from Cal.com's. Study every aspect: the token palette (near-black primary, white canvas, light-gray feature cards, dark footer), the surface pacing (alternating modes through a page), the type pairing (a display-style face for headings against a UI sans for body), the way feature sections show product UI inside a `{component.product-mockup-card}` instead of marketing illustrations, and the way pricing tiers feature a single dark "highlighted" tier surrounded by light tiers.

Most relevant pages: the landing page (the surface pacing playbook), the pricing page (the dark featured-tier pattern), the product feature pages (how to compose a section around a product fragment), and the documentation site (long-form readable surfaces with Inter Display headings and Inter body).

The takeaway: the visual identity is composed entirely of restraint and tokens. There are no decorative moves. The product reads as confident because every surface uses the same small set of components and colors.

## Linear — linear.app

Linear is the reference for app density, sidebar navigation, command palette, and keyboard-first interaction. Study the issue list (vertical density), the project switcher (Cmd+K-driven navigation), the inbox (how a notification list reads inside a sidebar-driven app), and the way Linear handles the "active" state of a navigation item with a subtle background tint rather than a heavy fill.

Most relevant: the command palette (model the `{component.command-palette}` after it), the sidebar density (a long list of projects without feeling cramped), and the keyboard shortcuts presented inline in dropdown items.

The takeaway: a high-density app does not have to feel cluttered. Clear hierarchy, consistent spacing, and minimal chrome do the work.

## Vercel — vercel.com

Vercel is the reference for minimalism, neutral palette discipline, and the near-black-plus-accent action layer. Study the dashboard (how a complex product surface reads as quiet), the deployment list (a dense list view that uses hairline dividers instead of card chrome), the project settings (a settings UI that does not feel like a wall of forms), and the way Vercel's primary CTA stays neutral on a near-white surface.

Most relevant: the way Vercel uses one accent color sparingly while keeping the action layer monochrome, and the way the dashboard prioritizes activity feed over stat tiles.

The takeaway: neutral does not mean boring. A monochrome palette plus careful typography produces a surface that feels engineered rather than decorated.

## Stripe Press — press.stripe.com

Stripe Press is the typography sanity check for long-form readable surfaces. The site itself is editorial (Stripe Press publishes books), so its visual language is closer to a magazine than to a SaaS product. Read it for how serious typography reads at body-text size, how line-length and line-height interact for readability, and how a centered narrow column carries authority without ornament.

Most relevant for Middlemist: the public proposal view's relationship to readable long-form content. Even though Middlemist drops the serif voice, the rules for readability (line length 60-80 characters, generous line-height, single column) carry over.

The takeaway: long-form reading on the web has well-understood typography rules. Apply them to the public proposal view.

## Stripe Checkout and receipts — stripe.com (checkout.stripe.com surfaces)

Stripe's transactional surfaces (checkout flow, email receipts, hosted invoice pages) are the reference for the public invoice view. Study how Stripe presents a tabular invoice in a single column with a totals stack, the way it pairs the bill-from and bill-to, and the way it uses small status indicators (a single status pill, never a row of stats) to communicate state.

Most relevant: the receipt PDF and the hosted invoice page. The way the line-item table sits inside a centered narrow column with a totals stack on the right matches what Middlemist's `{component.invoice-totals-stack}` should feel like.

The takeaway: a transactional document is the most direct test of typography and layout discipline. There is nowhere to hide.

## Notion — notion.so

Notion is the reference for the block editor pattern. Study the way blocks are added, moved, and selected; the slash-command UI for inserting new blocks; the way each block has a hover-equivalent affordance for drag and "more actions"; and the way the editor surface stays clean even with rich content.

Most relevant for Middlemist: the proposal builder and the project updates editor. Both are block-based. The interaction model from Notion (slash commands, drag handles on the left of each block, a clean writing surface) carries over.

The takeaway: a block editor that feels light and fast is mostly about restraint in the chrome. The blocks themselves do the work.

## Tella — tella.tv

Tella is the reference for public sharing pages. The way a Tella video share page presents the video as the page (no app chrome, no sidebar, branded header from the creator) is the same shape Middlemist wants for public proposals and invoices.

Most relevant: the page-as-document feel. A shared link should not look like an app screen; it should look like a designed artifact.

The takeaway: a page meant for an external viewer is a different surface from an app page. Strip the app chrome, lead with the content, brand the freelancer (not Middlemist).

## Raycast — raycast.com

Raycast is the second reference for the command palette pattern. Study how Raycast organizes results into groups, how it handles keyboard navigation through a long list, and how the entry "fades" the rest of the screen behind the palette.

Most relevant: the result row layout (icon on left, name in center, shortcut on right), the result groups (Clients, Projects, Proposals, etc.), and the way the palette closes on Escape.

The takeaway: a command palette is dense by design. The discipline is in keeping each row uncluttered while supporting many results.

## Pitch — pitch.com

Pitch is the reference for shared deck pages and the "document feel" of a presentation. The way a Pitch share link presents a deck as a document (single page, scrollable, no sidebar) maps to the public proposal view. The way Pitch handles a centered narrow column with generous vertical whitespace is exactly the proportion Middlemist wants for proposals.

Most relevant: the share-link page. Visit a public Pitch deck and observe the proportions, the spacing, and the absence of marketing chrome on the share page.

The takeaway: a shared document is a different product surface from an editor. The share page does not need the editor's tools; it needs to read.

## Closing note

These references are studied for principles, not copied for layouts. Middlemist's identity stays its own. The visual system is Cal.com-aligned at the foundation; the modules (proposal blocks, invoice line-items, the project hub, the client portal) carry the product identity. The references are the foundation on which the product-specific surfaces are built. They are not the product.

When in doubt about a design decision, look at how Cal.com solves it first. If Cal.com does not solve the case (because Middlemist's domain is different — they do scheduling, Middlemist does freelance ops), look at the closest of the others above. If none of them solve the case, the right move is usually to design the simplest version that uses the locked tokens and ship it. A surface designed from first principles using the locked tokens will read as coherent even if no reference exists.
