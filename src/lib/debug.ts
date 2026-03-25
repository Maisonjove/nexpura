import logger from "@/lib/logger";
/**
 * Debug logging utility - only logs in development
 */
const isDev = process.env.NODE_ENV === "development";

export const debug = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors, but prefix in production
    logger.error(args[0] as string, args.length > 1 ? { details: args.slice(1) } : undefined);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args);
  },
};

export default debug;
