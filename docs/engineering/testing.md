# Testing

Two layers of tests in v1: Vitest for unit and integration, Playwright for end-to-end. The pyramid is heavily weighted toward unit and integration; e2e covers a small set of golden-path flows that need a browser. The investment is calibrated to a solo build: enough coverage that multi-tenancy is provable and regressions are caught, not so much that the test suite is a separate maintenance project.

## Strategy

The pyramid:

```
         ▲
         │       e2e (Playwright)        — 4-6 specs, golden paths only
         │
         │       integration (Vitest + real Postgres)
         │       — every repo function, key services, every server action smoke test
         │
         │       unit (Vitest)
         │       — schemas, utilities, error mapping, sanitization, audit registry
         ▼
```

**Unit tests** verify pure functions: zod schemas, utility helpers, error mapping, the rich-text sanitizer, the audit registry. Fast, no I/O, no dependencies.

**Integration tests** verify the application against real Postgres. Repository functions, services that combine repos, server actions invoked end-to-end. Slower than unit but the only way to prove multi-tenant isolation.

**E2E tests** verify a real browser against a running Next.js dev server. Reserved for flows where the UI affects the assertion: signup-to-onboarding, public proposal acceptance, magic-link client portal redemption.

## Tools

**Vitest** for unit and integration. Configured with `vite-tsconfig-paths` so the `@/` alias resolves at test time. Watch mode locally; single-run in CI.

**Playwright** for e2e. Configured with three projects (Chromium only in v1; Firefox and WebKit in v2 if there is reason). Tests boot a Next.js dev server on a random port and run against it.

**Real Postgres** for integration tests. Locally via Docker (`docker compose up -d postgres`). In CI via a Postgres service container in the GitHub Actions workflow. The schema is bootstrapped with `prisma migrate deploy` before each run.

## Coverage targets for v1

Pragmatic, not absolute. The targets reflect "what we need to prove" rather than "what we can measure."

| Layer             | Target                                                                          | Rationale                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositories      | ~80% line coverage; **every public function has a multi-tenant isolation test** | Tenancy is the property that matters; coverage tracks the proof.                                                                                                |
| Services          | ~60%                                                                            | Business rules vary in importance; cover the state transitions and the integration boundaries.                                                                  |
| Server actions    | ~40% (smoke)                                                                    | The wrapper handles the bulk; per-action smoke tests verify the wrapper catches the right errors.                                                               |
| UI components     | very little                                                                     | Only critical interactives (proposal editor, time tracker) get unit tests. Visual correctness is not asserted in v1 (no snapshot tests on rendered components). |
| Email templates   | snapshot per template                                                           | Catches accidental layout regressions.                                                                                                                          |
| PDFs              | golden-file tests                                                               | Render to a file and compare against a checked-in PDF (byte-equal).                                                                                             |
| Inngest functions | per-function happy-path + idempotency test                                      | Idempotency is testable: run the handler twice, assert end state matches running once.                                                                          |

Coverage is reported by Vitest's `--coverage` flag; the report is logged in CI but not enforced as a gate. An action without tests does not block merge if it is a thin wrapper around a tested service; review judges case by case.

## Multi-tenant isolation tests (required pattern)

The single most important test pattern. Every repository function gets one. The shape:

```typescript
// src/lib/repositories/__tests__/projects.repo.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { projectsRepo } from '../projects.repo';
import { userFactory } from 'tests/factories/user.factory';
import { clientFactory } from 'tests/factories/client.factory';
import { projectFactory } from 'tests/factories/project.factory';

describe('projectsRepo (multi-tenant isolation)', () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    await prisma.project.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();

    userA = (await userFactory()).id;
    userB = (await userFactory()).id;

    const clientA = await clientFactory({ userId: userA });
    const clientB = await clientFactory({ userId: userB });

    await projectFactory({ userId: userA, clientId: clientA.id, name: 'Site redesign' });
    await projectFactory({ userId: userB, clientId: clientB.id, name: 'Site redesign' });
  });

  it("list returns only the calling user's projects", async () => {
    expect(await projectsRepo.list(userA)).toHaveLength(1);
    expect(await projectsRepo.list(userB)).toHaveLength(1);
  });

  it('findById returns null cross-tenant', async () => {
    const bProject = (await prisma.project.findFirst({ where: { userId: userB } }))!;
    expect(await projectsRepo.findById(userA, bProject.id)).toBeNull();
  });

  it('update throws cross-tenant', async () => {
    const bProject = (await prisma.project.findFirst({ where: { userId: userB } }))!;
    await expect(projectsRepo.update(userA, bProject.id, { name: 'Hijacked' })).rejects.toThrow(
      'PROJECT_NOT_FOUND',
    );
  });

  it('archive throws cross-tenant', async () => {
    const bProject = (await prisma.project.findFirst({ where: { userId: userB } }))!;
    await expect(projectsRepo.archive(userA, bProject.id)).rejects.toThrow('PROJECT_NOT_FOUND');
  });
});
```

The test seeds two users with overlapping data, runs the repo function as user A, and proves user A cannot see, modify, or archive user B's data. Every public function gets this treatment. Code review rejects a new repo function without a corresponding isolation test.

## Test data

Factories per entity in `tests/factories/`. Each factory creates a row with sensible defaults and accepts overrides.

```typescript
// tests/factories/project.factory.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function projectFactory(overrides: Partial<Prisma.ProjectUncheckedCreateInput>) {
  return prisma.project.create({
    data: {
      userId:
        overrides.userId ??
        (() => {
          throw new Error('userId required');
        })(),
      clientId:
        overrides.clientId ??
        (() => {
          throw new Error('clientId required');
        })(),
      name: 'Test project',
      status: 'active',
      ...overrides,
    },
  });
}
```

The factory expects `userId` and `clientId` to be supplied (a project without an owner is meaningless); other fields default. Tests pass only the fields they care about, which makes the test read like a description of what is being tested.

IDs are cuid (Prisma generates them). Tests do not hard-code IDs because cuid means a re-run produces fresh IDs and the tests are still correct.

## Database

**Local.** A Postgres container (`docker compose up -d postgres`). The compose file lives at the repository root.

```yaml
# docker-compose.yml (excerpt)
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: middlemist
      POSTGRES_PASSWORD: middlemist
      POSTGRES_DB: middlemist_test
    ports:
      - '5433:5432'
    volumes:
      - middlemist_pg:/var/lib/postgresql/data
volumes:
  middlemist_pg: {}
```

The dev database (Neon branch or local Postgres on 5432) is separate from the test database (5433). Tests truncate aggressively; using the dev database for tests would lose work.

**CI.** A Postgres service container in the GitHub Actions workflow:

```yaml
# .github/workflows/ci.yml (excerpt)
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: middlemist
      POSTGRES_PASSWORD: middlemist
      POSTGRES_DB: middlemist_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 3s
      --health-retries 5
```

The schema is bootstrapped before tests:

```yaml
- name: Apply migrations
  run: pnpm prisma migrate deploy
  env:
    DATABASE_URL: postgresql://middlemist:middlemist@localhost:5432/middlemist_test
```

**Setup.** `tests/setup/db.ts` truncates tables in dependency order before each test. `vitest.config.ts` references it through `setupFiles`. The truncate is fast (small tables, no data growth); tests do not share state.

## Mocking

**Mocking is rare.** The default is to use the real thing. Real Postgres for repos. Real zod for schemas. The exceptions:

- **Email.** `sendEmail` is mocked at the module boundary in handler tests. Tests assert that `sendEmail` was called with the right `to`, `subject`, and template; tests do not actually send email. A small set of e2e tests against a Resend test-mode key verify the integration once per release.
- **Inngest send.** `inngest.send` is mocked at the module boundary in service tests; tests assert the event payload was emitted. The Inngest function handler tests run independently with the event payload as input.
- **External APIs.** `exchangerate.host` is mocked with a fixture response. The integration is exercised in a single e2e test that hits the real API.

Mocks use `vi.mock` from Vitest. The mocks live in `tests/mocks/`; tests import them at the top of the file.

```typescript
// tests/mocks/email.ts
import { vi } from 'vitest';

export const sendEmailMock = vi.fn();

vi.mock('@/lib/email/send', () => ({
  sendEmail: sendEmailMock,
}));
```

Dependency injection through service constructors is preferred where it reads cleanly. Where the dependency is a module-level export (as `sendEmail` is), `vi.mock` is the pragmatic answer.

## E2E golden path

A single test that walks through the v1 happy path:

1. Sign up.
2. Verify email (via a dev-mode token-fetch helper, not a real inbox).
3. Complete onboarding.
4. Create a client.
5. Create a project.
6. Draft a proposal.
7. Send the proposal (the test bypasses Inngest by waiting on the action's effect, not the email).
8. Open the proposal as a public viewer in a fresh browser context.
9. Accept the proposal.
10. Convert the proposal to a project (verify the project is created).
11. Log a time entry.
12. Issue an invoice.
13. Mark the invoice paid.

The test is one file (`tests/e2e/golden-path.spec.ts`). It runs against a Next.js dev server booted by Playwright with a dedicated test database. Total runtime ~2 minutes.

Two more e2e tests cover surface-specific flows that diverge from the golden path:

- `tests/e2e/public-proposal.spec.ts` — covers the public proposal view, the accept form, the typed signature, the audit row.
- `tests/e2e/portal-magic-link.spec.ts` — covers magic-link issuance, redemption, the seven-day session, and the revoke flow.

## Snapshot tests

Reserved for email template HTML. Each template renders with a fixture, the rendered HTML is snapshotted, and the test fails when the rendered output drifts. The snapshot includes the Cal.com-aligned typography (Inter and JetBrains Mono), the `{colors.primary}` `#111111` action button, and the brand mark — a regression that swaps a font or breaks a color is caught immediately.

```typescript
// src/lib/email/templates/__tests__/proposal-sent.test.ts
import { render } from "@react-email/render";
import { ProposalSentEmail } from "../proposal-sent";

it("renders proposal-sent with default content", async () => {
  const html = await render(
    <ProposalSentEmail
      freelancerName="CJ"
      freelancerBusinessName="CJ Jutba Studio"
      clientName="Acme"
      proposalTitle="Website redesign"
      viewLink="https://middlemist.app/p/abc"
      validUntil={new Date("2026-05-15T00:00:00Z")}
    />
  );
  expect(html).toMatchSnapshot();
});
```

Snapshots are reviewed in PR. A snapshot diff that includes more than a date change requires explicit approval — accidental snapshot acceptance is the failure mode this test guards against.

## Running tests

```bash
pnpm test                # vitest single-run (CI mode)
pnpm test:watch          # vitest watch mode (local development)
pnpm test:e2e            # playwright (boots dev server)
pnpm test:coverage       # vitest --coverage
```

Local development typically runs `pnpm test:watch` in a side terminal while editing. CI runs `pnpm test` and `pnpm test:e2e` (the latter nightly on `main` rather than per PR; see `docs/ops/ci-cd.md`).
