/**
 * Unit test for Sentry email redaction in src/lib/logger.ts.
 *
 * Logger.ts already redacts emails in the structured console line via
 * `redactEmailsInText`, but two paths previously slipped raw emails into
 * Sentry storage:
 *   1. `toSentryError` synthesizes an Error from a stringified payload —
 *      that string can contain emails which then become the indexed
 *      Sentry event message.
 *   2. `Sentry.captureException(..., { extra })` was passed `entry.context`
 *      raw — any email in a nested string field landed in the Sentry
 *      event's `extra` payload (also indexed/persisted).
 *
 * Asserts that in production-mode imports:
 *   - Email in messageOrError → redacted in the Error wrapper handed to
 *     captureException.
 *   - Email in nested context fields → recursively redacted in `extra`.
 *
 * Asserts that in dev-mode imports:
 *   - Both pass through unchanged (matches existing dev-no-op behaviour).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();
const addBreadcrumbMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  addBreadcrumb: addBreadcrumbMock,
  withScope: (cb: (scope: { setTag: () => void; setContext: () => void }) => void) =>
    cb({ setTag: () => {}, setContext: () => {} }),
}));

describe("logger email redaction → Sentry payload", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
    addBreadcrumbMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("production mode", () => {
    it("redacts emails embedded in a string error message", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { logger } = await import("../logger");

      logger.error("Failed to send invite to alice@example.com — bounce");

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      const wrappedErr = captureExceptionMock.mock.calls[0][0] as Error;
      expect(wrappedErr).toBeInstanceOf(Error);
      // Mailbox part must be masked, domain preserved for debugging signal.
      expect(wrappedErr.message).not.toContain("alice@example.com");
      expect(wrappedErr.message).toContain("***@example.com");
    });

    it("redacts emails recursively inside the context object passed as Sentry `extra`", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { logger } = await import("../logger");

      logger.error("delivery failure", {
        tag: "email-worker",
        recipient: "bob@customer.com",
        nested: {
          chain: ["root@a.com", "alias-of-bob@customer.com"],
          deep: { admin: "ops@nexpura.com" },
        },
      });

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      const opts = captureExceptionMock.mock.calls[0][1] as { extra: Record<string, unknown> };
      const extraJson = JSON.stringify(opts.extra);
      // No raw mailbox makes it into the indexed payload.
      expect(extraJson).not.toContain("bob@customer.com");
      expect(extraJson).not.toContain("root@a.com");
      expect(extraJson).not.toContain("alias-of-bob@customer.com");
      expect(extraJson).not.toContain("ops@nexpura.com");
      // Domain part survives.
      expect(extraJson).toContain("***@customer.com");
      expect(extraJson).toContain("***@a.com");
      expect(extraJson).toContain("***@nexpura.com");
      // Non-email scalar untouched.
      expect(extraJson).toContain('"tag":"email-worker"');
    });

    it("redacts emails when payload is a non-Error object (JSON.stringify path of toSentryError)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { logger } = await import("../logger");

      logger.error({ kind: "stripe-bounce", customer: "carol@biller.com" });

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      const wrappedErr = captureExceptionMock.mock.calls[0][0] as Error;
      expect(wrappedErr.message).not.toContain("carol@biller.com");
      expect(wrappedErr.message).toContain("***@biller.com");
    });
  });

  describe("development mode (no-op)", () => {
    it("passes emails through unchanged in the Error wrapper", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const { logger } = await import("../logger");

      logger.error("Failed to send invite to alice@example.com — bounce");

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      const wrappedErr = captureExceptionMock.mock.calls[0][0] as Error;
      expect(wrappedErr.message).toContain("alice@example.com");
    });

    it("passes nested context emails through unchanged in Sentry `extra`", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const { logger } = await import("../logger");

      logger.error("delivery failure", {
        recipient: "bob@customer.com",
        nested: { admin: "ops@nexpura.com" },
      });

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      const opts = captureExceptionMock.mock.calls[0][1] as { extra: Record<string, unknown> };
      const extraJson = JSON.stringify(opts.extra);
      expect(extraJson).toContain("bob@customer.com");
      expect(extraJson).toContain("ops@nexpura.com");
    });
  });

  describe("redactEmailsInContext — direct unit checks", () => {
    it("is cycle-safe (a self-referential context does not infinite loop)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { redactEmailsInContext } = await import("../logger");
      type Cyclic = { email: string; self?: Cyclic };
      const ctx: Cyclic = { email: "loop@example.com" };
      ctx.self = ctx;
      const out = redactEmailsInContext(ctx) as Cyclic;
      expect(out.email).toBe("***@example.com");
      // Cycle preserved as the same already-cloned reference, not a new walk.
      expect(out.self).toBe(out);
    });

    it("leaves Error instances untouched (Sentry handles them separately)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { redactEmailsInContext } = await import("../logger");
      const err = new Error("eve@evil.com — bounced");
      const out = redactEmailsInContext({ error: err }) as { error: Error };
      expect(out.error).toBe(err);
      expect(out.error.message).toBe("eve@evil.com — bounced");
    });
  });
});
