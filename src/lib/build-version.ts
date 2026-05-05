/**
 * Single source of truth for the client-side deploy anchor.
 *
 * Per QA agent's C-06 verification ask (2026-05-05): "If client reads
 * from process.env.NEXT_PUBLIC_BUILD_ID and server reads from
 * process.env.VERCEL_GIT_COMMIT_SHA, you have two sources of truth and
 * the mismatch detection itself can be wrong."
 *
 * Verification 2026-05-05 caught that the original implementation read
 * a header (`x-deployment-id`) that Next.js doesn't emit unless the
 * `deploymentId` config is set. Setting it to a SHA-12 token broke
 * Vercel builds (NEXT_DEPLOYMENT_ID env conflict). Aligning client +
 * server on Vercel's native `NEXT_DEPLOYMENT_ID` was the only
 * structurally viable shape.
 *
 * Layers in the C-06 fix:
 *   - `next.config.ts > env.NEXT_PUBLIC_BUILD_ID = NEXT_DEPLOYMENT_ID`
 *     inlines Vercel's `dpl_xxx` into the client bundle at build time
 *   - server natively emits `x-nextjs-deployment-id: dpl_xxx` on RSC
 *     responses (Vercel does this; no `deploymentId` config needed)
 *   - `DeployVersionBanner` reads that header and compares against
 *     `getBuildVersion()` — both resolve to the same `dpl_xxx`
 *
 * Separate layer (NOT anchored to NEXT_DEPLOYMENT_ID):
 *   - `next.config.ts > generateBuildId` returns `build-<sha12>`
 *   - `public/sw.js > CACHE_VERSION` is set to `build-<sha12>` via
 *     scripts/inject-sw-version.mjs at build time
 * That layer is per-build-artifact (chunk filenames, SW cache key);
 * the skew-detection layer is per-Vercel-deploy. Different invariants,
 * intentionally different anchors.
 *
 * If `NEXT_PUBLIC_BUILD_ID` is empty (local dev without Vercel
 * context, or a preview without NEXT_DEPLOYMENT_ID wired through),
 * `getBuildVersion()` returns the empty string. Callers MUST treat
 * empty as "skip detection" — comparing empty-vs-empty would always
 * pass; comparing empty-vs-X would always fail. Both are wrong.
 * Skipping is correct.
 */
export const BUILD_VERSION: string = process.env.NEXT_PUBLIC_BUILD_ID ?? '';

export function getBuildVersion(): string {
  return BUILD_VERSION;
}

/** True iff we have a non-empty build version. Detection is meaningless without one. */
export function hasBuildVersion(): boolean {
  return BUILD_VERSION.length > 0;
}
