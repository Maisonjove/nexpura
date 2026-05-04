/**
 * Capture-amplification alarm — SERVER-ONLY runtime instrumentation.
 *
 * Background:
 *   Sentry's PromiseBuffer caps at 100 events per request. A single
 *   request firing > 50 logger.error calls is itself a bug (likely a
 *   runaway loop) and is skating dangerously close to the silent-drop
 *   cliff at 100. We surface this at runtime via a Sentry breadcrumb
 *   the moment the count crosses 50, so the operator sees "this route
 *   fired 50+ logger.error in one call" attached to the (one) Sentry
 *   event that does land — without enforcement that breaks production.
 *
 * Why split out from logger.ts:
 *   logger.ts is imported by both server and client/edge contexts.
 *   AsyncLocalStorage is a node-only API. Importing
 *   `node:async_hooks` at the top of logger.ts breaks the Turbopack
 *   client/edge bundle ("Code generation for chunk item errored").
 *   This file is server-only and is only imported by sentry-flush.ts
 *   (which itself is server-only via withSentryFlush HOF). On import,
 *   we register an `incrementCaptureHook` callback on logger via
 *   `setIncrementCaptureHook` — logger calls the hook if set, no-op
 *   otherwise. That keeps the AsyncLocalStorage chain entirely on
 *   the server side.
 *
 * The counter is request-scoped via AsyncLocalStorage. The
 * withSentryFlush HOF is the boundary that calls
 * `runWithCaptureScope` to seed a fresh counter per request. Server
 * actions don't run inside the HOF, but their logger.error calls
 * increment the counter when one is set; if no scope is active
 * (e.g. called from a unit test or a non-instrumented entry point),
 * the increment is a silent no-op.
 *
 * The breadcrumb fires exactly ONCE per scope (we latch a
 * `firedAlarm` flag), so a request firing 51, 52, 53 ... captures
 * only emits the alarm at 50 — no spam.
 */

import * as Sentry from "@sentry/nextjs";
import { AsyncLocalStorage } from "node:async_hooks";
import { setIncrementCaptureHook } from "./logger";

interface CaptureScopeState {
  count: number;
  firedAlarm: boolean;
  tag?: string;
}

const CAPTURE_AMPLIFICATION_THRESHOLD = 50;

const captureScopeStorage = new AsyncLocalStorage<CaptureScopeState>();

/**
 * Run `fn` inside a fresh capture-amplification scope. Used by
 * `withSentryFlush` (and any other request-boundary HOF that wants
 * scoped capture instrumentation). Each call seeds a NEW scope state
 * — nested calls don't share counters.
 */
export function runWithCaptureScope<T>(
  fn: () => T,
  opts?: { tag?: string },
): T {
  const state: CaptureScopeState = {
    count: 0,
    firedAlarm: false,
    tag: opts?.tag,
  };
  return captureScopeStorage.run(state, fn);
}

/**
 * Test-only — read the active scope's state, or `undefined` if no
 * scope is active. Used by the unit test to assert the breadcrumb
 * fires exactly once after 50 logger.error calls.
 */
export function _getCaptureScopeStateForTesting(): CaptureScopeState | undefined {
  return captureScopeStorage.getStore();
}

function incrementCaptureCounterAndMaybeAlarm(): void {
  const state = captureScopeStorage.getStore();
  if (!state) return; // no scope — silent no-op (unit tests, scripts, etc.)
  state.count += 1;
  if (state.count >= CAPTURE_AMPLIFICATION_THRESHOLD && !state.firedAlarm) {
    state.firedAlarm = true;
    try {
      Sentry.addBreadcrumb({
        category: "capture-amplification",
        level: "warning",
        message:
          `logger.error fired ${state.count}+ times in a single request — ` +
          "Sentry PromiseBuffer caps at 100 events; events past the cap drop silently. " +
          "Likely a logger.error inside a hot loop. See CONTRIBUTING.md → 'Loop-shaped logger.error'.",
        data: {
          count: state.count,
          threshold: CAPTURE_AMPLIFICATION_THRESHOLD,
          tag: state.tag,
        },
      });
    } catch {
      // Sentry SDK failure: swallow — the breadcrumb is observability,
      // not control flow. Counter still increments so a subsequent
      // request boundary sees the high count via the scope state.
    }
  }
}

// Self-register the increment hook on logger when this module is
// imported. Server-only side effect — guarantees logger.error
// increments the counter when a scope is active. If this module
// isn't imported (client/edge bundle), logger's hook stays null and
// logger.error is a clean no-op for the alarm.
setIncrementCaptureHook(incrementCaptureCounterAndMaybeAlarm);
