# Audit log

The audit log is the system's source of truth for who did what and when. Every state change writes an audit entry. Every public-link view writes one too. The notification feed in the app is derived from audit entries; the "viewed at" timestamp on a proposal or invoice is set from the audit handler. Without the audit log, "did the client see this?" and "what just changed?" become guesses.

## Purpose

Three uses, in priority order:

1. **Provenance.** A complete history of state changes scoped to a freelancer's account. Useful for debugging, useful for the freelancer when something happened that they need to explain.
2. **In-app notifications.** Notifications are filtered audit entries joined with read state.
3. **First-view tracking.** `viewedAt` columns on `Proposal` and `Invoice` are set the first time a public-link audit entry is written for that entity.

## Schema

```prisma
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
```

`userId` on `AuditLog` is nullable because public-link views (a client viewing a proposal without a session) have no authenticated actor. In those cases, `ip` and `userAgent` carry the actor identity. The owning freelancer is reachable through the entity (e.g., `proposal.userId`); audit queries that need to scope to one freelancer join through the entity tables.

## What gets logged

| Entity    | Actions                                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User      | `user.signup`, `user.login`, `user.password-changed`, `user.email-changed`, `user.account-deleted`                                                                         |
| Client    | `client.created`, `client.updated`, `client.archived`, `client.unarchived`                                                                                                 |
| Project   | `project.created`, `project.status-changed`, `project.archived`, `project.unarchived`                                                                                      |
| Task      | `task.created`, `task.status-changed`, `task.deleted`                                                                                                                      |
| TimeEntry | `time-entry.created`, `time-entry.updated`, `time-entry.deleted`, `time-entry.invoiced`                                                                                    |
| Update    | `update.posted`, `update.edited`, `update.pinned`, `update.unpinned`                                                                                                       |
| Proposal  | `proposal.created`, `proposal.sent`, `proposal.viewed`, `proposal.accepted`, `proposal.declined`, `proposal.expired`, `proposal.regenerated-token`                         |
| Invoice   | `invoice.created`, `invoice.sent`, `invoice.viewed`, `invoice.marked-paid`, `invoice.marked-void`, `invoice.overdue`, `invoice.regenerated-token`, `invoice.reminder-sent` |
| File      | `file.uploaded`, `file.deletion-pending` (used by the deletion lifecycle in `file-uploads.md`)                                                                             |

## What does NOT get logged

- **Read operations on owned resources.** A freelancer opening their own client list does not write an audit entry. The volume would be enormous and the value is zero.
- **Notification reads.** When a freelancer reads a notification, the row goes into `NotificationRead`, not `AuditLog`. There is no `notification.read` action.
- **Field-level updates without product significance.** Editing the description of a task in place writes an audit entry only with `task.status-changed` semantics; adjusting whitespace in a description does not warrant a log.
- **Computed status transitions** that mirror an existing event. When `invoices.check-overdue` flips an invoice to `overdue`, the cron writes one `invoice.overdue` entry; it does not also write `invoice.status-changed` separately.

## Action naming

Convention: `{entity}.{verb}` in kebab-case. Verbs are past tense for things that happened. Some examples:

- `proposal.viewed`: past tense, the client viewed it.
- `invoice.marked-paid`: past tense compound, the freelancer marked it paid.
- `file.deletion-pending`: slightly stretched, denotes a state ("deletion is pending"), not a strict verb. Acceptable because it reads naturally and is consistent with the schema's lifecycle model.

New entity types are added to the `AuditEntityType` enum first, and a migration adds the value before code uses it.

## Metadata field

`metadata` is structured JSON. The shape varies by action. Conventions:

- **Views**: `{ ip, userAgent }`. (The columns also store `ip` and `userAgent`; the metadata duplication exists because some auditable views happen behind the scenes, such as `proposal.regenerated-token`, and the columns may not be relevant.)
- **Updates**: `{ field, oldValue, newValue }`. For `client.updated` etc., the metadata captures one or more `{field, oldValue, newValue}` triples. Sensitive fields (passwords, tokens) are not stored; their changes are logged with `oldValue` and `newValue` set to `"[redacted]"`.
- **Status transitions**: `{ from, to }`. For `proposal.sent` after a `draft → sent` transition, metadata is `{ from: "draft", to: "sent" }`.
- **Specific events**: each has its own shape. `proposal.accepted` includes `{ signatureName }`; `invoice.marked-paid` includes `{ amount, paidAt }`; `update.posted` includes `{ updateId, sentEmail: boolean }`.

A small registry in `src/lib/audit/registry.ts` maps each action to a Zod schema for its metadata. The audit-write helper validates metadata against the schema at write time so malformed entries do not enter the log.

## Notification derivation

In-app notifications are not a separate table. They are a query against `AuditLog` filtered to actions the freelancer has opted into seeing:

```sql
SELECT al.*
FROM "AuditLog" al
LEFT JOIN "NotificationRead" nr
  ON nr."auditLogId" = al.id AND nr."userId" = $userId
WHERE al."userId" = $userId  -- or null with entity ownership joined to userId
  AND al.action IN (
    'proposal.viewed',
    'proposal.accepted',
    'proposal.declined',
    'invoice.viewed',
    'invoice.marked-paid',
    'invoice.overdue'
  )
ORDER BY al."createdAt" DESC
LIMIT 50;
```

The unread count is the count of those rows where `nr.id` is null. Marking a notification read inserts a `NotificationRead` row. Marking all read inserts rows for every unread audit entry in one transaction.

This shape avoids:

- Maintaining a separate notification table that has to be kept in sync with audit on every write.
- Duplicating storage for the same fact ("the proposal was viewed").
- Backfilling notifications when adding a new notifiable action: any change to the `IN (...)` list immediately surfaces (or hides) rows.

## Retention

Full-detail audit entries are retained for 90 days. The `audit.compact` cron (weekly Sunday 02:00 UTC) processes entries older than 90 days:

1. For each user, group entries older than 90 days by `(action, entityType, entityId, day)`.
2. Replace each group with a single summary row carrying the count and a metadata field of `{compacted: true, count}`.
3. Delete the original rows.
4. The result is a coarser history at older horizons that still preserves "this client was created on this day" but loses fine details.

Notifications older than 90 days are not surfaced in the UI even before compaction; the dashboard caps the feed at 50 most recent. So the compaction does not affect notifications.

## Querying patterns

The two index-covered queries:

- **Notification feed**: by `userId` and `createdAt` desc. Index `(userId, createdAt)`.
- **Per-entity activity panel**: by `userId`, `entityType`, `entityId` desc. Index `(userId, entityType, entityId)`.

A third index, `(action, createdAt)`, supports cross-tenant queries for debugging. Not exposed in the product UI; used by the developer only via the database.

## Writing audit entries

A single helper:

```typescript
// src/lib/audit/write.ts
import { prisma } from '@/lib/prisma';
import { actionRegistry } from './registry';

type WriteAuditArgs = {
  userId: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: unknown;
  ip?: string;
  userAgent?: string;
};

export async function writeAudit(args: WriteAuditArgs) {
  const schema = actionRegistry[args.action];
  if (!schema) throw new Error(`Unknown audit action: ${args.action}`);
  const validated = schema.parse(args.metadata ?? {});
  return prisma.auditLog.create({
    data: {
      userId: args.userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: validated,
      ip: args.ip,
      userAgent: args.userAgent,
    },
  });
}
```

Repository functions and event handlers call `writeAudit`. Server Actions call it through their handler. The single helper is the only place audit rows are inserted.
