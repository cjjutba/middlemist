# Deployment

Middlemist is a single Next.js 15 application deployed on Vercel. There is no separate backend service. Database access goes to Neon, file storage to UploadThing, background jobs through Inngest, transactional email through Resend, rate limiting through Upstash, error tracking through Sentry, and analytics through Plausible. This document walks through the providers, the environments, the branch model, the deploy steps, and the rollback path.

## Providers

| Provider      | Role                                        | Plan                                           |
| ------------- | ------------------------------------------- | ---------------------------------------------- |
| Vercel        | Application hosting (Edge + Node runtimes)  | Pro (Hobby until first paying tenant)          |
| Neon          | Postgres for application data and audit log | Free (paid tier when storage/compute requires) |
| UploadThing   | File storage for user-uploaded assets       | Free (caps reviewed quarterly)                 |
| Inngest       | Background jobs (cron + event-driven)       | Free (caps reviewed quarterly)                 |
| Resend        | Transactional email                         | Free (3,000/month)                             |
| Upstash Redis | Sliding-window rate limits                  | Free                                           |
| Sentry        | Error tracking and performance traces       | Free                                           |
| Plausible     | Marketing analytics                         | Self-hosted or paid (paid for v1)              |
| Cloudflare R2 | Off-platform `pg_dump` archive              | Free tier covers v1                            |

The Vercel project is named `middlemist`. The Neon project is named `middlemist`, with branches per environment.

## Domains

**Production:** `middlemist.app` (registered via Cloudflare Registrar). DNS is also managed in Cloudflare. The apex points at Vercel via CNAME flattening.

**Preview:** `*.vercel.app` per Vercel-generated branch URL. No custom domain on previews.

**Development:** `http://localhost:3000`. The `pnpm email:dev` server runs on port 3001.

## Environments

Three.

**Development.** The contributor's local machine. Reads `.env.local`, runs against either a Neon dev branch or a local Postgres. Inngest dev mode is invoked through `pnpm dlx inngest-cli@latest dev`.

**Preview.** A Vercel deployment per pull request. Has its own copy of the production environment variables (for non-shared secrets, the same values; for shared secrets like the database, a separate Neon branch shared across all preview deploys to avoid cross-environment data contamination). Preview deploys do not register cron schedules; v1 reads `process.env.VERCEL_ENV` and skips Inngest cron registration outside production.

**Production.** The `main` branch's deployment. Custom domain (`middlemist.app`). Production secrets, production Neon branch, production Inngest environment.

A complete summary of which secrets differ per environment lives in `docs/ops/environment-config.md`.

## Branch model

Trunk-based. `main` is always deployable. Feature work happens on short-lived branches; PRs go to `main`. Long-lived feature branches are not used.

```
main ─────────────────────────────────────────►
        \           \           \
         feat/x      fix/y       feat/z
         (PR + preview)  (PR + preview)
```

Every PR triggers a Vercel preview deploy and a CI run (lint, typecheck, tests). Approval lands the PR; merge to `main` triggers the production deploy.

Branch naming follows a soft convention:

- `feat/<short-name>` — new features.
- `fix/<short-name>` — bug fixes.
- `docs/<short-name>` — documentation-only changes.
- `chore/<short-name>` — dependency bumps, refactors that don't change behavior.

The convention is not enforced by tooling; it just makes the branch picker readable.

## Deploy steps (Vercel)

Vercel runs the following on every deploy:

1. **Install.** `pnpm install --frozen-lockfile`. Lockfile drift fails the install.
2. **Generate.** `prisma generate`. Produces the Prisma client into `node_modules/.prisma/client`.
3. **Migrate (production only).** `prisma migrate deploy` runs against the production database. Preview deploys do not apply migrations to production; preview deploys read from a separate database where migrations are applied manually before the relevant PR is merged.
4. **Build.** `next build`. Produces the production bundle.
5. **Start.** Vercel serverless functions are deployed; the application is reachable.

The build command in `vercel.json`:

```json
{
  "buildCommand": "pnpm db:generate && pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs"
}
```

The migrate step is _not_ in `buildCommand`. Migrations run in a separate "post-deploy" step (or, in v1, manually before merging the migration PR). The reason: a failed migration during build leaves the deploy in a broken state with no clear rollback path. Running migrations as a separate, observable step keeps "deploy" and "migrate" reversible independently.

## Database migrations

Migrations live in `prisma/migrations/` and are committed alongside the schema change in the same PR. The deployment flow:

1. **Develop locally.** `pnpm db:migrate` runs `prisma migrate dev` against the dev database. The migration file lands in `prisma/migrations/<timestamp>_<name>/migration.sql`.
2. **Push to PR.** The migration is reviewed alongside the code change.
3. **Apply to preview database.** Manually: `DATABASE_URL=<preview-db> pnpm prisma migrate deploy`. The preview deploy then has the schema it needs.
4. **Merge.** On merge to `main`, the contributor manually runs `DATABASE_URL=<production-db> pnpm prisma migrate deploy` _before_ triggering the Vercel production deploy. (Vercel can be paused with `vercel pull` while the migration runs; resume after.)
5. **Smoke check.** Hit `/api/health` and verify it returns 200.

The "manually run migrate before deploy" step is intentional. Automating it through Vercel's build is convenient until the first migration fails on production data; at that point the build is broken, the previous version is gone, and the rollback path is murky. Manual migrate keeps the two operations independent.

### Zero-downtime migrations

A migration that takes the database offline is unacceptable. The pattern for compatible migrations:

- **Adding a nullable column.** Safe. New code reads/writes the column; old code ignores it. One PR.
- **Adding a `NOT NULL` column with a default.** Safe if the default is set in the migration. PostgreSQL handles this efficiently for new rows. For existing rows, the migration runs `UPDATE ... SET col = ...` to backfill before the `NOT NULL` constraint applies.
- **Removing a column.** Two PRs:
  1. Stop reading the column in code (deploy 1).
  2. Drop the column in the schema (deploy 2).
- **Renaming a column.** Three PRs:
  1. Add the new column, dual-write to both, dual-read (prefer new, fall back to old).
  2. Backfill, then read/write only the new column.
  3. Drop the old column.

The two-/three-PR pattern is slow but unambiguous. v1 has not had a column rename yet; when one happens, the spec is split first.

### Backwards-incompatible migration with maintenance window

Reserved for the rare case where the above patterns do not apply. Process:

1. Announce on the marketing footer "scheduled maintenance: <date> <time> for ~10 minutes."
2. Pause Inngest cron schedules.
3. Take the application into a maintenance mode (return 503 from middleware on every authenticated route).
4. Run the migration.
5. Restart, verify, unpause.
6. Drop the maintenance mode.

v1 anticipates zero such migrations. The data model is stable enough that planned compatible migrations cover everything in the spec.

## Rollback

Two paths.

**Application rollback.** Vercel keeps every previous deployment. _Project → Deployments → <previous deploy> → Promote to Production_ swaps the production alias to the prior build. Takes seconds. The previous build stays running until traffic shifts, so there is no downtime.

**Database rollback.** Harder. If a migration applied to production turned out to be destructive, the recovery path is:

1. Identify the time before the migration ran.
2. Restore from Neon PITR to a fresh branch at that timestamp.
3. Verify the restore on the fresh branch.
4. Switch the production `DATABASE_URL` to the fresh branch (or replace the production branch with the restored one, which is the more durable fix).
5. Promote the previous Vercel build to align the schema and the code.

Rollback is rare. The two-/three-PR migration pattern means a destructive migration almost never lands on production directly; the column removal happens after the code stops reading the column, so a rollback at any point in the sequence remains coherent.

## Custom domain

DNS is managed in Cloudflare:

- `A` `middlemist.app` → Vercel's anycast IP (or `CNAME` flattening to `cname.vercel-dns.com` for the apex).
- `AAAA` for the IPv6 equivalent.
- `CNAME` `www.middlemist.app` → `cname.vercel-dns.com`.

SSL is auto-provisioned by Vercel (Let's Encrypt). The certificate covers both apex and `www`.

Email-related DNS records (managed at the same registrar):

- `TXT` for SPF: `v=spf1 include:_spf.resend.com ~all`.
- `TXT` and `CNAME` records for DKIM as Resend's domain verification specifies.
- `TXT` for DMARC: `v=DMARC1; p=quarantine; rua=mailto:hello@middlemist.app`.

The DNS records are checked into a `dns/` README (not `prisma/`-style migrations because DNS is a different domain) for visibility, but the records of record live in Cloudflare.

## Initial setup checklist

For someone (a future contributor or a future self) bootstrapping a fresh deployment:

1. Fork or clone the repo.
2. Create a Neon project with two branches: `main` (production) and `dev` (development). Note the connection strings.
3. Create a Vercel project pointing at the repo. Set framework to Next.js.
4. Generate a 32-byte `AUTH_SECRET` and a 32-byte `CRON_SECRET`:
   ```bash
   openssl rand -base64 32
   ```
5. Sign up for Resend, UploadThing, Inngest, Upstash Redis, Sentry, Plausible. Note the API keys and signing secrets.
6. Add every variable from `.env.example` to Vercel project environment variables. Mark each as Production / Preview / Development as appropriate. See `docs/ops/environment-config.md`.
7. Configure the custom domain in Vercel and set DNS records in Cloudflare.
8. Configure DKIM, SPF, DMARC for the email domain.
9. Run the first migration: `DATABASE_URL=<production-db> pnpm prisma migrate deploy`.
10. Push to `main` and verify the production deploy.
11. Hit `/api/health` to confirm the app is reachable and the database is connected.
12. Sign up the first user (the operator) and verify the magic-link / verification flow.

The checklist is run-once; after that, the team is on the trunk-based loop and the providers are configured.
