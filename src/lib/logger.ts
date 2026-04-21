import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

type LogLevel = "error" | "warn" | "info" | "debug";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogContext = Record<string, any> | unknown;

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
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
      JSON.stringify({
        level: "warn",
        message,
        context: typeof messageOrError === "string" ? context : { error: messageOrError },
        timestamp: new Date().toISOString(),
      })
    );
  },
  info: (message: string, context?: LogContext) => {
    if (!isDev) return;
    console.info(
      JSON.stringify({
        level: "info",
        message,
        context,
        timestamp: new Date().toISOString(),
      })
    );
  },
  debug: (message: string, context?: LogContext) => {
    if (!isDev) return;
    console.log(
      JSON.stringify({
        level: "debug",
        message,
        context,
        timestamp: new Date().toISOString(),
      })
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
