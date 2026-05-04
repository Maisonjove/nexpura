import * as Sentry from "@sentry/nextjs";
import { AsyncLocalStorage } from "node:async_hooks";

const isDev = process.env.NODE_ENV === "development";

// Capture-amplification alarm (post-Phase-2 cleanup, see CONTRIBUTING.md
// item 3 → "Post-Phase-2 cleanup additions"):
//
// Sentry's PromiseBuffer caps at 100 events per request. A single
// request firing > 50 logger.error calls is itself a bug (likely a
// runaway loop) and is skating dangerously close to the silent-drop
// cliff at 100. We surface this at runtime via a Sentry breadcrumb
// the moment the count crosses 50, so the operator sees "this route
// fired 50+ logger.error in one call" attached to the (one) Sentry
// event that does land — without enforcement that breaks production.
//
// The counter is request-scoped via AsyncLocalStorage. The
// withSentryFlush HOF is the boundary that calls `runWithCaptureScope`
// to seed a fresh counter per request. Server actions don't run inside
// the HOF, but their logger.error calls increment the counter when one
// is set; if no scope is active (e.g. called from a unit test or a
// non-instrumented entry point), the increment is a silent no-op.
//
// The breadcrumb fires exactly ONCE per scope (we latch a `firedAlarm`
// flag), so a request firing 51, 52, 53 ... captures only emits the
// alarm at 50 — no spam.

interface CaptureScopeState {
  count: number;
  firedAlarm: boolean;
  tag?: string;
}

const CAPTURE_AMPLIFICATION_THRESHOLD = 50;

// Module-level — survives across handler boundaries. Each
// withSentryFlush wrap calls `.run()` to seed a fresh state object for
// that request's async chain.
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

type LogLevel = "error" | "warn" | "info" | "debug";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogContext = Record<string, any> | unknown;

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
}

// Redact email addresses from the log line before it leaves the process.
// Customer emails were previously landing in Vercel logs via calls like
//   logger.info(`[tracking] Sent to ${order.customer_email}`)
//   logger.error("Failed to send invite email:", emailError)  // err contains the address
// Keeping the domain preserves the signal for debugging (per-domain
// bounce patterns, DNS config issues) without leaking the individual
// mailbox. No-op in dev so local debugging still shows full addresses.
const EMAIL_RE = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
function redactEmailsInText(s: string): string {
  if (isDev) return s;
  return s.replace(EMAIL_RE, "***@$2");
}

function formatLog(entry: LogEntry): string {
  return redactEmailsInText(JSON.stringify(entry));
}

// Pick the best thing to hand Sentry.captureException — it wants an Error
// instance. Strings + plain objects get wrapped so the stack trace in Sentry
// points at the caller of logger.error, not deep inside a helper.
function toSentryError(messageOrError: unknown, context?: LogContext): Error {
  if (messageOrError instanceof Error) return messageOrError;
  if (context && typeof context === "object" && "error" in context && (context as { error: unknown }).error instanceof Error) {
    return (context as { error: Error }).error;
  }
  const asString = typeof messageOrError === "string" ? messageOrError : JSON.stringify(messageOrError);
  return new Error(asString);
}

export const logger = {
  error: (messageOrError: string | unknown, context?: LogContext) => {
    const message = typeof messageOrError === "string"
      ? messageOrError
      : messageOrError instanceof Error
        ? messageOrError.message
        : String(messageOrError);
    const entry: LogEntry = {
      level: "error",
      message,
      context: typeof messageOrError === "string" ? context : { error: messageOrError, ...((context as object) || {}) },
      timestamp: new Date().toISOString(),
    };
    // Always log errors but in structured format
    console.error(formatLog(entry));
    // Forward to Sentry so server-side errors from route handlers / actions /
    // webhooks show up in the same dashboard as client-side ones. This is the
    // one path that makes every existing logger.error site (stripe webhook,
    // intake flows, etc.) also page Sentry — no further per-file changes.
    // Wrapped in try so a Sentry SDK failure can never break the caller.
    try {
      Sentry.captureException(toSentryError(messageOrError, context), {
        extra: (entry.context && typeof entry.context === "object") ? (entry.context as Record<string, unknown>) : { context: entry.context },
      });
      // Increment the per-request capture counter; emits a single
      // breadcrumb when the count crosses CAPTURE_AMPLIFICATION_THRESHOLD.
      // No-op outside an active request scope.
      incrementCaptureCounterAndMaybeAlarm();
    } catch {
      // Sentry init failures / DSN missing: swallow — the console line above
      // is already persisted to Vercel logs.
    }
  },
  warn: (messageOrError: string | unknown, context?: LogContext) => {
    const message = typeof messageOrError === "string"
      ? messageOrError
      : messageOrError instanceof Error
        ? messageOrError.message
        : String(messageOrError);
    console.warn(
      redactEmailsInText(JSON.stringify({
        level: "warn",
        message,
        context: typeof messageOrError === "string" ? context : { error: messageOrError },
        timestamp: new Date().toISOString(),
      }))
    );
  },
  info: (message: string, context?: LogContext) => {
    if (!isDev) return;
    console.info(
      redactEmailsInText(JSON.stringify({
        level: "info",
        message,
        context,
        timestamp: new Date().toISOString(),
      }))
    );
  },
  debug: (message: string, context?: LogContext) => {
    if (!isDev) return;
    console.log(
      redactEmailsInText(JSON.stringify({
        level: "debug",
        message,
        context,
        timestamp: new Date().toISOString(),
      }))
    );
  },
};

/**
 * Report a server-side error from a specific callsite. Use in route handler
 * / server action catch blocks instead of raw console.error so the error:
 *   - lands in Vercel logs as structured JSON
 *   - pages Sentry with a stable tag for grouping + alerting
 *
 * Example:
 *   catch (err) { reportServerError("bespoke/milestones:POST", err); ... }
 *
 * The tag becomes a Sentry tag (searchable), so you can filter / alert on
 * a specific handler without string-matching stack traces.
 */
export function reportServerError(
  tag: string,
  err: unknown,
  extra?: Record<string, unknown>,
) {
  // withScope pushes a scoped copy so the `handler` tag attaches to exactly
  // the captureException inside logger.error (which runs synchronously in
  // this callback). No double-report — logger.error issues the single Sentry
  // event; the scope just enriches it.
  try {
    Sentry.withScope((scope) => {
      scope.setTag("handler", tag);
      if (extra) scope.setContext("extra", extra);
      logger.error(err instanceof Error ? err : new Error(String(err)), { tag, ...(extra ?? {}) });
    });
  } catch {
    // Sentry init failure — fall back to the structured log line only.
    logger.error(err instanceof Error ? err : new Error(String(err)), { tag, ...(extra ?? {}) });
  }
}

export default logger;
