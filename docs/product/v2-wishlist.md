# v2 wishlist

This is the parking lot. When tempted to add a feature mid-build, write it here. Do not implement it. The build order is fixed, the v1 surface is closed, and every detour costs a multiple of what it looks like it costs at the moment of the detour.

The list below covers features explicitly cut from v1 and the reasoning. Some of these will move into v2; some will stay cut forever. The decision about each one is deferred until v1 is shipped, used, and stable.

## Features cut from v1

**Video calls.** Cut because integrating an SDK (Daily, LiveKit, Twilio) would add weeks of work, recording storage, and per-minute cost. Clients can use whatever video tool they already use; Middlemist links can live in updates.

**Payment processing (Stripe, Lemon Squeezy, PayMongo).** Cut because payment integration brings webhooks, refunds, dispute handling, reconciliation, tax reporting, and PCI scope. Invoices are marked paid manually in v1. Adding a real processor is a v2 candidate after the rest of the product is stable.

**Recurring invoices.** Cut because it requires a billing schedule model, a generation cron, a way to handle cancellation mid-cycle, and clear UX for "skip this month." Without payment processing, recurring invoicing is mostly a calendar reminder, which the freelancer can do without the product.

**Team accounts.** Cut because it would require a multi-user-per-tenant data model, role-based access control, invite flows, and seat management. The product is for solo freelancers and the schema reflects that. Adding teams is a schema rewrite, not a feature.

**Native mobile apps.** Cut because the product is responsive and the app surface is desk-shaped (proposals, invoices, project pages). A native app would mean React Native, app store accounts, and cross-platform parity work. The mobile web experience is a v2 polish target instead.

**Calendar sync (Google, Apple, Outlook).** Cut because it requires OAuth flows, two-way sync, conflict handling, and per-provider quirks. Tasks have due dates; that is enough for v1. A read-only `.ics` export is a candidate for v2.

**Webhook integrations (Zapier, Make, n8n).** Cut because exposing a stable public API surface is a long-term commitment. The product is closed in v1. v2 may add a small webhook outbound system once internal events are stable.

**Two-factor authentication.** Cut because TOTP and WebAuthn flows add complexity (recovery codes, device management, backup) and the product's threat model in v1 (single user, magic-link client portal, no payment data) does not warrant it. Adding 2FA is straightforward in v2 if the user base grows.

**Multi-language UI.** Cut because i18n adds a translation pipeline, locale-aware formatting in many places, and design considerations (string lengths, RTL). The app is English-only. Public document copy can be edited per-document.

**Dark mode.** Cut because the design language is editorial and the public-facing documents do not have a dark counterpart that would feel right. Adding dark mode would require a whole second visual system. v2 candidate only if there is real user demand.

**Advanced analytics dashboards.** Cut because principle 5 (editorial over dashboard) explicitly de-emphasizes metrics surfaces. The dashboard in v1 is a list, not a grid of charts. v2 may add a quiet "yearly summary" page.

**BIR / Philippine tax compliance features.** Cut because tax integration is country-specific, regulation-heavy, and requires real research and compliance work. v2 candidate if a meaningful user base in the Philippines emerges.

**Contracts module.** Cut because contracts overlap heavily with proposals (block-based document, signature, public token), and shipping both at once would dilute the proposal feature. v2 candidate as a separate document type once proposals are mature.

**Expense tracking.** Cut because expenses are not a freelancer's biggest pain (most freelancers track expenses in their accounting tool). Time tracking is included only because it produces invoice line items; expenses do not have the same direct payoff.

**Mileage tracking.** Cut for the same reason as expenses, plus the developer audience does not generally bill for mileage.

**Lead pipeline / CRM stages.** Cut because principle 4 calls it out by name. Adding stages, conversion tracking, and pipeline UX would drag the rest of the product toward CRM. A client is a client whether work has started or not; the product does not need a separate lead concept.

## How to use this file

When you are tempted to expand v1 scope, write the temptation here as a one-liner with a date. When v1 is shipped, used, and stable, revisit this list with three questions in hand:

1. Did the feature come up in real use, or only in imagination?
2. Would adding it improve the existing product or stretch it into a different product?
3. Is the cost of adding it less than the cost of leaving it out?

Items that fail any of those questions stay parked. Items that pass become candidates for v2 planning. Nothing on this list is automatically promoted; v2 is its own scoping conversation.
