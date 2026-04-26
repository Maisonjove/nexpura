import { describe, it, expect } from "vitest";
import { isReservedScannerBaitPath } from "../reserved-scanner-bait";

/**
 * QA-002 (Low) regression coverage.
 *
 * The Phase 4 security audit found that arbitrary first-segment paths on the
 * apex domain (e.g. `/.env`, `/.git/config`, `/swagger`, `/openapi.json`,
 * `/package.json`, `/next.config.ts`, `/.DS_Store`, `/server-status`)
 * were caught by the catch-all `(shop)/[subdomain]/page.tsx` and rendered
 * the marketing not-found UI with HTTP 200 — a soft-404. This test pins
 * the reserved-name guard so a future refactor can't silently drop any of
 * the probe paths from the deny list.
 *
 * Note: this is a pure-function unit test against the predicate; the
 * middleware uses it to short-circuit with a real 404 NextResponse. The
 * predicate's contract is what matters for soft-404 prevention.
 */

describe("isReservedScannerBaitPath", () => {
  describe("dotfile paths (any first segment starting with '.')", () => {
    const dotfilePaths = [
      "/.env",
      "/.env.local",
      "/.env.production",
      "/.git/config",
      "/.git/HEAD",
      "/.git",
      "/.DS_Store",
      "/.htaccess",
      "/.aws/credentials",
      "/.npmrc",
      "/.vscode/settings.json",
    ];
    it.each(dotfilePaths)("flags %s as reserved", (path) => {
      expect(isReservedScannerBaitPath(path)).toBe(true);
    });
  });

  describe("scanner-bait literal filenames", () => {
    const probePaths = [
      "/package.json",
      "/package-lock.json",
      "/pnpm-lock.yaml",
      "/yarn.lock",
      "/next.config.ts",
      "/next.config.js",
      "/next.config.mjs",
      "/vercel.json",
      "/swagger",
      "/swagger.json",
      "/openapi.json",
      "/openapi.yaml",
      "/server-status",
      "/backup.zip",
      "/backup.tar.gz",
      "/config.json",
      "/composer.json",
      "/Gemfile",
      "/requirements.txt",
      "/web.config",
      "/wp-admin",
      "/wp-login.php",
      "/phpmyadmin",
    ];
    it.each(probePaths)("flags %s as reserved", (path) => {
      expect(isReservedScannerBaitPath(path)).toBe(true);
    });
  });

  describe("nested probe paths still match by first segment", () => {
    it("flags /swagger/v2/api-docs (first segment 'swagger')", () => {
      expect(isReservedScannerBaitPath("/swagger/v2/api-docs")).toBe(true);
    });
    it("flags /wp-admin/install.php", () => {
      expect(isReservedScannerBaitPath("/wp-admin/install.php")).toBe(true);
    });
  });

  describe("RFC 8615 .well-known exception", () => {
    it("does NOT flag /.well-known/security.txt (RFC 9116)", () => {
      expect(isReservedScannerBaitPath("/.well-known/security.txt")).toBe(false);
    });
    it("does NOT flag /.well-known/openid-configuration", () => {
      expect(isReservedScannerBaitPath("/.well-known/openid-configuration")).toBe(false);
    });
    it("does NOT flag bare /.well-known", () => {
      expect(isReservedScannerBaitPath("/.well-known")).toBe(false);
    });
  });

  describe("legitimate paths are NOT flagged", () => {
    const legitimatePaths = [
      "/",
      "/login",
      "/signup",
      "/dashboard",
      "/some-tenant",
      "/some-tenant/catalogue",
      "/api/health",
      "/pricing",
      "/features",
      "/billing",
      // Tenant slugs that look superficially weird but are valid [a-z0-9-]
      "/abc123",
      "/my-shop",
      // Static asset extensions (these go through middleware matcher exclusion
      // anyway, but the predicate itself shouldn't false-positive)
      "/og-image.png",
      "/manifest.json",
      "/sitemap.xml",
      "/robots.txt",
      "/favicon.ico",
    ];
    it.each(legitimatePaths)("does not flag %s", (path) => {
      expect(isReservedScannerBaitPath(path)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for empty path", () => {
      expect(isReservedScannerBaitPath("")).toBe(false);
    });
    it("returns false for root", () => {
      expect(isReservedScannerBaitPath("/")).toBe(false);
    });
    it("handles repeated leading slashes", () => {
      expect(isReservedScannerBaitPath("//.env")).toBe(true);
      expect(isReservedScannerBaitPath("///swagger")).toBe(true);
    });
  });
});
