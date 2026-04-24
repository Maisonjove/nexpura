import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contract test: the middleware CSRF gate must be wired and cover the
 * right set of routes. Audit finding (High): 134+ mutating API routes
 * did not validate origin. The fix added a middleware-level gate.
 *
 * Static analysis — the tests below read middleware.ts and assert that
 * the enforcer exists, is called before the main pipeline, and has the
 * right exemptions.
 */

const middleware = fs.readFileSync(
  path.resolve(__dirname, "../../../middleware.ts"),
  "utf8",
);

describe("CSRF middleware gate (HIGH: fixes the missing per-route validator)", () => {
  it("defines the CSRF enforcement function", () => {
    expect(middleware).toMatch(/function enforceApiCsrf\(/);
  });

  it("is called before the main pipeline", () => {
    // Forged x-auth-* header strip landed (commit on branch) and both
    // call sites now forward the scrubbed NextRequest. Accept either
    // variable name so the test survives that refactor.
    const enforceIdx = Math.max(
      middleware.indexOf("enforceApiCsrf(request)"),
      middleware.indexOf("enforceApiCsrf(scrubbed)"),
    );
    const proxyIdx = Math.max(
      middleware.indexOf("_proxyInner(request)"),
      middleware.indexOf("_proxyInner(scrubbed)"),
    );
    expect(enforceIdx).toBeGreaterThan(-1);
    expect(proxyIdx).toBeGreaterThan(-1);
    // enforcer call must precede _proxyInner call (measured by source order)
    expect(enforceIdx).toBeLessThan(proxyIdx);
  });

  it("exempts webhook routes (3rd-party HMAC-signed)", () => {
    expect(middleware).toMatch(/\/api\/webhooks\//);
  });

  it("exempts cron routes (Vercel Cron has no origin header)", () => {
    expect(middleware).toMatch(/\/api\/cron\//);
  });

  it("only enforces on mutating methods (POST/PUT/DELETE/PATCH)", () => {
    expect(middleware).toMatch(/isMutatingMethod/);
    expect(middleware).toMatch(/"POST"|POST/);
    expect(middleware).toMatch(/"PUT"|PUT/);
    expect(middleware).toMatch(/"DELETE"|DELETE/);
    expect(middleware).toMatch(/"PATCH"|PATCH/);
  });

  it("rejects with 403 when origin / referer does not match", () => {
    expect(middleware).toMatch(/status:\s*403/);
    expect(middleware).toMatch(/Invalid request origin/);
  });
});
