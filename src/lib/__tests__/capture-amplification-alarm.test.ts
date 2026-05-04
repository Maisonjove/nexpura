/**
 * Unit test for the capture-amplification alarm in src/lib/logger.ts.
 *
 * Asserts that:
 *   1. Inside a request scope (`runWithCaptureScope`), 50+ logger.error
 *      calls trigger exactly ONE `Sentry.addBreadcrumb` invocation with
 *      category=capture-amplification.
 *   2. Subsequent logger.error calls (51, 52, ...) do NOT emit
 *      additional alarm breadcrumbs.
 *   3. logger.error calls OUTSIDE a scope are silent no-ops for the
 *      alarm path (they still capture the exception).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks so `vi.mock` runs before module evaluation. We replace
// @sentry/nextjs with stubs we can spy on. Sentry's actual SDK does
// network/transport setup we don't want to touch in unit tests.
const captureExceptionMock = vi.fn();
const addBreadcrumbMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  addBreadcrumb: addBreadcrumbMock,
  withScope: (cb: (scope: { setTag: () => void; setContext: () => void }) => void) =>
    cb({ setTag: () => {}, setContext: () => {} }),
}));

describe("capture-amplification alarm", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
    addBreadcrumbMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("fires exactly ONE breadcrumb when logger.error crosses 50 calls in a single request scope", async () => {
    const { logger } = await import("../logger");
    const { runWithCaptureScope, _getCaptureScopeStateForTesting } = await import("../capture-amplification-alarm");

    runWithCaptureScope(() => {
      // Fire 60 logger.error calls — well past the threshold of 50.
      for (let i = 0; i < 60; i++) {
        // eslint-disable-next-line local/no-logger-error-in-loop -- intentional: this test asserts that exactly this pattern fires the amplification breadcrumb.
        logger.error(`synthetic error #${i}`);
      }
      const state = _getCaptureScopeStateForTesting();
      expect(state).toBeDefined();
      expect(state?.count).toBe(60);
      expect(state?.firedAlarm).toBe(true);
    }, { tag: "test-route" });

    // Sentry.captureException fires once per logger.error call.
    expect(captureExceptionMock).toHaveBeenCalledTimes(60);
    // The amplification breadcrumb should fire EXACTLY once, the
    // first time the count crossed 50. Calls 51..60 must not emit.
    const ampCalls = addBreadcrumbMock.mock.calls.filter(
      ([arg]) => arg?.category === "capture-amplification",
    );
    expect(ampCalls).toHaveLength(1);
    const [breadcrumb] = ampCalls[0];
    expect(breadcrumb.category).toBe("capture-amplification");
    expect(breadcrumb.level).toBe("warning");
    expect(breadcrumb.data.count).toBe(50);
    expect(breadcrumb.data.threshold).toBe(50);
    expect(breadcrumb.data.tag).toBe("test-route");
  });

  it("does NOT fire breadcrumb if count stays below threshold", async () => {
    const { logger } = await import("../logger");
    const { runWithCaptureScope } = await import("../capture-amplification-alarm");

    runWithCaptureScope(() => {
      for (let i = 0; i < 49; i++) {
        // eslint-disable-next-line local/no-logger-error-in-loop -- intentional: this test asserts the alarm does NOT fire below threshold.
        logger.error(`synthetic error #${i}`);
      }
    });

    expect(captureExceptionMock).toHaveBeenCalledTimes(49);
    const ampCalls = addBreadcrumbMock.mock.calls.filter(
      ([arg]) => arg?.category === "capture-amplification",
    );
    expect(ampCalls).toHaveLength(0);
  });

  it("logger.error outside any scope still captures the exception but emits no alarm", async () => {
    const { logger } = await import("../logger");
    const { _getCaptureScopeStateForTesting } = await import("../capture-amplification-alarm");

    // No scope active.
    expect(_getCaptureScopeStateForTesting()).toBeUndefined();

    for (let i = 0; i < 60; i++) {
      // eslint-disable-next-line local/no-logger-error-in-loop -- intentional: this test asserts that out-of-scope logger.error is silent for the alarm path.
      logger.error(`out-of-scope error #${i}`);
    }

    expect(captureExceptionMock).toHaveBeenCalledTimes(60);
    const ampCalls = addBreadcrumbMock.mock.calls.filter(
      ([arg]) => arg?.category === "capture-amplification",
    );
    expect(ampCalls).toHaveLength(0);
  });

  it("nested runWithCaptureScope calls keep separate counters", async () => {
    const { logger } = await import("../logger");
    const { runWithCaptureScope } = await import("../capture-amplification-alarm");

    runWithCaptureScope(() => {
      // eslint-disable-next-line local/no-logger-error-in-loop -- intentional: nested-scope test.
      for (let i = 0; i < 10; i++) logger.error(`outer #${i}`);
      runWithCaptureScope(() => {
        // eslint-disable-next-line local/no-logger-error-in-loop -- intentional: nested-scope test.
        for (let i = 0; i < 60; i++) logger.error(`inner #${i}`);
      }, { tag: "inner" });
      // Outer scope still has count=10, no alarm.
    }, { tag: "outer" });

    const ampCalls = addBreadcrumbMock.mock.calls.filter(
      ([arg]) => arg?.category === "capture-amplification",
    );
    // Inner alarm fired once; outer never crossed.
    expect(ampCalls).toHaveLength(1);
    expect(ampCalls[0][0].data.tag).toBe("inner");
  });
});
