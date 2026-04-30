# 0004: Inngest vs BullMQ

**Date:** 2026-04-29
**Status:** Accepted

## Context

Middlemist has scheduled and event-driven work that must run outside the request-response cycle: daily FX rate refresh, hourly overdue invoice check, hourly invoice reminder dispatch, weekly audit log compaction, plus event-driven side effects (send email when proposal is sent, notify freelancer when client views, etc.). See `background-jobs.md` for the full inventory.

The two credible choices for this kind of work are:

- **Inngest**, a hosted serverless-native queue that integrates as a single HTTP endpoint and provides cron, event-driven functions, retries, step functions, and observability.
- **BullMQ**, an open-source Node.js queue backed by Redis with a long-running worker process.

The hosting context (Vercel) is decisive: Vercel does not run long-lived processes. Any worker-based architecture means hosting workers somewhere else.

## Decision

Use Inngest. Register cron and event-driven functions in `src/lib/inngest/functions/`. Expose the Inngest serve handler at `/api/inngest`. Use Inngest's step primitives for multi-step jobs and pass minimal IDs in event payloads (see `background-jobs.md`).

For local development, run `pnpm dlx inngest-cli@latest dev` to get the full event explorer and replay UI.

## Consequences

**Positive**

- Serverless-native. No worker process to host, no Redis to operate, no separate runtime. The Inngest service handles the scheduler and the dispatcher; Vercel runs the function bodies as ordinary serverless functions.
- Cron support is first-class. Schedule strings live next to the function definitions; there is no separate cron config file.
- Retry semantics are built in. A function that throws is retried per a configurable policy. Step primitives give fine-grained idempotency: each step's result is memoized so a retry skips completed steps.
- Observability is out of the box. The Inngest dashboard shows runs, failures, payloads, and retry history. Reproducing a failed run is one click.
- The free tier accommodates v1 volume comfortably (thousands of events per month, generous concurrency).

**Negative**

- Vendor dependency. If Inngest disappears, the cron and event handlers need to move. The mitigation is that the function bodies are ordinary code in `src/lib/inngest/functions/`; the trigger layer is the only thing that would change.
- Less control than self-hosted BullMQ. Backpressure, priority queues, custom retry curves: most of these are configurable in Inngest, but a few advanced patterns are easier in BullMQ.
- Cost scales with event volume. At v1 volume the free tier is enough; if a viral surge or a runaway loop produced millions of events, the bill would surface fast.
- Cold-start latency on the receiving Vercel function adds to total job time. Acceptable for the kinds of jobs Middlemist runs (none are time-critical to the second).

## Alternatives Considered

**BullMQ + Redis (self-hosted Redis or Upstash).** Familiar, mature, infinitely flexible. Rejected because it requires a long-running worker process that does not fit Vercel's runtime model. The author would need to host the worker on Railway or Render or Fly, which re-introduces the multi-service complexity that ADR 0002 deliberately avoids.

**Vercel Cron.** Vercel has built-in cron schedules that hit a Route Handler at a configured time. Free tier is limited; event-driven (non-cron) jobs are not supported and would need a separate solution. Inngest covers both with one tool.

**Cloud Tasks (GCP) or SQS + Lambda (AWS).** Both work but require provisioning and configuring cloud accounts that are otherwise not in the stack. Inngest is the simpler vendor surface for the same job.

**Trigger.dev.** Comparable to Inngest. Active development, similar serverless-native model. The choice between Trigger.dev and Inngest came down to author preference for Inngest's step model and dashboard UX. Either would have worked.

**Hand-rolled cron + DB queue table.** Use Vercel Cron to fire a Route Handler that polls a `Job` table and dispatches. Rejected because it reinvents the queue and gets the retry semantics wrong by default. The cost of building it correctly outweighs the cost of using Inngest.
