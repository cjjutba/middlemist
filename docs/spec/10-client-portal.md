# Module 10 — Client Portal

## Purpose

The client portal is the client-facing side of Middlemist. The client signs in with a magic link emailed by the freelancer (manually or by automatic trigger), lands on a portal home page that lists their projects, and reads through projects, updates, time, invoices, and proposals scoped to one freelancer-and-client pair. The portal is read-only with one exception: the public proposal route (`/p/[token]`) handles its own accept/decline flow. The portal is the second-most important brand surface in the product after the proposal viewer; the second product principle ("the client view is sacred") means it must read as a designed document, not as a stripped-down version of the freelancer app.

## In Scope (v1)

- Magic-link request: freelancer manually issues a link from a client's detail page; certain events also trigger automatic issuance.
- Magic-link redemption at `/portal/[token]` with cookie-based session.
- Read-only portal pages: home, project, project sub-sections (updates, tasks, time, invoices, proposals).
- Logout endpoint that clears the cookie and writes audit.
- Per-project visibility filters: tasks respect `Task.clientVisible`, time respects `Project.timeVisibleToClient`, updates and invoices show all attached to the client and project (proposals show only `sent | viewed | accepted | declined | expired` — drafts are never visible).
- Branded shell: freelancer logo and business name top of every page; dark `{component.footer}` at bottom; `{colors.primary}` is the only accent (no per-freelancer color customization in v1).

## Out of Scope (v1)

- **Client commenting on updates or proposals.** Cut to v2.
- **Client uploading files.** Cut to v2.
- **Client message thread / chat.** Cut to v2.
- **Client task creation.** Cut entirely.
- **Branded subdomain per freelancer.** Cut to v2; portal lives at `middlemist.app/portal/...`.
- **Client mobile app.** Cut entirely; the portal is responsive web.
- **Per-freelancer accent color.** Cut to v2; the portal accent is `{colors.primary}` for everyone in v1. (This overrides any earlier mention in Wave 1 of an accent customization feature.)
- **Multi-freelancer client identity.** A client of two different freelancers gets two unrelated portal sessions; there is no unified "client account" in v1.
- **Email summaries / digest from inside the portal.** Cut to v2.
- **Read receipts visible to the freelancer at the page level.** The audit log captures portal page views; only the freelancer-facing notification feed surfaces a subset.

## Data Model

Uses `ClientPortalSession` (see `docs/architecture/data-model.md` and `docs/architecture/multi-tenancy.md`). Relevant columns: `id`, `userId`, `clientId`, `tokenHash`, `magicLinkExpiresAt`, `sessionExpiresAt`, `consumedAt`, `ip`, `userAgent`. Plus the existing `User`, `Client`, `Project`, `Update`, `Task`, `TimeEntry`, `Invoice`, `Proposal` tables, all read with the portal context filter.

## User Flows

### Issue magic link (freelancer-initiated)

1. From the client detail page, the freelancer clicks "Send portal link" in the actions menu.
2. The action `requestClientMagicLink(clientId)` generates a `nanoid(48)` token, hashes it with sha256, inserts a `ClientPortalSession` row with `magicLinkExpiresAt = now + 1 hour`, emits `client.magic-link-requested`.
3. The Inngest handler sends the `magic-link.tsx` email to `Client.email`. The email contains a CTA `{component.button-primary}` (rendered HTML in email) linking to `/portal/[token]`.
4. The freelancer sees a toast "Magic link sent."

### Issue magic link (auto-triggered)

These events automatically trigger `requestClientMagicLink` if the client does not have a recent valid session:

- `proposal.accepted` (so the client can immediately view the project they just signed off on).
- `invoice.paid` (so the client can confirm receipt).

The client portal also has a "send me a link" page at `/portal/request` (no auth) where the client enters their email; the action looks up clients by email across all freelancers and issues a link for each match. Rate-limited 5 requests per minute per IP.

### Redeem magic link

1. The client clicks the link to `/portal/[token]`.
2. Middleware applies `portalRedeemLimit` rate limit per IP.
3. The route handler hashes the token, looks up `ClientPortalSession` by `tokenHash`, validates `magicLinkExpiresAt > now` and `consumedAt IS NULL`.
4. If valid: sets `consumedAt = now`, `sessionExpiresAt = now + 7 days`, `ip`, `userAgent`. Issues a signed session cookie carrying the session id. Redirects to `/portal`.
5. If expired or already consumed: render an "expired" page with a "Request a new link" `{component.button-primary}` linking to `/portal/request`.

### Portal home

1. The client lands on `/portal` (with the cookie). The page resolves `userId` and `clientId` from the session, fetches the client's projects via `portalRepo.listProjects(ctx)`.
2. Renders the home view (described in UI Surfaces below).

### View a project

1. Click a project card to navigate to `/portal/projects/[id]`.
2. The page fetches the project (scoped) and renders sections for updates, tasks (client-visible only), time (if `timeVisibleToClient`), proposals (non-draft), and invoices.

### Logout

1. Click "Sign out" in the portal nav. The handler clears the cookie, sets `sessionExpiresAt = now` on the session row, and redirects to `/portal/request`.

### Edge: freelancer regenerates project public token

1. The portal session is bound to the client portal session id, not to the project's public token. Project token regeneration does not affect portal sessions.

### Edge: freelancer archives the client mid-session

1. The portal session is invalidated at the next request: the portal repo functions check `Client.archivedAt IS NULL`. If archived, the page returns a friendly "this account is no longer available" view and clears the cookie.

### Edge: freelancer deletes a project the client was viewing

1. The portal route returns a 404 friendly page (the same shell, with a "this project no longer exists" message and a `{component.button-text-link}` "Back to portal home").

## UI Surfaces

The portal has a dedicated route segment outside `(app)` and outside the marketing site. Layout:

- Top nav: a thin bar with the freelancer's logo (left, max 40px tall), business name in `{typography.title-md}`, and on the right a `{component.button-text-link}` "Sign out."
- Page content area: centered max-width 720px column on `{colors.canvas}`.
- Footer: `{component.footer}` (dark surface) carrying the freelancer's wordmark in `{colors.on-dark}` and "Powered by Middlemist" small print.

### `/portal` — home

- Hero: greeting "Hi {client_name}" in `{typography.display-md}`. Below in `{typography.body-md}` `{colors.muted}`: "Here's what's happening with your projects."
- Section "Active projects": stacked list of `{component.feature-icon-card}` (one per row, full-width), each linking to the project page. Card content: project name in `{typography.title-md}`; status `{component.status-pill}`; one-line description; "Last update 3 days ago" in `{typography.caption}`.
- Section "Past projects": same shape, collapsed under a "Show 4 past projects" `{component.button-text-link}`.
- Empty state: `{component.empty-state-card}` ("No projects yet — your freelancer will set this up").

### `/portal/projects/[id]` — project view

- Hero: project name in `{typography.display-lg}`; status `{component.status-pill}`; date range and currency in `{typography.body-sm}` `{colors.muted}`.
- Description (rendered markdown).
- Section "Updates": list of `{component.client-portal-update-card}` items; pinned card at top with the accent border.
- Section "Tasks" (only `clientVisible = true` tasks): a simple list (no kanban) using `{component.feature-icon-card}` (compact). Status pill on the right of each card.
- Section "Time" (only if `Project.timeVisibleToClient = true`): a `{component.data-table}` with Date / Hours / Description columns. Total at the bottom in `{typography.code}`.
- Section "Invoices": list of small `{component.feature-icon-card}` rows, each linking to the public invoice URL `/i/[token]`. Status pill on each.
- Section "Proposals" (status in `sent | viewed | accepted | declined | expired`): same shape as invoices, linking to `/p/[token]`.
- Empty sub-sections render an inline "No items yet" line in `{typography.body-sm}` `{colors.muted}` rather than a full empty-state card.

### `/portal/request` — request a magic link (no auth)

- Centered narrow column (max 400px), `{colors.canvas}`. Heading in `{typography.display-md}`: "Get a portal link." `{typography.body-md}` `{colors.body}`: "Enter the email your freelancer sent the proposal to."
- One `{component.text-input}` (email) and `{component.button-primary}` "Send link." Always renders success state to prevent enumeration.
- Footer `{component.footer}`.

### `/portal/expired` — expired link

- Centered narrow column. Heading "This link has expired." Body: "Magic links last for one hour. Click the button below to request a new one." `{component.button-primary}` "Request a new link" → `/portal/request`.
- Footer `{component.footer}`.

### Login / route-not-found

- A 404 inside the portal renders the same shell (logo, footer) with a "page not found" body and a back link to `/portal` if the user has a session.

## Server Actions

| Action | Input | Output | Side effects |
|---|---|---|---|
| `requestClientMagicLink` | `{ clientId }` (authenticated, freelancer) | `{ ok: true }` | Issues token, hashes, inserts session, emails. Writes audit `client.magic-link-issued`. |
| `requestClientMagicLinkPublic` | `{ email }` (no auth) | `{ ok: true }` | For each matching client across freelancers, issues a link. Always returns success. Rate-limited. |
| `verifyClientMagicLink` | `{ token }` (no auth, called by route handler) | `{ ok: true, redirect: "/portal" }` | Hashes token, validates session, marks consumed, sets cookie. |
| `clientLogout` | `{}` (cookie auth) | `{ ok: true }` | Sets `sessionExpiresAt = now`; clears cookie. |

## Repository Functions

In `src/lib/repositories/portal.repo.ts`:

The portal repo takes a `PortalContext = { userId: string; clientId: string }` for every authenticated function.

- `listProjects(ctx)` — returns active and on-hold projects scoped to `(userId, clientId)`.
- `findProject(ctx, id)` — single project; returns null on miss.
- `listUpdates(ctx, projectId)` — updates for the project, pinned first.
- `listTasksClientVisible(ctx, projectId)` — `clientVisible = true` only.
- `listTimeEntries(ctx, projectId)` — only if `project.timeVisibleToClient`; returns entries.
- `listInvoices(ctx, projectId)` — invoices for the project (any status).
- `listProposals(ctx, projectId)` — proposals for the project (`sent | viewed | accepted | declined | expired`).

In `src/lib/repositories/client-portal-sessions.repo.ts`:

- `findByTokenHash(hash)` — non-tenant; used by the verify handler.
- `findById(id)` — used by the cookie resolver (returns user/client ids from the session).
- `create(input)` — issuance.
- `markConsumed(id, expiresAt, ip, userAgent)`.
- `expireById(id)` — used by logout and freelancer-initiated revocation.

## Validation Rules

- **Magic link token.** 48 characters from the URL-safe alphabet.
- **Cookie session.** Signed JWT of the session id only; the session id itself is a cuid (no enumeration risk over the cookie if exfiltrated, because the session is also bound to ip/userAgent for soft fingerprint check and has a 7-day TTL).
- **Email on `/portal/request`.** Standard format. Lower-cased before lookup. Always returns success.
- **`magicLinkExpiresAt`.** 1 hour TTL.
- **`sessionExpiresAt`.** 7 days TTL after consumption.

## Permissions and Tenant Isolation

The portal is the most security-relevant module after auth. The session model is intentionally narrower than the freelancer's session: every portal repo call takes `(userId, clientId)` and queries that filter by both. The portal cannot list projects of other clients of the same freelancer; the portal cannot read across freelancers. See `docs/architecture/multi-tenancy.md` Layer 3 for the canonical description.

A two-user isolation test asserts (with two freelancers and one shared client email):

- A client redeeming user A's link sees only user A's data.
- A client redeeming user B's link in a separate browser sees only user B's data.
- The portal repo filters by `(userId, clientId)` for every read; switching `userId` or `clientId` returns no rows.
- Drafts of proposals are never returned by `listProposals`.
- Tasks where `clientVisible = false` are never returned by `listTasksClientVisible`.

## Audit and Notifications

Audit actions: `client.magic-link-issued` (freelancer-initiated), `client.magic-link-redeemed`, `client.portal-page-viewed` (one entry per page navigation, with `entityType: client` and metadata carrying the route), `client.portal-logged-out`.

The audit row for portal page views uses `userId = null` (the actor is unauthenticated; the freelancer is reachable through the entity's ownership). The metadata includes `{ portalSessionId, route, ip, userAgent }`.

In-app notifications surfaced to the freelancer: `client.magic-link-redeemed` (one-shot — the first redemption emits a notification "Your client opened the portal").

## Emails Sent

- `magic-link.tsx` to the client on `client.magic-link-requested`. Customizable via `EmailSettings`.

## Background Jobs

- `client.magic-link-requested` event handler: sends the email.
- `portal-sessions.expire-stale` cron (daily 03:00 UTC): cleans up `ClientPortalSession` rows where `consumedAt IS NULL AND magicLinkExpiresAt < now - 30 days` (housekeeping; not security-relevant since expired tokens already fail the redemption check).

## Edge Cases and Decisions

- **Multiple links live at once.** A client can have multiple unconsumed sessions for the same freelancer. Each is independent; redeeming one consumes only that row.
- **Client with same email for two freelancers.** `requestClientMagicLinkPublic({ email })` issues a session for each matching freelancer-client pair. The client receives a separate email per freelancer; redeeming one signs them in to that freelancer's portal scope only.
- **Client opens the link on a different device or IP than the request.** Allowed in v1. The session captures the redemption ip/ua, but does not enforce equality with anything from the issuance.
- **Portal session and freelancer-initiated client archive.** The portal repo checks `Client.archivedAt IS NULL` on every read; an archived client gets the friendly "no longer available" page.
- **Cookie tampering.** The cookie is signed; tampering invalidates the signature and the request resolves to "no session." There is no graceful fallback; the user is redirected to `/portal/request`.
- **Freelancer deletes a session manually (revoke from settings).** Sets `sessionExpiresAt = now`. Next request from the cookie fails the expiry check and redirects to `/portal/request`.
- **Portal home for a brand-new client (just received their first link, has no projects yet).** Renders the empty state. The client may have been linked because of a single proposal that is sent but not yet attached to a project; in that case, the home shows "1 active proposal" with a link to the public `/p/[token]` view (since proposals are addressable by their own token).
- **Portal page-view audit volume.** A client clicking through 20 pages writes 20 audit rows. The audit retention/compaction pipeline (see `docs/architecture/audit-log.md`) handles this at scale; in v1 the volume is acceptable.

## Definition of Done

- All four server actions implemented and typed.
- Magic-link issuance and redemption flow works end-to-end with hashed token storage.
- The portal session resolver is tested for valid, expired, consumed, and tampered cookie cases.
- Portal repo functions are covered by an isolation test that uses two freelancers each with two clients (so isolation is tested across both `userId` and `clientId` axes).
- Per-project visibility (`Task.clientVisible`, `Project.timeVisibleToClient`) is tested in the repo functions.
- Drafts of proposals are excluded from the portal listing in a regression test.
- A Playwright e2e test runs the magic-link flow: freelancer issues link, simulated client redeems it, browses to a project, sees the right scoped data, signs out.
- The portal home, project view, request page, and expired page all match the design tokens (verified visually against `docs/design/`).
- Screenshots of the portal home, a project page (with updates and invoices), the request page, and the expired page captured.
