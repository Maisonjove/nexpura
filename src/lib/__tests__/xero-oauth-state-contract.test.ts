/**
 * CRIT-6 contract — Xero OAuth CSRF hardening.
 *
 * Locks in the two-file fix on /api/integrations/xero/(connect|callback):
 *
 *   connect:
 *     - signs a state blob containing tenantId + nonce + issuedAt with
 *       an HMAC secret derived from XERO_CLIENT_SECRET (reuses the
 *       shared signOAuthState helper).
 *     - sets an HttpOnly `xero_oauth_nonce` cookie before redirecting.
 *
 *   callback:
 *     - verifies the signed state (verifyOAuthState).
 *     - rejects missing/expired state or nonce-cookie mismatch.
 *     - rejects session-tenant != state-tenant.
 *     - clears the nonce cookie on every terminal path.
 *
 * Matches the Shopify pattern enforced in webhook-verification-contract.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
}

describe("CRIT-6 xero/connect — signed state + nonce cookie", () => {
  const src = readSrc("app/api/integrations/xero/connect/route.ts");

  it("imports the shared signOAuthState helper", () => {
    expect(src).toMatch(/import[\s\S]*?signOAuthState[\s\S]*?from\s*["']@\/lib\/webhook-security["']/);
  });

  it("builds the state from { tenantId, nonce, issuedAt }", () => {
    expect(src).toMatch(/signOAuthState\(\s*\{[\s\S]*?tenantId[\s\S]*?nonce[\s\S]*?issuedAt/);
  });

  it("derives the state secret from XERO_CLIENT_SECRET (namespaced)", () => {
    expect(src).toMatch(/XERO_CLIENT_SECRET/);
    expect(src).toMatch(/xero-oauth-state:/);
  });

  it("sets the xero_oauth_nonce cookie as HttpOnly + SameSite=Lax on redirect", () => {
    const cookieBlock = src.match(
      /cookies\.set\(\s*["']xero_oauth_nonce["'][\s\S]*?\)/
    )?.[0];
    expect(cookieBlock, "missing xero_oauth_nonce cookie set").toBeDefined();
    expect(cookieBlock!).toMatch(/httpOnly:\s*true/);
    expect(cookieBlock!).toMatch(/sameSite:\s*["']lax["']/);
  });

  it("does NOT still use the old unsigned random-UUID state shape", () => {
    // Old code: const state = crypto.randomUUID();
    expect(src).not.toMatch(/const\s+state\s*=\s*crypto\.randomUUID\(\)/);
  });
});

describe("CRIT-6 xero/callback — verify state, nonce, and tenant match", () => {
  const src = readSrc("app/api/integrations/xero/callback/route.ts");

  it("imports verifyOAuthState", () => {
    expect(src).toMatch(/verifyOAuthState/);
    expect(src).toMatch(/from\s*["']@\/lib\/webhook-security["']/);
  });

  it("rejects when the state query param is missing", () => {
    expect(src).toMatch(/if\s*\(\s*!state\s*\)/);
    expect(src).toMatch(/missing_state/);
  });

  it("verifies the signed state and rejects invalid/expired ones", () => {
    expect(src).toMatch(/verifyOAuthState<\s*\{[\s\S]*?tenantId[\s\S]*?nonce[\s\S]*?issuedAt[\s\S]*?\}\s*>/);
    expect(src).toMatch(/invalid_state/);
    expect(src).toMatch(/state_expired/);
  });

  it("reads and constant-time-compares the xero_oauth_nonce cookie", () => {
    expect(src).toMatch(/cookies\.get\(\s*["']xero_oauth_nonce["']/);
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).toMatch(/nonce_mismatch/);
  });

  it("rejects when the session tenant does not match the state tenant", () => {
    expect(src).toMatch(/sessionTenantId\s*!==\s*decoded\.tenantId/);
    expect(src).toMatch(/tenant_mismatch/);
  });

  it("clears the xero_oauth_nonce cookie on every terminal path", () => {
    // The helper is called clearNonceCookie in the implementation.
    expect(src).toMatch(/function\s+clearNonceCookie/);
    // Every NextResponse.redirect inside the handler should go through
    // clearNonceCookie() except the early rate-limit bail (which the
    // browser hasn't reached the auth flow for yet).
    const redirects = src.match(/NextResponse\.redirect\([\s\S]*?\)/g) ?? [];
    // At least all the error+success paths inside the try block use it.
    const usesClear = src.match(/clearNonceCookie\(/g) ?? [];
    expect(usesClear.length).toBeGreaterThanOrEqual(redirects.length - 2);
  });
});
