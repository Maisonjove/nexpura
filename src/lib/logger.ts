const isDev = process.env.NODE_ENV === "development";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export const logger = {
  error: (message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level: "error",
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    // Always log errors but in structured format
    console.error(formatLog(entry));
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    if (!isDev) return;
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        context,
        timestamp: new Date().toISOString(),
      })
    );
  },
  info: (message: string, context?: Record<string, unknown>) => {
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
  debug: (message: string, context?: Record<string, unknown>) => {
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
