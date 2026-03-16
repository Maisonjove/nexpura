/**
 * src/middleware.ts — Next.js middleware entry point
 *
 * Wires the proxy (session refresh + review-mode sandbox injection + subscription check)
 * as the actual Next.js middleware.
 *
 * Previously this was deleted in a conflict resolution — that removed all middleware
 * execution, breaking the ?rt=nexpura-review-2026 sandbox injection entirely.
 */
export { proxy as default, config } from "./proxy";
