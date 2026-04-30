# Anti-patterns

This is the discipline doc. Every entry below is a pattern that produces a surface that reads as decorated, AI-generated, or off-brand. The list is concrete because vague rules ("use restraint") fail in review while specific anti-patterns ("never use the default shadcn slate palette") catch the actual mistakes.

Read this doc during code review. Read it again before declaring a feature done. The most common drift is back toward shadcn defaults or back toward the deprecated visual direction (moss accent, 7px radius, Source Serif).

## Default shadcn theme

**The pattern:** taking shadcn/ui out of the box without overriding the theme. Default slate or zinc neutrals, default indigo or violet primary, default Geist Sans, default 0.5rem (8px) radius applied uniformly.

**Why it is wrong:** the default shadcn theme is a generic SaaS palette designed to look acceptable everywhere. Middlemist needs a specific identity: near-black primary, white canvas with light-gray feature cards, Inter Display + Inter type pair, dark footer. Leaving shadcn at defaults means Middlemist looks like every other product built with shadcn.

**Do instead:** override the theme aggressively at the start of the build. Set `{colors.primary}` to `#111111`, set the type stack to Inter Display + Inter + JetBrains Mono via `next/font/google`, set the radius scale to 8/12/16, and verify the override is complete by running through the component patterns doc.

## Three identical icon-text feature cards

**The pattern:** a "Features" section on a marketing page with three identical cards, each containing a small Lucide icon, a title, and two lines of body copy. The cards are visually interchangeable.

**Why it is wrong:** this is the AI-generated landing page tell. The cards have no specific content because they were generated as filler. A reader scanning the section retains nothing because every card is the same shape with the same level of abstraction.

**Allowed:** a 3-up grid of `{component.feature-card}` or `{component.feature-icon-card}` IS allowed in Cal.com style — but only when each card has distinct, specific content and ideally a `{component.product-mockup-card}` showing the actual product feature inside. "We help you do X" is generic; a small rendering of the actual proposal-block-pricing component is specific.

**Do instead:** make each feature card show a real product UI fragment. The proposals card shows a miniature `{component.proposal-block-pricing}`. The invoices card shows a miniature `{component.invoice-line-item-row}` table. The client portal card shows a stack of `{component.client-portal-update-card}` items. Specific beats generic.

## Marketing illustrations of the product

**The pattern:** a feature section that uses an illustration to show what the product does — a stylized drawing of a dashboard, a hand-drawn sketch of an invoice, a vector illustration of someone using the tool.

**Why it is wrong:** the illustration is a fantasy version of the product. The reader has no idea whether the actual product matches. And custom illustrations age fast — what looks fresh in 2026 looks dated in 2028.

**Do instead:** use a `{component.product-mockup-card}` containing real product UI at smaller scale. The actual rendered components are more credible than illustrations of them.

## Gradient hero with abstract blobs

**The pattern:** a landing page hero where the background is a soft gradient (purple-to-blue, peach-to-pink), with abstract blob shapes floating behind the headline, and the product is described abstractly without showing it.

**Why it is wrong:** Cal.com-anti. The hero should ground the product in something concrete. A gradient with blobs reads as decorated, not engineered.

**Do instead:** use `{component.hero-band}` with a `{component.hero-app-mockup-card}` to the right. The mockup card holds an actual product screenshot at smaller scale. The headline is to the left; the proof is to the right.

## unDraw, isometric character, doodle illustrations

**The pattern:** flat unDraw illustrations of a person at a laptop, isometric character illustrations of a worker holding a giant document, hand-drawn doodles representing concepts.

**Why it is wrong:** these illustration styles read as 2018 startup landing page. They have a specific era and they communicate "AI-generated" by 2026 because they have been used so heavily.

**Do instead:** use product UI fragments inside `{component.product-mockup-card}` shapes. If a section truly needs no visual at all, leave it without one. Generous whitespace beats decorative illustration.

## Generic dashboard with stat tiles in a row

**The pattern:** a dashboard whose hero is a row of four stat tiles ("12 Active Projects", "$8,400 Outstanding", "32 hrs This Week", "5 Pending Proposals") with animated counters that count up on load.

**Why it is wrong:** principles.md states the dashboard does not lead with stat tiles. The principle is "editorial over dashboard" — the dashboard primary content is "what's outstanding right now" rendered as a list that reads, not a grid of numbers.

**Allowed:** stat tiles in a Quick Stats panel further down the dashboard ARE allowed in Cal.com style, IF the tiles use `{component.feature-icon-card}` shape with real numbers, are paired with a label that gives context, and never animate on load. A row of four small stat cards as a secondary section is fine. Leading the dashboard with them is not.

**Do instead:** lead the dashboard with the Today panel (overdue invoices, pending proposals, today's tasks). Stats can appear lower on the page in a single 4-up row using `{component.feature-icon-card}` shape.

## Mixing icon families

**The pattern:** importing a few icons from Lucide, a few from Heroicons because they have a better arrow-right, and one from Phosphor because it has a unique icon that the others lack.

**Why it is wrong:** even when the sizes match and the strokes look similar, the visual character drifts. Lucide's geometry is slightly different from Heroicons'; Heroicons differs from Phosphor; the inconsistency shows up across screens as a vague "this looks off" feeling.

**Do instead:** Lucide React only. If Lucide does not have the exact icon needed, pair two Lucide icons or substitute a text label.

## AI marketing copy

**The pattern:** body copy that uses words like "seamless," "effortless," "powerful," "unlock," "delight," "transform," "elevate," "supercharge," "revolutionary," "game-changing." Headlines that follow the pattern "X for Y" or "The Y for Z" without specifics.

**Why it is wrong:** these words are signals of AI-generated marketing copy. They are vague, generic, and they communicate that the writer did not have a specific thing to say. Real freelancers do not describe their tools this way.

**Do instead:** write the way you would talk to a freelancer friend. "Stop chasing freelance work across six tools." beats "Effortlessly streamline your freelance workflow with our powerful all-in-one platform." Be specific about what the product does ("Your proposals, projects, and invoices in one place. Branded for you.") and let the specifics carry the persuasion.

## Borderless underline-only inputs

**The pattern:** a text input with no border, no background, just a single underline below it. The label is above the input or floats inside.

**Why it is wrong:** Cal.com-anti. The borderless underline is a Material Design pattern. Cal.com's input shape is a hairline border, white background, 8px radius — a clear bounded surface.

**Do instead:** use `{component.text-input}` with a `{colors.hairline}` 1-pixel border, `{colors.canvas}` white background, `{rounded.md}` 8px radius, and a focus ring at `{colors.primary}/8%`.

## Heavy box shadows everywhere

**The pattern:** every card on the page has a shadow. Some cards have stronger shadows than others. The page has a layered, drop-shadow-everywhere depth that reads as 2014.

**Why it is wrong:** modern SaaS uses hairline borders for separation, not shadows. Shadows are reserved for elevated surfaces (modal, sheet, command palette, hero mockup card) where the surface is genuinely floating above the page. A flat surface with a shadow reads as dated.

**Do instead:** use `{colors.hairline}` 1-pixel borders on most cards. Reserve shadows for the elevated cases listed in `motion.md` and `component-patterns.md`. The default elevation is flat with a hairline.

## Glassmorphism and heavy blur

**The pattern:** a card with a translucent background, a backdrop-filter blur, and a subtle gradient inside to suggest depth. A modal that uses backdrop-filter blur to soften the page behind it.

**Why it is wrong:** glassmorphism is a 2020-era trend that has aged. It also performs poorly on lower-end hardware (the blur is expensive to render) and reduces contrast (text on a translucent surface is harder to read).

**Do instead:** modal overlays use `rgba(0, 0, 0, 0.4)` solid color, no blur. Cards use solid surfaces with hairline borders. The surface pacing in `color.md` carries the visual rhythm without effects.

## Pure black and pure white

**The pattern:** body text in `#000000` on a `#FFFFFF` background. Maximum contrast at all times.

**Why it is wrong:** pure black on pure white is harsh and reads as system-UI. The locked palette uses `{colors.ink}` `#111111` (very near black, slightly softer) on `{colors.canvas}` `#FFFFFF`, and `{colors.body}` `#374151` for running text. The contrast remains AAA-rated; the surface reads as designed.

**Do instead:** use `{colors.ink}` for primary text, `{colors.body}` for running body text, and `{colors.canvas}` for the background. Never type a literal `#000` or `#000000` into a className or style attribute.

## Auto-playing animations on landing

**The pattern:** the landing page hero has an autoplaying video, a looping animation, or a Lottie file that plays repeatedly.

**Why it is wrong:** autoplay is distracting, accessibility-hostile (motion sensitivity), and signals "we paid for animation." Static hero with a strong product mockup beats animated hero.

**Do instead:** the hero is a static `{component.hero-band}` with a `{component.hero-app-mockup-card}`. If a demo video exists, it is click-to-play, embedded lower on the page, with a static thumbnail.

## Skeleton loaders that do not match the layout

**The pattern:** a generic skeleton placeholder (a box with a few rectangles) that does not match the shape of the eventual content.

**Why it is wrong:** when the content arrives, the layout shifts. The page jumps. The user's reading flow is interrupted.

**Do instead:** the skeleton matches the actual layout. A 3-up card grid loads with three skeleton cards in the same grid. A list view loads with rows of the same height. See `empty-and-loading-states.md`.

## Loading spinners as full-page replacements

**The pattern:** a route loads with a centered spinner that takes the entire viewport. The spinner is the only thing on the screen until the data arrives.

**Why it is wrong:** the user sees nothing about the page they are loading. They cannot start reading partial content. The spinner-only state lasts long enough to be noticed but provides no information.

**Do instead:** use skeletons that match the layout. The header, sidebar, and section structure render immediately; only the data within sections loads as skeletons. See `empty-and-loading-states.md`.

## Status indicators using color only

**The pattern:** a list view where the row's status is communicated only by color (a green dot for "paid," a red dot for "overdue").

**Why it is wrong:** accessibility fail. Color-blind users cannot distinguish green from red reliably. The status must also carry text.

**Do instead:** use `{component.status-pill}` which combines a tinted background with a text label ("Paid", "Overdue"). The color is the supplementary signal; the text is the primary.

## Pricing tiers when there is no product to sell

**The pattern:** a `Pricing` page on the marketing site with three tiers, fake numbers, and "Contact us" buttons.

**Why it is wrong:** Middlemist v1 has no paid tier. There is nothing to charge for and no infrastructure to charge with. A pricing page with placeholder tiers reads as "we are pretending to be a real SaaS company."

**Do instead:** no pricing page in v1. The marketing surface focuses on the product story and the case study. If pricing arrives in v2, the design system already has `{component.pricing-tier-card}` and `{component.pricing-tier-card-featured}` ready.

## Generic placeholder names in screenshots and demos

**The pattern:** screenshots and demo data using "Acme Corp," "John Doe," "Lorem ipsum," "Test Project."

**Why it is wrong:** these placeholders signal "this is a demo, not a real product." The case study reader subconsciously discounts the screenshots.

**Do instead:** use realistic names. Clients: "Mangosteen Studio," "Halcyon Press," "Atlas & Compass." Freelancers: real names with realistic businesses. Project names: "Q2 marketing site," "Customer dashboard rebuild." Real-feeling content makes the screenshots read as a working product.

## Emoji bullets, headings, status indicators

**The pattern:** "✅ Done," "🚀 Launching soon," "💡 Features," "❤️ Made with love."

**Why it is wrong:** emojis age fast, render inconsistently across platforms, and read as informal. Middlemist's voice is calm and direct, not breezy.

**Do instead:** use Lucide icons for visual accents (a check-circle for done, an alert-circle for warnings). Use plain text in headings. Save emoji for places where they are the actual content (a user's display name in a chat, never the design system).

## Cards with multiple radius values on one screen

**The pattern:** a page where some cards are 4px radius, others are 8px, others are 12px, others are 16px, with no logic governing the choice.

**Why it is wrong:** the page reads as inconsistent. The radius scale exists to encode meaning (small radius for buttons, medium for cards, large for hero mockups). Mixing them randomly removes the meaning.

**Do instead:** pick `{rounded.lg}` (12px) for cards and stick to it across the page. The exception is the hero `{component.hero-app-mockup-card}` at `{rounded.xl}` (16px), which is one card per page. Buttons get `{rounded.md}` (8px). Pills get `{rounded.pill}`. Avatars get `{rounded.full}`. That is the entire vocabulary.

## Footers with eight columns of links

**The pattern:** a marketing footer with columns for Products, Solutions, Company, Resources, Legal, Support, Developers, Connect, each with five links.

**Why it is wrong:** Middlemist v1 does not have eight categories of links. A complex footer reads as "we copied a Salesforce footer."

**Do instead:** the v1 footer has the wordmark, three or four links (Privacy, Terms, Contact), a copyright. Single row, dark surface, done. See `{component.footer}`.

## Display weight at 700

**The pattern:** Inter Display set at weight 700 because "the headline should be heavier."

**Why it is wrong:** the type scale is calibrated to weight 600. At 700, Inter Display reads as too heavy for the surrounding light surfaces. The negative letter-spacing was tuned for the visual weight of 600.

**Do instead:** keep Inter Display at 600. If the headline needs more presence, increase the size before increasing the weight. A 64px Inter Display 600 is anchored. A 64px Inter Display 700 is overweight.

## Source Serif 4 anywhere in the app

**The pattern:** loading Source Serif 4 for the public proposal view's body, the public invoice view's body, or any document surface.

**Why it is wrong:** Source Serif 4 was the editorial direction in the earlier visual plan. That direction is deprecated. Public proposal/invoice views use Inter for body. The contrast between Inter Display headings and Inter body provides editorial gravitas without the serif.

**Do instead:** load Inter Display + Inter + JetBrains Mono only. Do not include Source Serif 4 in the font stack. See `typography.md`.

## Camellia botanical motif

**The pattern:** illustrations or graphic elements based on the camellia flower (the literal "middlemist" botanical), applied as decorative accents on cards, in the hero, or as a brandmark.

**Why it is wrong:** the camellia direction was part of the earlier visual plan. It is deprecated. The Cal.com-aligned system uses no decorative botanical elements. The brand is the wordmark + a small filled circle, full stop.

**Do instead:** wordmark + circle mark in `{colors.primary}` on light surfaces, `{colors.on-dark}` on dark surfaces. Nothing else.

## 7px radius

**The pattern:** applying a 7-pixel border-radius to cards, buttons, and inputs as a "signature" detail.

**Why it is wrong:** the 7px direction was part of the earlier visual plan. The radius scale is now 8/12/16 (Cal.com-aligned). A single radius value applied to all surfaces produces visual monotony; the differentiated scale produces meaning.

**Do instead:** use `{rounded.md}` (8px) for buttons and inputs, `{rounded.lg}` (12px) for cards, `{rounded.xl}` (16px) for the hero mockup card. See `spacing-and-radius.md`.

## Moss accent #5A7A4F

**The pattern:** using `#5A7A4F` (deep moss) as the primary CTA color, the active state color, or anywhere as a brand accent.

**Why it is wrong:** the moss accent was the earlier brand direction. It is deprecated. The action layer is monochrome at `{colors.primary}` `#111111`. The brand accent for occasional use is `{colors.brand-accent}` `#3b82f6`, used only on inline body links and rare badge highlights.

**Do instead:** primary CTA, h1, h2, active state, and ink text are all `{colors.primary}` `#111111`. Inline body links use `{colors.brand-accent}` `#3b82f6`. No moss anywhere in the product.

## When you spot one of these in code review

The fix is usually small: replace a hex with a token, swap a font weight, remove an animation, replace an illustration with a `{component.product-mockup-card}`. The cost of fixing during review is minutes. The cost of letting them ship is the case study reading as a generic SaaS product instead of a coherent designed tool. Catch them at review.
