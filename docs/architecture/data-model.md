# Data model

This is the source of truth for the data shape. The Prisma schema below is the canonical structure; `prisma/schema.prisma` should match it, and when it diverges, this document is updated in the same PR. All multi-tenant tables carry `userId` directly or through a parent that does.

## Schema

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── enums ───────────────────────────────────────────────────────────────

enum ProjectStatus {
  active
  on_hold
  completed
  archived
}

enum TaskStatus {
  todo
  in_progress
  done
  cancelled
}

enum ProposalStatus {
  draft
  sent
  viewed
  accepted
  declined
  expired
}

enum InvoiceStatus {
  draft
  sent
  viewed
  paid
  overdue
  void
}

enum Currency {
  PHP
  USD
  EUR
  GBP
  AUD
  CAD
}

enum AuditEntityType {
  user
  client
  project
  task
  time_entry
  update
  proposal
  invoice
  file
}

// ─── auth + freelancer ───────────────────────────────────────────────────

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  emailVerifiedAt   DateTime?
  passwordHash      String?
  name              String
  businessName      String?
  businessAddress   String?
  businessTaxId     String?
  logoUrl           String?
  signatureUrl      String?
  defaultCurrency   Currency  @default(USD)
  defaultTimezone   String    @default("Asia/Manila")
  onboardingDoneAt  DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  clients               Client[]
  projects              Project[]
  tasks                 Task[]
  timeEntries           TimeEntry[]
  updates               Update[]
  proposals             Proposal[]
  savedBlocks           SavedBlock[]
  savedPricingItems     SavedPricingItem[]
  proposalTemplates     ProposalTemplate[]
  invoices              Invoice[]
  emailSettings         EmailSettings?
  invoiceReminderConfig InvoiceReminderConfig?
  auditEntries          AuditLog[]
  notificationReads     NotificationRead[]
  portalSessions        ClientPortalSession[]

  @@index([deletedAt])
}

// ─── clients ─────────────────────────────────────────────────────────────

model Client {
  id            String   @id @default(cuid())
  userId        String
  name          String
  companyName   String?
  email         String
  phone         String?
  website       String?
  address       String?
  taxId         String?
  notes         String?
  emailValid    Boolean  @default(true)
  preferredCurrency Currency?
  archivedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user           User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  projects       Project[]
  proposals      Proposal[]
  invoices       Invoice[]
  portalSessions ClientPortalSession[]

  @@index([userId, archivedAt])
  @@index([userId, name])
  @@index([userId, email])
}

// ─── projects ────────────────────────────────────────────────────────────

model Project {
  id          String        @id @default(cuid())
  userId      String
  clientId    String
  name        String
  description String?
  status      ProjectStatus @default(active)
  currency    Currency
  budgetAmount Decimal?     @db.Decimal(12, 2)
  startedAt   DateTime?
  endedAt     DateTime?
  archivedAt  DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  client      Client      @relation(fields: [clientId], references: [id], onDelete: Restrict)
  tasks       Task[]
  timeEntries TimeEntry[]
  updates     Update[]
  proposals   Proposal[]
  invoices    Invoice[]

  @@index([userId, status])
  @@index([userId, clientId])
  @@index([userId, archivedAt])
}

// ─── tasks ───────────────────────────────────────────────────────────────

model Task {
  id          String     @id @default(cuid())
  userId      String
  projectId   String
  title       String
  description String?
  status      TaskStatus @default(todo)
  dueDate     DateTime?
  position    Int        @default(0)
  completedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([userId, status, dueDate])
  @@index([userId, projectId, position])
}

// ─── time tracking ───────────────────────────────────────────────────────

model TimeEntry {
  id          String    @id @default(cuid())
  userId      String
  projectId   String
  taskId      String?
  description String?
  startedAt   DateTime
  endedAt     DateTime?
  durationSec Int?
  isBillable  Boolean   @default(true)
  invoicedLineItemId String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([userId, projectId, startedAt])
  @@index([userId, endedAt])
}

// ─── updates ─────────────────────────────────────────────────────────────

model Update {
  id          String   @id @default(cuid())
  userId      String
  projectId   String
  title       String
  bodyJson    Json
  bodyHtml    String
  isPinned    Boolean  @default(false)
  emailSentAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  attachments UpdateAttachment[]

  @@index([userId, projectId, createdAt])
}

model UpdateAttachment {
  id        String   @id @default(cuid())
  updateId  String
  url       String
  filename  String
  sizeBytes Int
  mimeType  String
  createdAt DateTime @default(now())

  update Update @relation(fields: [updateId], references: [id], onDelete: Cascade)

  @@index([updateId])
}

// ─── proposals ───────────────────────────────────────────────────────────

model Proposal {
  id            String         @id @default(cuid())
  userId        String
  clientId      String
  projectId     String?
  title         String
  blocksJson    Json
  currency      Currency
  totalAmount   Decimal?       @db.Decimal(12, 2)
  status        ProposalStatus @default(draft)
  publicToken   String         @unique
  validUntil    DateTime?
  sentAt        DateTime?
  viewedAt      DateTime?
  acceptedAt    DateTime?
  declinedAt    DateTime?
  acceptanceSignatureName String?
  acceptanceSignatureAt   DateTime?
  acceptanceIp            String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  client  Client   @relation(fields: [clientId], references: [id], onDelete: Restrict)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([userId, clientId])
  @@index([publicToken])
}

model SavedBlock {
  id        String   @id @default(cuid())
  userId    String
  name      String
  blockJson Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, name])
}

model SavedPricingItem {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  rate        Decimal  @db.Decimal(12, 2)
  currency    Currency
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, name])
}

model ProposalTemplate {
  id              String   @id @default(cuid())
  userId          String
  name            String
  blocksJson      Json
  defaultValidDays Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, name])
}

// ─── invoices ────────────────────────────────────────────────────────────

model Invoice {
  id            String        @id @default(cuid())
  userId        String
  clientId      String
  projectId     String
  number        String
  currency      Currency
  issueDate     DateTime
  dueDate       DateTime
  notes         String?
  status        InvoiceStatus @default(draft)
  publicToken   String        @unique
  subtotal      Decimal       @db.Decimal(12, 2)
  taxAmount     Decimal       @db.Decimal(12, 2) @default(0)
  total         Decimal       @db.Decimal(12, 2)
  amountPaid    Decimal       @db.Decimal(12, 2) @default(0)
  paidAt        DateTime?
  sentAt        DateTime?
  viewedAt      DateTime?
  voidedAt      DateTime?
  lastReminderAt DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  client    Client            @relation(fields: [clientId], references: [id], onDelete: Restrict)
  project   Project           @relation(fields: [projectId], references: [id], onDelete: Restrict)
  lineItems InvoiceLineItem[]

  @@unique([userId, number])
  @@index([userId, status, dueDate])
  @@index([userId, clientId])
  @@index([publicToken])
}

model InvoiceLineItem {
  id          String   @id @default(cuid())
  invoiceId   String
  description String
  quantity    Decimal  @db.Decimal(10, 2)
  unitPrice   Decimal  @db.Decimal(12, 2)
  total       Decimal  @db.Decimal(12, 2)
  position    Int      @default(0)
  timeEntryId String?
  savedPricingItemId String?

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId, position])
}

// ─── fx ──────────────────────────────────────────────────────────────────

model FxRate {
  id        String   @id @default(cuid())
  base      Currency
  quote     Currency
  rate      Decimal  @db.Decimal(18, 8)
  fetchedAt DateTime

  @@unique([base, quote])
  @@index([fetchedAt])
}

// ─── settings ────────────────────────────────────────────────────────────

model EmailSettings {
  id           String   @id @default(cuid())
  userId       String   @unique
  fromName     String?
  replyTo      String?
  signatureMd  String?
  proposalSentSubject     String?
  proposalSentBody        String?
  invoiceSentSubject      String?
  invoiceSentBody         String?
  invoiceReminderSubject  String?
  invoiceReminderBody     String?
  updatePostedSubject     String?
  updatePostedBody        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model InvoiceReminderConfig {
  id              String   @id @default(cuid())
  userId          String   @unique
  isEnabled       Boolean  @default(true)
  daysBeforeDue   Int[]    @default([3])
  daysAfterDue    Int[]    @default([1, 7, 14])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ─── audit + notifications ───────────────────────────────────────────────

model AuditLog {
  id           String          @id @default(cuid())
  userId       String?
  action       String
  entityType   AuditEntityType
  entityId     String
  metadata     Json?
  ip           String?
  userAgent    String?
  createdAt    DateTime        @default(now())

  user              User?              @relation(fields: [userId], references: [id], onDelete: Cascade)
  notificationReads NotificationRead[]

  @@index([userId, createdAt])
  @@index([userId, entityType, entityId])
  @@index([action, createdAt])
}

model NotificationRead {
  id          String   @id @default(cuid())
  userId      String
  auditLogId  String
  readAt      DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  auditLog AuditLog @relation(fields: [auditLogId], references: [id], onDelete: Cascade)

  @@unique([userId, auditLogId])
  @@index([userId, readAt])
}

// ─── client portal sessions ──────────────────────────────────────────────

model ClientPortalSession {
  id              String   @id @default(cuid())
  userId          String
  clientId        String
  tokenHash       String   @unique
  magicLinkExpiresAt DateTime
  sessionExpiresAt   DateTime?
  consumedAt      DateTime?
  ip              String?
  userAgent       String?
  createdAt       DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([userId, clientId])
  @@index([sessionExpiresAt])
}
```

## Models in detail

### User

The freelancer's account. Holds auth credentials (`email`, `passwordHash`, `emailVerifiedAt`) and brand details (`name`, `businessName`, `logoUrl`, `signatureUrl`) used on every client-facing document. `defaultCurrency` and `defaultTimezone` set the user's reporting currency and time zone for dashboards and Today views. `onboardingDoneAt` gates the first-run flow. `deletedAt` soft-deletes a user; cascade rules destroy all child rows on hard delete (`onDelete: Cascade` from every per-tenant table).

Lifecycle: created at signup, updated through profile edits, soft-deleted on account closure (hard delete optional after a grace period).

### Client

A customer of the freelancer. Carries enough contact info to render an invoice or proposal addressed correctly. `emailValid` flips to false on a Resend bounce so subsequent emails are blocked at the send layer. `preferredCurrency` is informational; the project and invoice carry the actual transaction currency. `archivedAt` soft-archives without breaking historical foreign keys.

Cascade: `User` delete cascades to `Client`. `Client` delete is allowed only if no projects, proposals, or invoices reference it (`Restrict` from those tables). The UI prefers archive over delete.

### Project

The central object. Carries a denormalized `userId` (for tenancy queries) plus `clientId`. `currency` is the project's transaction currency and propagates to invoices and proposals attached to it. `budgetAmount` is optional and informational. `status` drives the dashboard groupings.

Cascade: deleting a `Project` cascades to its tasks, time entries, and updates. Proposals and invoices set their `projectId` to `null` rather than cascade, because a void or paid invoice should survive a project delete (history preserved).

### Task

Small, simple, attached to a project. `position` orders tasks within a project (drag-and-drop). `dueDate` powers the Today view. `completedAt` is set when status becomes `done` and cleared if it transitions back. Tasks are not assigned (one user); they have no priority field in v1.

Cascade: project delete cascades.

### TimeEntry

A logged interval on a project, optionally a task. Supports two creation paths: a running timer (`startedAt` set, `endedAt` null) and a manual entry (both timestamps or a `durationSec` value). `isBillable` controls whether the entry shows up in invoice line item picker. `invoicedLineItemId` is set when a time entry is converted to a line item, preventing double-billing.

Cascade: project delete cascades.

### Update

A note posted by the freelancer to the client. `bodyJson` is the Tiptap JSON document; `bodyHtml` is server-rendered (and sanitized) for the email. `isPinned` floats one update to the top of the project's timeline. `emailSentAt` is set when the `update.posted` event fires the client email.

Cascade: project delete cascades; attachments cascade with the update.

### UpdateAttachment

An uploaded file referenced from an update. Stores the URL, filename, size, and MIME type. The freelancer's user is determinable through the parent update's `userId`; uploads are auth-checked at the upload route.

### Proposal

A document sent to a client. `blocksJson` is the structured array of blocks (text, image, divider, pricing, signature). `totalAmount` is computed from pricing blocks at save time and cached for invoice creation. `publicToken` is a nanoid (21) used in `/p/[token]`. `status` advances through `draft → sent → viewed → accepted | declined | expired`. The `acceptance*` fields capture the client's typed name and IP at the moment of acceptance. `viewedAt` is set on first public view by the audit handler; subsequent views update the audit log but not this column.

Cascade: project FK uses `SetNull` so accepted proposals survive project deletion; client FK uses `Restrict`.

### SavedBlock

A reusable block in the freelancer's library. Inserting copies the JSON; later edits to the saved block do not propagate to existing proposals.

### SavedPricingItem

A reusable pricing line. Same insertion semantics as SavedBlock.

### ProposalTemplate

A complete proposal scaffold. `defaultValidDays` is added to today's date when instantiating to set `validUntil`.

### Invoice

A bill sent to a client. `number` is unique per user (`@@unique([userId, number])`); the format is decided in user settings (default `INV-YYYY-NNNN`). `subtotal`, `taxAmount`, and `total` are all stored to avoid recomputing on every read; they're recalculated when line items change. `amountPaid` allows partial-payment tracking even though there is no payment processor. `lastReminderAt` lets the reminder cron avoid double-firing.

Cascade: line items cascade with the invoice. Project FK is `Restrict` to preserve history.

### InvoiceLineItem

A row on an invoice. `total` is `quantity * unitPrice` materialized so the invoice's printed totals match historically even if rates or saved items change later. `timeEntryId` and `savedPricingItemId` are nullable origins that drive the "convert to line items" flows.

### FxRate

The only globally-shared table. Rows are keyed by `(base, quote)` and updated daily by the `fx.refresh` cron. Rate precision is 8 decimal places to handle small currency pairs without rounding loss. `fetchedAt` lets the dashboard surface a "stale rate" warning when the latest fetch is older than 48h.

### EmailSettings

Per-user overrides for transactional email subjects, bodies, signature, and from-name. Null fields fall back to system defaults defined in `src/lib/email/templates/defaults.ts`. The fields are markdown source for body and signature; rendering happens at send time.

### InvoiceReminderConfig

Per-user reminder schedule. `daysBeforeDue` and `daysAfterDue` are integer arrays (e.g., `[3]` and `[1, 7, 14]`). The `invoices.send-reminders` cron computes which invoices to remind based on `dueDate` and the user's config.

### AuditLog

Provenance for every observable event. `userId` is null when the actor is unauthenticated (a public-link viewer), in which case `ip` and `userAgent` carry the actor identity. `action` follows the `{entity}.{verb}` convention (`proposal.viewed`, `invoice.paid`). `metadata` is structured JSON; common shapes include `{ip, userAgent}` for views and `{oldValue, newValue}` for updates.

### NotificationRead

A join row between a freelancer and an audit-log entry that says "this user has read this notification." Notifications themselves are derived from filtering `AuditLog` to events the freelancer wants to see (`proposal.viewed`, `invoice.viewed`, `invoice.paid`, etc.) and excluding rows with a matching `NotificationRead`. Storing the read state, not the notification, halves the write volume.

### ClientPortalSession

A magic-link issuance and redemption record. `tokenHash` is `sha256(token)`. `magicLinkExpiresAt` is set at issuance (1 hour). On redemption, `consumedAt` is set, `sessionExpiresAt` is set (7 days), and a session cookie is issued. The cookie carries the session id; the request resolves user and client via this row.

## Multi-tenant ownership

| Table | Ownership |
|---|---|
| User | itself |
| Client | direct `userId` |
| Project | direct `userId` |
| Task | direct `userId` |
| TimeEntry | direct `userId` |
| Update | direct `userId` |
| UpdateAttachment | indirect via Update |
| Proposal | direct `userId` |
| SavedBlock | direct `userId` |
| SavedPricingItem | direct `userId` |
| ProposalTemplate | direct `userId` |
| Invoice | direct `userId` |
| InvoiceLineItem | indirect via Invoice |
| FxRate | global (no tenancy) |
| EmailSettings | direct `userId` (1:1 with User) |
| InvoiceReminderConfig | direct `userId` (1:1 with User) |
| AuditLog | direct `userId` (nullable for unauth events) |
| NotificationRead | direct `userId` |
| ClientPortalSession | direct `userId` and `clientId` |

Indirect-ownership tables are queried only via the parent's repository; they never get a top-level repository function.

## Cascade rules

- **User delete** cascades to every per-tenant table.
- **Client delete** cascades to portal sessions; restricts when projects, proposals, or invoices exist (the UI uses archive instead).
- **Project delete** cascades tasks, time entries, updates, and update attachments. Sets `Proposal.projectId` to null. Restricts if any non-void invoice references it.
- **Invoice delete** cascades line items. The UI uses `void` instead of delete except for drafts.

## Index strategy

Every multi-column index is justified by a known query:

- `Client(userId, archivedAt)`: list active clients.
- `Client(userId, name)` and `Client(userId, email)`: search inputs.
- `Project(userId, status)`: dashboard groupings.
- `Project(userId, clientId)`: client detail page.
- `Task(userId, status, dueDate)`: Today view (open tasks ordered by due date).
- `Task(userId, projectId, position)`: project task list.
- `TimeEntry(userId, projectId, startedAt)`: project time list.
- `TimeEntry(userId, endedAt)`: running timer query (`endedAt IS NULL`).
- `Update(userId, projectId, createdAt)`: project timeline.
- `Proposal(userId, status)`: dashboard.
- `Proposal(publicToken)`: public-link lookup; unique implicitly.
- `Invoice(userId, status, dueDate)`: overdue check, dashboard.
- `Invoice(publicToken)`: public-link lookup; unique implicitly.
- `AuditLog(userId, createdAt)`: notification feed.
- `AuditLog(userId, entityType, entityId)`: per-entity activity panel.
- `AuditLog(action, createdAt)`: cross-tenant queries (admin/debug only; not exposed in UI).
- `FxRate(fetchedAt)`: stale rate detection.

GIN indexes on text columns enabled by `pg_trgm` are added in a separate migration documented in `search.md`.

## Deferred to v2

- A `ContactNote` model for per-client notes timeline (currently a single text field on `Client`).
- A `Tag` model with `(userId, name)` unique and many-to-many to `Project`, `Client`, `Proposal`, `Invoice`. Cut for v1; tag-like grouping handled by client and project hierarchy.
- A `RecurringInvoice` template + scheduling rows. Cut with the recurring-invoice feature.
- A `Contract` separate from `Proposal`. Cut with the contracts module.
- An `Expense` model and related tables. Cut with expense tracking.
- A `Team` and `Membership` model. Cut with team accounts.

When any of these are added in v2, an ADR documents the migration plan.
