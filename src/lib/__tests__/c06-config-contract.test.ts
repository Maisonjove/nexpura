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

  it("sets `deploymentId` (not just `generateBuildId`) so x-deployment-id is emitted", () => {
    // The bug we fixed: pre-fix the config only had `generateBuildId`,
    // and Next.js does NOT emit `x-deployment-id` on responses unless
    // `deploymentId` is also set.
    expect(cfg).toMatch(/deploymentId\s*:/);
  });

  it("derives deploymentId from the same SHA-based token as NEXT_PUBLIC_BUILD_ID", () => {
    // Both must resolve to the same value or the comparison the client
    // performs is meaningless. They share VERCEL_GIT_COMMIT_SHA.slice(0,12).
    expect(cfg).toMatch(/deploymentId[\s\S]{0,200}?VERCEL_GIT_COMMIT_SHA[\s\S]{0,100}?slice\(0,\s*12\)/);
    expect(cfg).toMatch(
      /NEXT_PUBLIC_BUILD_ID[\s\S]{0,200}?VERCEL_GIT_COMMIT_SHA[\s\S]{0,100}?slice\(0,\s*12\)/,
    );
  });

  it("keeps `generateBuildId` (build-output identity) AND `deploymentId` (response-header identity)", () => {
    // generateBuildId controls the build artifact id (chunk filenames,
    // SW cache key); deploymentId controls the response header. Both
    // are required for the C-06 mechanism to work end-to-end. Neither
    // replaces the other.
    expect(cfg).toMatch(/generateBuildId\s*\(/);
    expect(cfg).toMatch(/deploymentId\s*:/);
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

  it("reads x-deployment-id (the canonical header Next emits with deploymentId)", () => {
    // The original implementation read x-deployment-id but the config
    // didn't set deploymentId, so the header was never emitted. With
    // both halves of the fix in place, the canonical header name
    // remains x-deployment-id — pin it here so a future refactor
    // doesn't silently drift.
    expect(banner).toMatch(
      /response\.headers\.get\(\s*["']x-deployment-id["']\s*\)/,
    );
  });
});
