# File uploads

Middlemist uses UploadThing for file storage. Every upload runs through an authenticated handler that validates MIME type, file size, and ownership at the boundary. File metadata is stored in the database with `userId`; the file itself lives at the URL UploadThing returns. Uploads are not direct-to-bucket; they pass through UploadThing's signed-URL flow, which keeps the bucket private.

The decision to use UploadThing over raw S3/R2 is captured in `tech-stack.md`. The summary: UploadThing wraps the auth check, MIME validation, size limits, and the React hook in a few lines. Swapping to S3 in v2 is a one-file change in `src/lib/uploads/`.

## Upload contexts

Each upload context has its own handler with its own constraints. There is no generic "upload anything" route.

| Context | Max size | Allowed MIME types |
|---|---|---|
| Profile photo | 2 MB | `image/png`, `image/jpeg`, `image/webp` |
| Business logo | 2 MB | `image/png`, `image/jpeg`, `image/svg+xml` |
| Proposal image block | 5 MB | `image/png`, `image/jpeg`, `image/webp`, `image/gif` |
| Update attachment | 10 MB | `image/*`, `application/pdf` |
| Invoice attachment | 5 MB | `application/pdf` |

`image/svg+xml` is allowed only for the business logo because it is the format CJ wants to use for vector marks. The renderer that displays SVG sanitizes it (DOMPurify with strict config) to remove any embedded `<script>` or `onclick` handlers. Other contexts reject SVG.

Executable types (`application/x-msdownload`, `application/x-sh`, `application/javascript`, etc.) are rejected by the MIME allowlist. The list is allow-only; nothing not in the table above goes through.

## Authentication

Every upload route requires an authenticated session. The UploadThing `f.middleware` runs on the server before the upload is accepted:

```typescript
// src/app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth/config";

const f = createUploadthing();

export const uploadRouter = {
  profilePhoto: f({ image: { maxFileSize: "2MB" } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Persist file URL on User row
      await prisma.user.update({
        where: { id: metadata.userId },
        data: { logoUrl: file.url },
      });
    }),

  // ... one entry per context
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
```

The middleware throws if no session is present; UploadThing rejects the upload before any byte hits the bucket.

For contexts where the freelancer uploads on behalf of a child entity (a proposal image block, an update attachment, an invoice attachment), the middleware additionally checks ownership: the URL params or form fields carry an entity id, and the middleware confirms that entity belongs to the calling `userId` before proceeding.

```typescript
updateAttachment: f({ pdf: { maxFileSize: "10MB" }, image: { maxFileSize: "10MB" } })
  .input(z.object({ updateId: z.string() }))
  .middleware(async ({ input }) => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
    const update = await prisma.update.findFirst({
      where: { id: input.updateId, userId: session.user.id },
      select: { id: true },
    });
    if (!update) throw new Error("UPDATE_NOT_FOUND");
    return { userId: session.user.id, updateId: update.id };
  })
  .onUploadComplete(async ({ metadata, file }) => {
    await prisma.updateAttachment.create({
      data: {
        updateId: metadata.updateId,
        url: file.url,
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
      },
    });
  }),
```

## Metadata storage

For every upload, the database row carries:

- `url`: the UploadThing URL.
- `filename`: the user-facing name shown in the UI.
- `sizeBytes`: file size in bytes (for display and quota tracking).
- `mimeType`: the validated MIME type.
- Implicit `userId` ownership through the parent entity.

Metadata is the source of truth for "what files does this user have" queries. A reconciliation job (in v2) can compare DB metadata to UploadThing's storage to catch orphans.

## Deletion lifecycle

When an entity that owns a file is deleted (an update is deleted, a project is deleted that cascades to updates, a user is deleted), the metadata row is deleted by Prisma's cascade rules. The file in UploadThing is not deleted in the same transaction; deleting external resources from a database transaction is unsafe.

Instead, a soft-delete pattern: deletion writes the file URL to a `PendingFileDeletion` queue (stored as audit-log rows with a special action `file.deletion-pending`). The `audit.compact` cron job (or a dedicated `files.purge-deleted` job in v2) picks up entries older than 30 days and calls UploadThing's delete API for each, then removes the audit entry. The 30-day delay gives an undo window if a delete was a mistake.

For v1, the simpler implementation is acceptable: orphan files in UploadThing are tolerated. The cleanup job is on the v2 list and the audit-log convention is in place to support it without schema changes.

## Security

- **No public buckets.** All UploadThing assets are accessed via signed URLs. The signed URL is proxied through Middlemist when the asset is sensitive (e.g., update attachments shown to a client through the portal); the URL is checked for ownership before redirect.
- **No executable file types.** The MIME allowlist excludes anything that could be executed in a browser or downloaded and run.
- **MIME-sniffing protection.** Responses set `X-Content-Type-Options: nosniff`. Image previews use `<img>` not `<iframe>`.
- **SVG sanitization.** Only the logo context accepts SVG. The renderer (`src/components/SafeSvg.tsx`) sanitizes with a strict DOMPurify profile (no scripts, no event handlers, no `<foreignObject>`).
- **Per-user upload quotas** are not enforced in v1. UploadThing's plan limits are sufficient. v2 may add a per-user quota check if abuse becomes a concern.
- **Antivirus scanning** is not performed in v1. Files larger than 10 MB are rejected by the size limit, and the MIME allowlist is restrictive enough that the realistic threat surface is small. v2 candidate if a real upload abuse case appears.

## Adding a new upload context

1. Add the entry to `uploadRouter` in `src/app/api/uploadthing/core.ts`.
2. Choose the smallest reasonable size limit and the strictest reasonable MIME allowlist.
3. Add ownership middleware if the upload attaches to a child entity.
4. Add metadata fields to the relevant Prisma model (or use an existing attachment table).
5. Wire up the React hook in the UI.
6. Update this document's table.
