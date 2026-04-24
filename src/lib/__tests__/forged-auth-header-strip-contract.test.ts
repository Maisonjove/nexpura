import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Locks in the middleware strip of inbound x-auth-* headers.
 *
 * The app's `getAuthContext()` fast-path in src/lib/auth-context.ts reads
 *   headersList.get("x-auth-user-id")
 *   headersList.get("x-auth-tenant-id")
 *   headersList.get("x-auth-user-role")
 *   headersList.get("x-auth-user-email")
 * assuming middleware set them from a verified session. Without an
 * inbound-header scrub in middleware.ts, an attacker can forge those
 * headers on any request; routes short-circuited through isPublicPath
 * ("/api/**" falls into that branch) would then see a forged tenantId
 * and treat the caller as a member of that tenant.
 *
 * This test asserts, statically, that middleware.ts scrubs all four
 * headers before any branching, and that the scrubbed request is used
 * on the timeout/uncaught-error fallback path too.
 */

const middlewareSource = readFileSync(
  join(__dirname, "..", "..", "..", "middleware.ts"),
  "utf8",
);

describe("middleware — forged x-auth-* header strip", () => {
  it("declares a FORGEABLE_AUTH_HEADERS list", () => {
    expect(middlewareSource).toMatch(/FORGEABLE_AUTH_HEADERS\s*=/);
  });

  it("lists all 4 auth header names in the strip list", () => {
    for (const name of [
      "x-auth-user-id",
      "x-auth-tenant-id",
      "x-auth-user-role",
      "x-auth-user-email",
    ]) {
      expect(middlewareSource).toContain(`"${name}"`);
    }
  });

  it("defines stripForgedAuthHeaders that returns a NextRequest", () => {
    expect(middlewareSource).toMatch(
      /function\s+stripForgedAuthHeaders\s*\(\s*request:\s*NextRequest\s*\)\s*:\s*NextRequest/,
    );
  });

  it("strip function uses Headers.delete for each forgeable header", () => {
    expect(middlewareSource).toMatch(/sanitized\.delete\(/);
  });

  it("middleware() scrubs BEFORE the CSRF gate and main pipeline", () => {
    // The scrubbed binding must be declared before the try-block.
    const idxScrub = middlewareSource.indexOf(
      "const scrubbed = stripForgedAuthHeaders(request);",
    );
    const idxCsrf = middlewareSource.indexOf("enforceApiCsrf(scrubbed)");
    const idxInner = middlewareSource.indexOf("_proxyInner(scrubbed)");
    expect(idxScrub).toBeGreaterThan(-1);
    expect(idxCsrf).toBeGreaterThan(idxScrub);
    expect(idxInner).toBeGreaterThan(idxScrub);
  });

  it("middleware() does NOT pass the raw `request` to enforceApiCsrf or _proxyInner", () => {
    // These two call sites are the only ones that must forward the
    // scrubbed request. If either reverts to `request`, the scrub is
    // bypassed for all API / app routes.
    expect(middlewareSource).not.toMatch(/enforceApiCsrf\(request\)/);
    expect(middlewareSource).not.toMatch(/_proxyInner\(request\)/);
  });

  it("timeout/error fallback forwards the scrubbed request", () => {
    // On MIDDLEWARE_TIMEOUT or any uncaught throw, the fallback must
    // also use the scrubbed request — otherwise an attacker can
    // trigger a timeout (slow downstream) and have forged headers
    // slip through NextResponse.next().
    expect(middlewareSource).toMatch(
      /NextResponse\.next\(\s*\{\s*request:\s*scrubbed\s*\}\s*\)/,
    );
  });
});
