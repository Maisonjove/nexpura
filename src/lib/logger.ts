import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

// Capture-amplification alarm — hook-based wiring.
//
// The alarm machinery (AsyncLocalStorage scope, Sentry breadcrumb on
// threshold cross) lives in src/lib/capture-amplification-alarm.ts —
// SERVER-ONLY because AsyncLocalStorage requires node:async_hooks.
//
// logger.ts is imported by both server and client/edge contexts.
// Importing node:async_hooks at the top of logger.ts breaks the
// Turbopack client/edge bundle. Hook-based wiring keeps logger.ts
// runtime-agnostic: the alarm module registers itself by calling
// `setIncrementCaptureHook` on import; logger.error calls the hook
// if set, no-op otherwise.
//
// Net behaviour:
//   - Server: capture-amplification-alarm imported from sentry-flush
//     → hook installed → counter increments → breadcrumb at 50.
//   - Client/edge: alarm module not imported → hook stays null →
//     logger.error skips the increment cleanly.

type IncrementCaptureHook = () => void;
let incrementCaptureHook: IncrementCaptureHook | null = null;

/**
 * Server-only registration entry point. Called from
 * src/lib/capture-amplification-alarm.ts on its import. Subsequent
 * logger.error calls invoke the registered hook to increment the
 * scoped counter + maybe-emit the breadcrumb.
 */
export function setIncrementCaptureHook(fn: IncrementCaptureHook): void {
  incrementCaptureHook = fn;
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

/**
 * Recursively redact emails inside an arbitrary value before it's sent to
 * Sentry's `extra` payload. Sentry stringifies its own way so we can't rely
 * on JSON.stringify-then-redact: object identity matters for the dashboard
 * UI, and a stringified blob is much harder to read. We walk strings only,
 * leaving non-string scalars + structure intact.
 *
 * No-op in dev so local debugging keeps full addresses (matches
 * `redactEmailsInText` semantics).
 *
 * Cycle-safe: tracks visited objects/arrays; on recurrence returns the
 * already-cloned reference so a self-referential context doesn't infinite
 * loop. Skips Error instances (Sentry handles those separately) and
 * function/symbol values.
 */
export function redactEmailsInContext(ctx: unknown): unknown {
  if (isDev) return ctx;
  const seen = new WeakMap<object, unknown>();
  function walk(value: unknown): unknown {
    if (typeof value === "string") return redactEmailsInText(value);
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") return value;
    // Errors get stringified by Sentry's own serializer; don't recurse in.
    if (value instanceof Error) return value;
    const cached = seen.get(value as object);
    if (cached !== undefined) return cached;
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      seen.set(value, out);
      for (const item of value) out.push(walk(item));
      return out;
    }
    const out: Record<string, unknown> = {};
    seen.set(value as object, out);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = walk((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return walk(ctx);
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
  // Email-redact the synthesized error message. The wrapped Error becomes the
  // Sentry event's `message` field which is indexed + searchable; a raw
  // customer email landing there would persist in Sentry storage indefinitely.
  const asString = typeof messageOrError === "string" ? messageOrError : JSON.stringify(messageOrError);
  return new Error(redactEmailsInText(asString));
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
      // Recursively redact any email strings inside the context payload before
      // it's handed to Sentry. The `extra` field gets indexed + persisted, so
      // a customer email here is just as bad as one in the message.
      const redactedExtra = redactEmailsInContext(entry.context);
      Sentry.captureException(toSentryError(messageOrError, context), {
        extra: (redactedExtra && typeof redactedExtra === "object") ? (redactedExtra as Record<string, unknown>) : { context: redactedExtra },
      });
      // Increment the per-request capture counter via the hook
      // registered by capture-amplification-alarm.ts (server-only).
      // Hook is null in client/edge contexts → no-op.
      incrementCaptureHook?.();
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
