# CI/CD

CI runs on GitHub Actions. CD is handled by Vercel; pushing to `main` deploys to production, and pushing a branch with an open PR deploys a preview. The CI side is documented here. CD is documented in `docs/ops/deployment.md`.

## Workflows

Two workflow files in `.github/workflows/`:

- **`ci.yml`** — runs on every PR and on every push to `main`. Lint, typecheck, unit + integration tests.
- **`e2e.yml`** — runs nightly on the `main` branch. Playwright golden-path test against a freshly deployed preview environment.

The split is deliberate. Per-PR e2e would be expensive (a Playwright run takes ~2 minutes; multiplied across PRs and reruns, the GitHub Actions minutes add up). Nightly e2e against `main` catches regressions within 24 hours; per-PR CI catches everything else within minutes.

## Required checks before merge

Branch protection on `main`:

- `ci.yml` must pass.
- At least one approving review (self-approval acceptable for the solo build; the rule remains in place to encourage review when the team grows).
- Branch must be up to date with `main` (rebase or merge the latest `main` before merging the PR).
- Force pushes to `main` are blocked.

`e2e.yml` is not a required check (it runs on schedule, not on PR), so a failing nightly does not block in-flight PRs. It surfaces as a Slack-style notification on the operator's email.

## `ci.yml`

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: middlemist
          POSTGRES_PASSWORD: middlemist
          POSTGRES_DB: middlemist_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://middlemist:middlemist@localhost:5432/middlemist_test
      AUTH_SECRET: ${{ secrets.CI_AUTH_SECRET }}
      CRON_SECRET: ${{ secrets.CI_CRON_SECRET }}
      RESEND_API_KEY: re_test_dummy
      RESEND_WEBHOOK_SECRET: dummy
      UPLOADTHING_TOKEN: dummy
      UPLOADTHING_SECRET: dummy
      UPSTASH_REDIS_REST_URL: https://example.upstash.io
      UPSTASH_REDIS_REST_TOKEN: dummy
      INNGEST_EVENT_KEY: dummy
      INNGEST_SIGNING_KEY: dummy
      EXCHANGERATE_HOST_KEY: dummy
      DISABLE_RATE_LIMITS: 'true'
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NEXT_PUBLIC_PLAUSIBLE_DOMAIN: middlemist.app
      NEXT_PUBLIC_UPLOADTHING_PUBLIC_URL: https://utfs.io
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm db:generate

      - name: Apply migrations
        run: pnpm prisma migrate deploy

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
```

A few notes on the choices.

**Postgres as a service container.** GitHub Actions services run alongside the job; the connection at `localhost:5432` is local to the runner. The `--health-cmd` waits until Postgres is ready before the job proceeds.

**Dummy values for unused secrets.** The env reader's zod schema requires several variables to be set; for tests, a dummy string is sufficient because the corresponding integration is mocked or never invoked. `DISABLE_RATE_LIMITS=true` short-circuits Upstash so the dummy URL never sees a request. `RESEND_API_KEY=re_test_dummy` is read by the `sendEmail` helper, which is mocked in tests; the live key is never used.

**`AUTH_SECRET` from GitHub Secrets.** Even for tests, the value should be 32+ bytes to satisfy the schema. Stored as a repository secret named `CI_AUTH_SECRET`; the value is a CI-specific generated string that does not match production.

**`pnpm install --frozen-lockfile`.** A drift in the lockfile fails the install, which catches dependency-version disagreements between `package.json` and `pnpm-lock.yaml`.

**`prisma migrate deploy` runs before tests.** The migrations bootstrap the test database. The shape of the schema must match the source; a missing migration fails at this step.

## `e2e.yml`

```yaml
# .github/workflows/e2e.yml
name: E2E

on:
  schedule:
    - cron: '0 5 * * *' # 05:00 UTC nightly
  workflow_dispatch: {}

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: middlemist
          POSTGRES_PASSWORD: middlemist
          POSTGRES_DB: middlemist_e2e
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://middlemist:middlemist@localhost:5432/middlemist_e2e
      AUTH_SECRET: ${{ secrets.CI_AUTH_SECRET }}
      # ... other env vars matching ci.yml ...
      DISABLE_RATE_LIMITS: 'true'

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma
        run: pnpm db:generate

      - name: Apply migrations
        run: pnpm prisma migrate deploy

      - name: Install Playwright browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Run e2e
        run: pnpm test:e2e

      - name: Upload Playwright traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results/
          retention-days: 7
```

On failure, the trace artifacts are uploaded so the operator can replay the failing flow visually.

## Branch protection

Configured at _Repo Settings → Branches → Branch protection rule for `main`_:

- Require a pull request before merging.
- Require status checks to pass before merging: `ci`.
- Require branches to be up to date before merging.
- Restrict who can push to matching branches: maintainers only.
- Do not allow bypassing the above settings.

The "do not allow bypassing" setting includes administrators. The author admins the repo but follows the rule like everyone else (which is "no one else" in v1).

## Secrets in CI

Stored at _Repo Settings → Secrets and variables → Actions_:

| Secret           | Use                        |
| ---------------- | -------------------------- |
| `CI_AUTH_SECRET` | Auth.js signing for tests. |
| `CI_CRON_SECRET` | Cron secret for tests.     |

That is the complete list for v1 CI. Tests do not call live providers; dummy values cover the rest.

For nightly e2e against a real preview environment (an alternative pattern for v2), additional secrets would include `RESEND_API_KEY` (a sandbox key) and a separate `DATABASE_URL` for an e2e-dedicated Neon branch. v1 keeps e2e self-contained on the runner; the test database is bootstrapped fresh per run.

## Deploy

Vercel handles deploys automatically:

- Push to `main` → production deploy.
- Push to a branch with an open PR → preview deploy with a PR-specific URL.
- Closing the PR keeps the preview URL alive for ~24 hours, then cleans up.

There is no manual `vercel deploy` step in CI. The Vercel-GitHub integration is the deploy trigger; CI's role is to gate `main` with a green check.

## Rerun and triage

A failing CI run on a PR shows in the GitHub UI with a per-step log. The most common failures and the canonical first move:

- **Lint:** `pnpm lint --fix` locally.
- **Typecheck:** read the error, fix the type, push.
- **Test (specific):** run the failing test locally with `pnpm vitest <path>`. Most failures reproduce immediately; the rare flake re-runs by re-pushing.
- **Migrate:** the migration file is malformed or out of order. Fix locally, push.
- **Lockfile drift:** run `pnpm install`, commit the updated lockfile.

A re-run from the GitHub UI re-executes the workflow. The typical failure-and-fix loop in v1 is sub-five-minute.
