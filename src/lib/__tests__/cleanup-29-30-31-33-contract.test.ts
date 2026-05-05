/**
 * Contract tests for post-audit cleanup batch #29–#33.
 *
 * Each block pins one of the four cleanup items so a future regression
 * (someone re-introducing the leak / dropping the helper / reverting
 * the rate-limit key / forking the error copy) breaks the build.
 *
 * Static-source-inspection style — same pattern as
 * src/lib/__tests__/auth-error-wording.test.ts. Avoids spinning up the
 * Next runtime, mocking Supabase clients, or stubbing checkRateLimit.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { toE164 } from "@/lib/twilio-whatsapp";

const ROOT = path.resolve(__dirname, "../../..");
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ───────────────────────────────────────────────────────────────────────
// #29 — google-calendar/push must not echo err.message to the client
// ───────────────────────────────────────────────────────────────────────
describe("#29 google-calendar/push — no err.message in 500 response", () => {
  const src = readSrc("src/app/api/integrations/google-calendar/push/route.ts");

  it("the terminal catch returns a generic copy, not err.message", () => {
    // Find the catch block at the end of the handler.
    const catchBlock = src.match(/} catch \(err\) \{[\s\S]*?\}\n\}\);/);
    expect(catchBlock).toBeTruthy();
    const body = catchBlock ? catchBlock[0] : "";
    // Strip line comments so the test scopes to live code, not the
    // explanatory comment that mentions err.message.
    const code = body.replace(/^\s*\/\/.*$/gm, "");
    // The pre-fix shape was `error: err instanceof Error ? err.message : ...`.
    // Hard-fail on any echo of err.message into the response payload —
    // logger.error(..., { error: err }) is fine (server-side only).
    expect(code).not.toMatch(/err\.message/);
    // Locate the NextResponse.json(...) call in the catch and confirm
    // it doesn't reach into err at all.
    const responseCall = code.match(/NextResponse\.json\([\s\S]*?\)/);
    expect(responseCall).toBeTruthy();
    expect(responseCall ? responseCall[0] : "").not.toMatch(/\berr\b/);
    // Confirm the generic copy is present in the live response body.
    expect(code).toContain('"Calendar sync failed"');
  });

  it("logs the full error server-side and flushes Sentry before returning", () => {
    expect(src).toContain('logger.error("[google-calendar/push] failed"');
    expect(src).toContain("flushSentry");
    // flushSentry must be imported from sentry-flush, not redefined.
    expect(src).toMatch(/from\s+["']@\/lib\/sentry-flush["']/);
  });

  it("preserves 4xx vs 5xx discrimination (status codes intact)", () => {
    // The route still has explicit 400 / 404 / 500 status codes for
    // the different validation failure modes — we're only changing the
    // body of the terminal 500 catch.
    expect(src).toMatch(/status:\s*400/);
    expect(src).toMatch(/status:\s*404/);
    expect(src).toMatch(/status:\s*500/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// #30 — toE164 normalizer behaviour
// ───────────────────────────────────────────────────────────────────────
describe("#30 toE164 — AU-default phone normalization", () => {
  it("passes through a clean E.164 unchanged", () => {
    expect(toE164("+61412345678")).toBe("+61412345678");
  });

  it("strips spaces, dashes, parens, dots", () => {
    expect(toE164("+61 412 345 678")).toBe("+61412345678");
    expect(toE164("+61-412-345-678")).toBe("+61412345678");
    expect(toE164("+61 (412) 345.678")).toBe("+61412345678");
  });

  it("treats a leading '00' as the international prefix", () => {
    expect(toE164("0061412345678")).toBe("+61412345678");
    expect(toE164("00 61 412 345 678")).toBe("+61412345678");
  });

  it("treats a leading '0' as AU trunk and prepends +61", () => {
    expect(toE164("0412 345 678")).toBe("+61412345678");
    expect(toE164("0412345678")).toBe("+61412345678");
  });

  it("trusts an already-country-coded number with no '+'", () => {
    expect(toE164("61412345678")).toBe("+61412345678");
  });

  it("prefixes AU country code on a bare local number with no leading 0", () => {
    expect(toE164("412345678")).toBe("+61412345678");
  });

  it("returns null for empty / nullish input", () => {
    expect(toE164("")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
    expect(toE164("   ")).toBeNull();
  });

  it("returns null for clearly-too-short input", () => {
    expect(toE164("12")).toBeNull();
    expect(toE164("+1")).toBeNull();
  });

  it("returns null for absurdly-long digit strings", () => {
    expect(toE164("+1234567890123456789")).toBeNull();
  });

  it("returns null when the input has no digits at all", () => {
    expect(toE164("not-a-number")).toBeNull();
    expect(toE164("()-")).toBeNull();
  });

  it("is wired into sendTwilioWhatsApp before the Twilio API call", () => {
    const src = readSrc("src/lib/twilio-whatsapp.ts");
    // The send function must call toE164 and throw on null — pre-fix it
    // just stuck a "+" on the front.
    expect(src).toMatch(/toE164\(to\)/);
    expect(src).toMatch(/Invalid phone format:/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// #31 — whatsapp setup + test rate-limit must key on tenant_id
// ───────────────────────────────────────────────────────────────────────
describe("#31 whatsapp setup/test — rate-limit keyed on tenant_id, not just IP", () => {
  const setupSrc = readSrc(
    "src/app/api/integrations/whatsapp/setup/route.ts",
  );
  const testSrc = readSrc(
    "src/app/api/integrations/whatsapp/test/route.ts",
  );

  it("/setup builds the rate key via a tenant resolver, not raw IP", () => {
    // checkRateLimit must NOT receive `ip` as its first arg directly —
    // pre-fix shape was `checkRateLimit(ip, "api")`. Post-fix is
    // `checkRateLimit(rateKey, "api")` where rateKey came from a
    // tenant-aware helper.
    expect(setupSrc).toMatch(/checkRateLimit\(rateKey,\s*"api"\)/);
    expect(setupSrc).not.toMatch(/checkRateLimit\(ip,\s*"api"\)/);
    expect(setupSrc).toMatch(/resolveTenantRateKey/);
  });

  it("/test builds the rate key via a tenant resolver, not raw IP", () => {
    expect(testSrc).toMatch(/checkRateLimit\(rateKey,\s*"api"\)/);
    expect(testSrc).not.toMatch(/checkRateLimit\(ip,\s*"api"\)/);
    expect(testSrc).toMatch(/resolveTenantRateKey/);
  });

  it("the resolver consults supabase.auth.getUser → users.tenant_id", () => {
    // Both files must contain the same lookup pattern as
    // src/app/api/billing/portal/route.ts.
    for (const src of [setupSrc, testSrc]) {
      expect(src).toMatch(/supabase\.auth\.getUser\(\)/);
      expect(src).toMatch(/from\(["']users["']\)/);
      expect(src).toMatch(/tenant_id/);
      // tenant: prefix on the bucket key — keeps the bucket isolated
      // from any IP fallback bucket so a tenant can't burn IP quota
      // and vice versa.
      expect(src).toMatch(/`tenant:\$\{[^}]+\}`/);
      // Falls back to ip-prefixed key when no auth context.
      expect(src).toMatch(/`ip:\$\{[^}]+\}`/);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────
// #33 — billing/invoices and billing/portal share the same RBAC copy
// ───────────────────────────────────────────────────────────────────────
describe("#33 billing — invoices + portal share the same owner-only error string", () => {
  const SHARED =
    "Only the tenant owner can manage billing.";

  const invoicesSrc = readSrc("src/app/api/billing/invoices/route.ts");
  const portalSrc = readSrc("src/app/api/billing/portal/route.ts");

  it("/api/billing/invoices uses the unified copy and 403", () => {
    expect(invoicesSrc).toContain(SHARED);
    // Strip line comments before checking that "Owner only" is gone
    // from live code — the explanatory comment may still cite the
    // pre-fix string.
    const liveCode = invoicesSrc.replace(/^\s*\/\/.*$/gm, "");
    expect(liveCode).not.toMatch(/"Owner only"/);
    // 403 status preserved.
    expect(invoicesSrc).toMatch(/status:\s*403/);
  });

  it("/api/billing/portal still uses the unified copy and 403", () => {
    expect(portalSrc).toContain(SHARED);
    expect(portalSrc).toMatch(/status:\s*403/);
  });

  it("the two routes return identical string copy on this RBAC failure", () => {
    // Belt-and-braces: count occurrences in each file. Both should
    // have at least one. (More than one is fine — a comment may
    // reference the string.)
    expect(invoicesSrc.split(SHARED).length - 1).toBeGreaterThanOrEqual(1);
    expect(portalSrc.split(SHARED).length - 1).toBeGreaterThanOrEqual(1);
  });
});
