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

export default logger;
