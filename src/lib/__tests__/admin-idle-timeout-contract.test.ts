/**
 * Contract test for /admin idle-timeout enforcement.
 *
 * P2-A Item 6 layered a 30-minute sliding idle timeout onto the
 * super-admin platform surface, on top of the existing AAL2 cookie
 * checks. The middleware reads the cookie's iat via the new
 * `verifyAndExtractTwoFactorCookie` helper and enforces the timeout
 * locally — non-/admin paths continue to use `verifyTwoFactorCookie`
 * which preserves the 7-day sliding behaviour.
 *
 * This file pins the helper's behaviour so a future refactor of
 * `verifyTwoFactorCookie` can't silently drop the iat exposure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "0123456789abcdef0123456789abcdef"; // ≥16 chars

describe("verifyAndExtractTwoFactorCookie — idle-timeout contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXPURA_2FA_COOKIE_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns iat alongside valid=true for a fresh, well-signed cookie", async () => {
    const mod = await import("../auth/two-factor-cookie");
    const userId = "user-123";

    const before = Date.now();
    const signed = await mod.signTwoFactorCookie(userId);
    const after = Date.now();
    expect(signed).not.toBeNull();

    const result = await mod.verifyAndExtractTwoFactorCookie(signed, userId);
    expect(result.valid).toBe(true);
    expect(typeof result.iat).toBe("number");
    // iat must be the actual issuance timestamp (between before/after the
    // sign call). If it ever stops returning the real iat the /admin
    // sliding-window math breaks silently.
    expect(result.iat!).toBeGreaterThanOrEqual(before);
    expect(result.iat!).toBeLessThanOrEqual(after);
  });

  it("returns valid=false (no iat) for a cookie bound to a different user", async () => {
    const mod = await import("../auth/two-factor-cookie");
    const signed = await mod.signTwoFactorCookie("user-A");
    const result = await mod.verifyAndExtractTwoFactorCookie(signed, "user-B");
    expect(result.valid).toBe(false);
    expect(result.iat).toBeUndefined();
  });

  it("returns valid=false for a cookie older than the configured max-age", async () => {
    const mod = await import("../auth/two-factor-cookie");
    const userId = "user-stale";

    // Pin Date.now ~ 8 days ago for signing, then unstub for verification.
    const realNow = Date.now;
    const eightDaysAgo = realNow() - 8 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValueOnce(eightDaysAgo);
    const signed = await mod.signTwoFactorCookie(userId);
    expect(signed).not.toBeNull();

    // Restore time → verifier sees an 8-day-old iat against 7-day max.
    vi.restoreAllMocks();

    const result = await mod.verifyAndExtractTwoFactorCookie(signed, userId);
    expect(result.valid).toBe(false);
  });

  it("verifyTwoFactorCookie + verifyAndExtractTwoFactorCookie agree on validity", async () => {
    const mod = await import("../auth/two-factor-cookie");
    const userId = "user-pair";
    const signed = await mod.signTwoFactorCookie(userId);

    const boolResult = await mod.verifyTwoFactorCookie(signed, userId);
    const objResult = await mod.verifyAndExtractTwoFactorCookie(signed, userId);
    expect(boolResult).toBe(objResult.valid);
    expect(boolResult).toBe(true);

    // And on a wrong user, both reject.
    const boolWrong = await mod.verifyTwoFactorCookie(signed, "different");
    const objWrong = await mod.verifyAndExtractTwoFactorCookie(signed, "different");
    expect(boolWrong).toBe(objWrong.valid);
    expect(boolWrong).toBe(false);
  });

  it("idle-timeout math: a cookie issued 31 min ago is past the /admin 30-min budget", async () => {
    const mod = await import("../auth/two-factor-cookie");
    const userId = "user-idle";

    const realNow = Date.now;
    const thirtyOneMinAgo = realNow() - 31 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValueOnce(thirtyOneMinAgo);
    const signed = await mod.signTwoFactorCookie(userId);

    vi.restoreAllMocks();

    const result = await mod.verifyAndExtractTwoFactorCookie(signed, userId);
    // The cookie itself is still HMAC-valid + within 7-day max.
    expect(result.valid).toBe(true);
    expect(typeof result.iat).toBe("number");
    // But the middleware-side idle check (Date.now() - iat > 30*60*1000)
    // must fire, sending the user back through /login.
    const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
    expect(Date.now() - result.iat!).toBeGreaterThan(ADMIN_IDLE_TIMEOUT_MS);
  });
});
