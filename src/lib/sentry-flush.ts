/**
 * Serverless Sentry flush helpers.
 *
 * Background — the bug class:
 *   `logger.error(...)` calls `Sentry.captureException` (see lib/logger.ts).
 *   In Vercel serverless, the SDK queues the event in a PromiseBuffer
 *   (@sentry/core/utils/promisebuffer.js) and a background task drains
 *   it. If the route handler / server action returns its response
 *   immediately after the logger.error call, the Lambda freezes before
 *   the buffer drains and the event never reaches Sentry. Confirmed
 *   experimentally via /api/qa-test/bespoke-wrap-probe (PR #137 + this
 *   PR's commit 90dfeba): without an explicit flush, the synthetic FK-
 *   violation logger.error never surfaced; with `await Sentry.flush()`
 *   it lands within ~2.5s.
 *
 * Why an explicit flush works:
 *   `Sentry.flush(timeout)` calls the transport's `drain(timeout)`,
 *   which `Promise.allSettled`s the entire pending buffer. So a single
 *   `await Sentry.flush(2000)` at end-of-handler drains every queued
 *   event from any number of in-handler logger.error calls. The 2000ms
 *   is a TIMEOUT not a fixed wait — empty buffers resolve immediately.
 *   Flush latency is ~ingest round-trip (~2-3s on a hit, <5ms on miss).
 *
 * Buffer cap caveat:
 *   The buffer cap is 100. If a single request fires 100+ logger.error
 *   calls, events 101+ are silently rejected with SENTRY_BUFFER_FULL_
 *   ERROR before flush can save them. Not a practical concern unless
 *   we hit a runaway loop; flagged here so future contributors know.
 *
 * Two helpers:
 *   - withSentryFlush: wrap a route handler export (NextRequest →
 *     Response/NextResponse). One wrap per export = one flush per
 *     request. The hard-to-forget pattern because the export shape
 *     itself changes.
 *   - flushSentry: inline `await flushSentry()` for server actions
 *     (whose `export async function X` declarations can't be HOF-
 *     wrapped without breaking React's RSC form-action bindings) and
 *     saga compensating-rollback catch blocks where flush needs to
 *     happen mid-function. Just a thin alias to keep the call-site
 *     intent self-documenting.
 *
 * See CONTRIBUTING.md → "Sentry serverless flush" for the rationale.
 */

import * as Sentry from "@sentry/nextjs";

import { runWithCaptureScope } from "./logger";

const FLUSH_TIMEOUT_MS = 2000;

// Use `any[]` for the args tuple because route handlers in App Router
// can have varied signatures: `(req)`, `(req, { params })`, or just
// `(req: Request)`. `unknown[]` would fail variance — TS won't pass a
// `(req: NextRequest) => ...` to a function expecting `(...args: unknown[])`
// because parameter positions are contravariant. `any[]` accepts any
// specific arg shape; the wrapper is identity-preserving via `as T`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (...args: any[]) => Promise<Response>;

export function withSentryFlush<T extends RouteHandler>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    // Seed a fresh capture-amplification scope per request. The HOF
    // is the canonical request boundary for route handlers — every
    // logger.error call inside the handler (or any code it awaits)
    // increments the same counter, and the first one to cross
    // CAPTURE_AMPLIFICATION_THRESHOLD emits a Sentry breadcrumb. See
    // logger.ts → runWithCaptureScope for the rationale.
    //
    // We derive a `tag` from the handler's source name when available
    // (helps the operator find which route blew the budget without
    // hand-correlating the breadcrumb to a stack trace).
    const tag = handler.name || undefined;
    return runWithCaptureScope(async () => {
      try {
        const response = await handler(...args);
        await Sentry.flush(FLUSH_TIMEOUT_MS);
        return response;
      } catch (err) {
        // Flush even on throw, so that the error captured by Next.js's
        // onRequestError hook (instrumentation.ts:18) plus any in-handler
        // logger.error calls before the throw both reach Sentry before
        // the Lambda freezes.
        await Sentry.flush(FLUSH_TIMEOUT_MS);
        throw err;
      }
    }, { tag });
  }) as T;
}

export async function flushSentry(): Promise<void> {
  await Sentry.flush(FLUSH_TIMEOUT_MS);
}
