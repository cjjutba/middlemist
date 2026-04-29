# Glossary

Terms are defined in Middlemist's specific context. The same word may mean something different in another product. When a term has a precise schema meaning (a model, an enum value, a column), the schema definition is authoritative — see `docs/architecture/data-model.md`.

## Freelancer

The person who runs the account. The product is built for one freelancer per account. In the schema, this is the `User` row. The freelancer owns clients, projects, proposals, invoices, and everything else.

## Client

The freelancer's customer. A `Client` row holds contact information, business details, and preferences for one of the freelancer's clients. A client cannot belong to more than one freelancer. A client may have zero, one, or many projects.

## Tenant

The unit of data isolation. In Middlemist, the tenant is the `User`. Every row of every per-tenant table carries `userId` and queries are filtered by it. There are no team tenants or shared-tenant arrangements in v1.

## User vs Freelancer

`User` is the auth-system concept (the row that authenticates, has a session, holds a password hash and email). `Freelancer` is the product role that the User plays. In v1 a User always has the Freelancer role; there is no other role. The terms are not interchangeable: the docs use `User` when talking about authentication and access, and `Freelancer` when talking about who the product is built for.

## Project

A specific piece of work the freelancer is doing for a client. Projects are the central object. Tasks, time entries, updates, proposals, and invoices all attach to a project. A project has a status (`active`, `on_hold`, `completed`, `archived`), a currency, and an optional budget.

## Task

A discrete piece of work inside a project. Tasks are small and simple in v1: title, optional description, status, optional due date. Tasks are not subdivided into subtasks, not assigned (there is only one user), and not exposed to the client.

## Time Entry

A logged interval of work attributed to a project, optionally to a task. Time entries have a start time, an end time (or a duration if the entry was created manually), and a billable flag. Billable time entries can be added to invoice line items.

## Update

A note posted to a project that the client can see. Updates are written in Tiptap (rich text), can include attachments, and are delivered via email if the freelancer has enabled update emails. Updates are the primary client-facing communication channel inside the product. They are not a chat: there is no client reply field in v1.

## Proposal

A document sent to a client to win work. A proposal has a title, a recipient client, a structured body of blocks (text, image, pricing table, signature), an optional `validUntil` date, and a public token. Proposals have a status: `draft`, `sent`, `viewed`, `accepted`, `declined`, `expired`. An accepted proposal can create or attach to a project.

## Block (in a proposal)

A unit of proposal content. Blocks are stored as a structured JSON array on the proposal. Block types in v1: text (Tiptap rich text), image, divider, pricing table, signature. Blocks render in order in both the editor and the public proposal view.

## Variable

A placeholder inside proposal text that is replaced at render time. Variables use curly-brace syntax: `{client_name}`, `{project_name}`, `{freelancer_name}`. Variables resolve against the proposal's client, the freelancer's profile, and a small set of computed values (today's date, totals). Unknown variables render as the literal text.

## Saved Block

A reusable block the freelancer has saved for later reuse. Saved blocks are not tied to a specific proposal; they are a library. Inserting a saved block into a proposal copies its content; subsequent edits do not propagate.

## Saved Pricing Item

A reusable line item in the pricing block library. Stored with a name, description, default rate, and currency. Inserting a saved pricing item copies its values; subsequent edits do not propagate.

## Proposal Template

A complete proposal scaffold the freelancer has saved as a starting point: title, blocks, default `validUntil` offset. Creating a proposal from a template instantiates a new draft proposal with the template's content. The template and the proposal are separate rows; editing the proposal does not edit the template.

## Invoice

A bill sent to a client. An invoice has a number (sequential per user), a recipient client, a project, a list of line items, a currency, an issue date, a due date, an optional public token, and a status: `draft`, `sent`, `viewed`, `paid`, `overdue`, `void`.

## Line Item

A row on an invoice. Line items have a description, quantity, unit price, optional reference to a time entry or saved pricing item, and a computed total. Line items inherit the invoice's currency.

## FX Rate

A stored exchange rate. Rows in the `FxRate` table are keyed by `(base, quote)` and updated daily by an Inngest cron job hitting exchangerate.host. Used to convert dashboard totals into the freelancer's `defaultCurrency`. FX rates are global, not per-tenant.

## Public Token

A URL-safe random string (nanoid 21) attached to a proposal or invoice that lets an unauthenticated client view it. The token is the only access proof for client-facing routes. Regenerating the token revokes the previous link.

## Magic Link

A one-time URL emailed to a client to log into the client portal. The link contains a token that is hashed (`sha256`) before storage in `ClientPortalSession`. Magic-link tokens expire after 1 hour. Once redeemed, a session cookie is set and the magic-link token is consumed.

## Client Portal Session

A logged-in session for a client (not a freelancer). Bound to a specific `clientId` and `userId` (the freelancer who owns that client). Expires after 7 days. Used to gate the client portal routes that show the client their projects, updates, proposals, and invoices.

## Audit Log Entry

A record in the `AuditLog` table describing one observable event. Entries have an actor (`userId` for freelancer actions, null for public-link actions), an action name like `proposal.viewed`, a target entity, an entity ID, and a JSON metadata payload. Audit log is the source of truth for in-app notifications and "viewed at" timestamps.

## Notification

An item shown in the in-app notification list. Notifications are derived from audit log entries (filtered to events relevant to the user) joined with the `NotificationRead` table (which marks an audit entry as read for a given user). There is no separate `Notifications` table in v1.

## Today View

A scoped task list showing tasks due today, overdue tasks, and active timers across all the freelancer's projects. The Today view is a UI surface, not a separate data structure; it is a query against tasks filtered by `dueDate` and status.

## Onboarding

The first-run flow a new freelancer goes through: profile (name, business name, logo, default currency, default timezone), invite a first client, create a first project, optional sample data. Onboarding writes the same rows as the in-app forms; it is not a parallel data path.
