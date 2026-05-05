/**
 * Contract test for the C-06 config-level wiring that the original PR
 * missed (caught during the 2026-05-05 staging verification).
 *
 * The pre-fix shape relied on `generateBuildId` alone — but that does
 * NOT cause Next.js to emit the `x-deployment-id` response header
 * the client-side fetch interceptor reads. Only setting the separate
 * `deploymentId` config option does. Without it, the only deploy-
 * identifying header is Vercel's `x-nextjs-deployment-id: dpl_xxx`
 * (a Vercel ID, not the SHA-based token the client compares against).
 *
 * The original unit tests for `installDeployMismatchInterceptor` mocked
 * `x-deployment-id` directly, so they passed in isolation while the
 * production behaviour was non-functional. This test pins the config
 * surface so the gap can't recur.
 *
 * Plus: assert the POS page wires `useReloadBlocker` so a deploy
 * mid-sale doesn't drop the cart.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

function readRepo(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf8");
}

describe("C-06 next.config.ts — deployment-id surface", () => {
  const cfg = readRepo("next.config.ts");

  it("anchors NEXT_PUBLIC_BUILD_ID on Vercel's NEXT_DEPLOYMENT_ID env var", () => {
    // The bug we fixed (verification 2026-05-05): pre-fix derived
    // NEXT_PUBLIC_BUILD_ID from VERCEL_GIT_COMMIT_SHA, but the actual
    // server-emitted header (`x-nextjs-deployment-id`) carries the
    // Vercel-internal `dpl_xxx` token. The two never matched →
    // mismatch detection was non-functional. Anchoring both on
    // NEXT_DEPLOYMENT_ID makes the comparison resolve.
    expect(cfg).toMatch(/NEXT_PUBLIC_BUILD_ID\s*:\s*process\.env\.NEXT_DEPLOYMENT_ID/);
  });

  it("does NOT set an explicit `deploymentId` config (Vercel auto-injects)", () => {
    // First-pass fix tried `deploymentId: build-<sha12>` and Next
    // refused the build with "env value does not match config". Pin
    // the absence of explicit deploymentId here to prevent regressing
    // back to that shape.
    expect(cfg).not.toMatch(/^\s*deploymentId\s*:/m);
  });

  it("keeps `generateBuildId` (separate layer for the SW cache key)", () => {
    // generateBuildId stays — it owns the build artifact identity for
    // scripts/inject-sw-version.mjs. The skew-detection header surface
    // is intentionally a different anchor (Vercel-deploy-scoped).
    expect(cfg).toMatch(/generateBuildId\s*\(/);
  });
});

describe("C-06 POSClient — reload-blocker wiring", () => {
  const posClient = readRepo("src/app/(app)/pos/POSClient.tsx");

  it("imports useReloadBlocker from the canonical lib path", () => {
    expect(posClient).toMatch(
      /import\s*\{[^}]*\buseReloadBlocker\b[^}]*\}\s*from\s*["']@\/lib\/reload-blockers["']/,
    );
  });

  it("calls useReloadBlocker with the canonical 'pos-cart' name + a cart-non-empty predicate", () => {
    // The whole point: only block while cart has items. An empty cart
    // is safe to reload through. The predicate must be derived from
    // the cart state, not a static `true`.
    expect(posClient).toMatch(
      /useReloadBlocker\(\s*["']pos-cart["']\s*,\s*cart\.length\s*>\s*0\s*\)/,
    );
  });
});

describe("C-06 fetch interceptor — header-name regression guard", () => {
  const banner = readRepo("src/components/DeployVersionBanner.tsx");

  it("reads x-nextjs-deployment-id (the header Vercel/Next emit natively)", () => {
    // Verification 2026-05-05: the original code read `x-deployment-id`
    // but Vercel/Next don't emit that header without an explicit
    // `deploymentId` config (which conflicts with NEXT_DEPLOYMENT_ID).
    // The canonical header on a Vercel deploy is x-nextjs-deployment-id,
    // carrying the same `dpl_xxx` value that NEXT_DEPLOYMENT_ID is
    // injected as. Pin here so a future refactor doesn't silently drift.
    expect(banner).toMatch(
      /response\.headers\.get\(\s*["']x-nextjs-deployment-id["']\s*\)/,
    );
  });
});
