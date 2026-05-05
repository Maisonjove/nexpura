/**
 * Single source of truth for the deploy version.
 *
 * Per QA agent's C-06 verification ask (2026-05-05): "If client reads
 * from process.env.NEXT_PUBLIC_BUILD_ID and server reads from
 * process.env.VERCEL_GIT_COMMIT_SHA, you have two sources of truth and
 * the mismatch detection itself can be wrong."
 *
 * Both client and server import from here. The actual env var still
 * carries the value at runtime — this module is a thin resolver — but
 * any future change to the build-version source (e.g. switching from
 * VERCEL_GIT_COMMIT_SHA to a build-time-injected constant) only
 * touches this file.
 *
 * Layers anchored to this single SHA-12 token:
 *   - `next.config.ts > generateBuildId` (server-side; sets x-deployment-id)
 *   - `next.config.ts > env.NEXT_PUBLIC_BUILD_ID` (client-side; this resolver reads it)
 *   - `public/sw.js > CACHE_VERSION` (build-time injected via scripts/inject-sw-version.mjs)
 *   - `DeployVersionBanner` (client-side mismatch detection imports from here)
 *
 * If `NEXT_PUBLIC_BUILD_ID` is empty (local dev without git context, or
 * a preview without VERCEL_GIT_COMMIT_SHA wired through), `getBuildVersion()`
 * returns the empty string. Callers MUST treat empty as "skip detection"
 * — comparing empty-vs-empty would always pass; comparing empty-vs-X
 * would always fail. Both are wrong. Skipping is correct.
 */
export const BUILD_VERSION: string = process.env.NEXT_PUBLIC_BUILD_ID ?? '';

export function getBuildVersion(): string {
  return BUILD_VERSION;
}

/** True iff we have a non-empty build version. Detection is meaningless without one. */
export function hasBuildVersion(): boolean {
  return BUILD_VERSION.length > 0;
}
