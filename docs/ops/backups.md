# Backups

Two backup paths run in parallel: Neon's point-in-time recovery (PITR) for fast restore from any moment within the retention window, and a weekly off-platform `pg_dump` to Cloudflare R2 for resilience against a Neon-account-level incident. Both inherit at-rest encryption from their source. Restore drills run quarterly.

## Primary: Neon PITR

Neon supports point-in-time recovery on every branch. The retention depends on the plan tier:

- **Free tier:** 7 days.
- **Launch / Scale:** up to 30 days.

PITR restores produce a *new branch* at a chosen timestamp; the existing branch is unaffected. The new branch can be promoted as production (by switching the `DATABASE_URL`) or used as a staging environment to inspect the historical state.

**Why PITR.** It is operationally trivial. A click in the Neon dashboard produces the restored branch in a few minutes. There is no `pg_restore` to run, no dump file to copy, no schema reconciliation step. For the most likely incident (a destructive migration ran 30 minutes ago), PITR is the right tool.

**Why not just PITR.** Single-provider risk. A Neon account-level incident (account suspension, region outage, an internal bug that affects PITR specifically) is rare but not zero. The off-platform dump below is the insurance.

## Secondary: weekly `pg_dump` to Cloudflare R2

A weekly Inngest cron (`backup.weekly-dump`) runs `pg_dump` against the production database, compresses the output, and uploads to a Cloudflare R2 bucket. Twelve weeks of dumps are retained on a rolling basis.

```typescript
// src/lib/inngest/functions/backup-weekly-dump.ts (sketch)
export const backupWeeklyDump = inngest.createFunction(
  { id: "backup.weekly-dump" },
  { cron: "0 6 * * 0" }, // 06:00 UTC every Sunday
  async ({ step }) => {
    const { dumpUrl, sizeBytes, sha256 } = await step.run("dump", async () => {
      // execute pg_dump and stream to R2
      return runDumpAndUpload();
    });

    await step.run("audit", () =>
      writeAudit({
        userId: null,
        action: "backup.completed",
        entityType: "user",
        entityId: "system",
        metadata: { dumpUrl, sizeBytes, sha256 },
      })
    );

    await step.run("rotate", async () => {
      // delete dumps older than 12 weeks
      return rotateOldDumps(12 * 7);
    });
  }
);
```

The dump is encrypted at rest in R2 (Cloudflare's default). The R2 bucket has a strict access policy: only the operator's API token can read or write. The token is stored in Vercel as `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (added to the env reader if the backup function is enabled).

**Off-platform.** R2 is a different vendor from Neon. A Neon-account incident does not affect access to the R2 bucket, and vice versa.

**Compression.** `pg_dump --format=custom` produces a binary dump that is both faster to restore than the SQL text format and natively compressed. Sizes for v1 are negligible (low MBs); a 12-week archive fits comfortably in R2's free tier.

**Cost.** R2 free tier covers v1; egress is free for restores within Cloudflare's network and minimal otherwise. Inngest free tier covers the weekly cron.

## Why both

PITR is operationally easy, single-provider. Weekly dumps are off-platform, slower to restore. Together they cover the main failure modes:

| Failure mode | PITR helps? | Dump helps? |
|---|---|---|
| Destructive migration applied an hour ago | Yes (restore to T-1 hour) | Yes (slower; restore last week's dump and replay) |
| Single row deleted accidentally | Yes (restore branch, copy row, drop branch) | Yes (slow; restore dump, copy row) |
| Neon account-level incident | No | Yes (restore dump to a fresh provider) |
| R2 bucket compromise | Not affected | Operationally lose insurance until next week's dump |
| Ransomware-style attack on the database | Yes (restore to T-before-attack) | Yes (alternate path) |

The Venn diagram is: PITR is fast for common incidents; dumps are slow but cover the catastrophic ones.

## Restore (PITR)

```
1. Identify the timestamp before the incident.
   - Sentry / Vercel logs / audit log.
2. In Neon dashboard:
   - Project → Branches → main → Restore → Point in time.
   - Choose the timestamp; click Restore.
3. Neon creates a new branch (e.g., main-restored-2026-04-30T12:00).
4. Connect to the new branch and verify:
   - Use Neon's SQL editor or psql with the new branch's connection string.
   - Spot-check rows that were affected by the incident.
   - Run smoke queries against critical tables.
5. Promote:
   - Either rename branches (rename main → main-broken, main-restored → main),
     or update DATABASE_URL in Vercel to point at the restored branch.
6. Bump AUTH_SECRET if the incident involved a credential exposure
   (forces every existing session to re-authenticate).
7. Audit:
   - writeAudit({ action: "system.pitr-restored", metadata: { restoredTo, by } })
   - Document the restore in docs/ops/incident-runbook.md → postmortem section.
```

The restore is observable from the Neon dashboard; downtime is measured in the time spent verifying (typically ~10 minutes for v1's data volume).

## Restore (manual dump)

```
1. Provision a fresh Neon branch (or a fresh Postgres instance elsewhere).
2. Download the most recent dump from R2:
   wrangler r2 object get middlemist-backups/dumps/2026-04-26.dump
3. Restore:
   pg_restore --clean --if-exists --no-owner --no-acl \
     --dbname=$RESTORE_DATABASE_URL 2026-04-26.dump
4. Smoke-test:
   - Connect with the test branch's URL.
   - Run a few queries (SELECT count(*) FROM ...).
   - Bring up the application against the test URL with a temporary preview deploy.
   - Verify login, dashboard, and a public proposal view.
5. Switch DATABASE_URL in Vercel.
6. Bump AUTH_SECRET if appropriate.
7. Run any migrations that landed since the dump:
   pnpm prisma migrate deploy
8. Audit and document the restore.
```

Manual dump restore is slower than PITR (downloading the dump, running `pg_restore`, smoke-testing) — typically 30 minutes to an hour for v1. It is the "Neon is unreachable" path; in normal operation, PITR is preferred.

## Test cadence

Backups that have never been tested are not backups. The drill cadence:

- **Quarterly: PITR drill.** Pick a recent timestamp. Run a restore to a new branch. Connect to the branch. Run a checklist of queries. Drop the branch. Total time: ~20 minutes.
- **Quarterly: dump drill.** Download the most recent dump. Run `pg_restore` against a fresh local Postgres or a Docker container. Bring up the app with the restored database as `DATABASE_URL`. Verify login, dashboard, public proposal view. Total time: ~45 minutes.

The drills are executed by the operator. Each drill writes an audit row (`backup.drill-pitr`, `backup.drill-dump`) with a metadata field of `{ outcome: "ok" | "issue", notes }`. The most recent drill date is recorded at the bottom of this document so the operator knows when the last verification happened.

**Last PITR drill:** *(record on first run)*
**Last dump drill:** *(record on first run)*

A drill that surfaces an issue (a missing column, a corrupted dump, a permission problem) gets a same-week fix; the drill is repeated until it passes.

## File backups

UploadThing is the only file storage. v1 does not maintain off-provider copies of uploaded files. The reasoning:

- UploadThing's durability is high (S3/R2 backed; both have multi-region durability ≥ 99.999999999%).
- The cost of an off-provider mirror at v1 scale (low single-digit GB) is small but the operational complexity is real (a mirror cron, a reconciliation check, an additional secret).
- The most common file-loss scenarios (accidental deletion by the freelancer; UploadThing project compromise) are covered by UploadThing's own retention policy — deleted files are recoverable via support for a window.

If the threat model changes (paying tenants, a compliance requirement), v2 adds a weekly mirror to R2 alongside the database dump. The architecture is straightforward: list every `FileUpload.url`, fetch each file, upload to R2 under a parallel path, retain 12 weeks. v1 holds.

## Operational notes

- **Dump file naming.** `dumps/YYYY-MM-DD.dump`. Date is the cron's invocation date; the dump captures state at the start of the run.
- **R2 bucket.** `middlemist-backups`. Single bucket; no per-environment split (preview/development do not have meaningful data to back up).
- **Encryption keys.** R2's built-in at-rest encryption applies. No custom KMS in v1.
- **Cross-region.** R2 is automatically replicated within Cloudflare's network. v1 does not run a manual cross-region copy.
- **Restore destination security.** A restore to a fresh database widens the attack surface temporarily (a second Postgres is reachable). The restored database's connection string is rotated as soon as the restore is complete; the temporary URL never lands in `.env.local` or in CI.
