/**
 * PR-05 contract test — 2FA AAL enforcement sweep.
 *
 * Closes W1-001 HIGH (2FA bypass via direct URL): after Supabase
 * `signInWithPassword` resolved, the historical flow granted a full
 * session cookie and relied on *client-side JS* in /login to send the
 * user to /verify-2fa. Middleware never checked a "2FA passed" proof,
 * so anyone who skipped the client redirect and went straight to
 * /dashboard bypassed the second factor entirely.
 *
 * The fix is an HttpOnly, HMAC-signed `nexpura-2fa-ok` cookie issued
 * by /api/auth/2fa/validate (and /api/auth/2fa/verify, on first
 * enrolment) and required by the middleware for any user whose
 * `users.totp_enabled` is true.
 *
 * These tests enforce:
 *
 *   1. Behaviour of src/lib/auth/two-factor-cookie.ts — sign/verify
 *      round-trip, user-id binding, HMAC tampering rejection, expiry,
 *      and fail-closed semantics when the secret is unset.
 *   2. The validate/verify/disable/logout handlers call the correct
 *      cookie helper (static analysis so any future regression that
 *      drops the cookie from the success path breaks the build).
 *   3. The middleware enforces the gate — it imports the helpers, has
 *      the exempt-path set the plan requires, calls `enforceTwoFactor`
 *      for tenant-slug, flat-route and /admin branches, and redirects
 *      to /verify-2fa.
 *
 * Everything runs in pure-Node (no Next runtime, no DB, no network).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ───────────────────────────────────────────────────────────────────────
// 1. Cookie helper behaviour
// ───────────────────────────────────────────────────────────────────────

// Import lazily inside describe blocks after we've set the secret env
// — the module reads env lazily per-call so a simple describe works.
import {
  signTwoFactorCookie,
  verifyTwoFactorCookie,
  getTwoFactorCookieSecret,
  TWO_FACTOR_COOKIE_NAME,
} from "../auth/two-factor-cookie";

const TEST_SECRET = "pr05-test-secret-must-be-long-enough-32b";

describe("two-factor-cookie helper (W1-001 HIGH)", () => {
  const originalSecret = process.env.NEXPURA_2FA_COOKIE_SECRET;
  const originalMaxAge = process.env.NEXPURA_2FA_COOKIE_MAX_AGE_SECONDS;

  beforeEach(() => {
    process.env.NEXPURA_2FA_COOKIE_SECRET = TEST_SECRET;
    delete process.env.NEXPURA_2FA_COOKIE_MAX_AGE_SECONDS;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.NEXPURA_2FA_COOKIE_SECRET;
    else process.env.NEXPURA_2FA_COOKIE_SECRET = originalSecret;
    if (originalMaxAge === undefined)
      delete process.env.NEXPURA_2FA_COOKIE_MAX_AGE_SECONDS;
    else process.env.NEXPURA_2FA_COOKIE_MAX_AGE_SECONDS = originalMaxAge;
  });

  it("exposes the canonical cookie name", () => {
    expect(TWO_FACTOR_COOKIE_NAME).toBe("nexpura-2fa-ok");
  });

  it("signs and verifies a round-trip for the same userId", async () => {
    const cookie = await signTwoFactorCookie("user-abc");
    expect(cookie).toBeTruthy();
    expect(await verifyTwoFactorCookie(cookie, "user-abc")).toBe(true);
  });

  it("rejects a cookie bound to a different userId (no cross-user reuse)", async () => {
    const cookie = await signTwoFactorCookie("user-abc");
    expect(await verifyTwoFactorCookie(cookie, "user-xyz")).toBe(false);
  });

  it("rejects a tampered HMAC signature", async () => {
    const cookie = (await signTwoFactorCookie("user-abc"))!;
    // Flip the FIRST char of the signature segment (after the dot).
    // Tampering the LAST char is unsafe in tests because base64-url of a
    // 32-byte HMAC produces 43 chars where the final char's low 2 bits
    // are unused — flipping A↔B can leave the decoded bytes identical
    // and the HMAC verify still passes. CI surfaced this as a flaky
    // failure: the test passed when the runtime HMAC ended on certain
    // values and failed when it didn't. Mutating a high-position byte
    // is collision-free.
    const dot = cookie.lastIndexOf(".");
    const sigFirst = cookie.charAt(dot + 1);
    const tampered =
      cookie.slice(0, dot + 1) +
      (sigFirst === "A" ? "B" : "A") +
      cookie.slice(dot + 2);
    expect(await verifyTwoFactorCookie(tampered, "user-abc")).toBe(false);
  });

  it("rejects a tampered payload (re-base64ing a swapped uid without re-signing)", async () => {
    const cookie = (await signTwoFactorCookie("user-abc"))!;
    const dot = cookie.lastIndexOf(".");
    // re-encode a different payload onto the original sig
    const newBody = Buffer.from(
      JSON.stringify({ uid: "user-xyz", iat: Date.now() }),
      "utf8"
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const forged = `${newBody}.${cookie.slice(dot + 1)}`;
    expect(await verifyTwoFactorCookie(forged, "user-xyz")).toBe(false);
    expect(await verifyTwoFactorCookie(forged, "user-abc")).toBe(false);
  });

  it("rejects a malformed cookie (no dot)", async () => {
    expect(await verifyTwoFactorCookie("not-a-valid-cookie", "user-abc")).toBe(false);
  });

  it("rejects an empty cookie", async () => {
    expect(await verifyTwoFactorCookie("", "user-abc")).toBe(false);
    expect(await verifyTwoFactorCookie(null, "user-abc")).toBe(false);
    expect(await verifyTwoFactorCookie(undefined, "user-abc")).toBe(false);
  });

  it("rejects when expectedUserId is empty (can't bind to nothing)", async () => {
    const cookie = (await signTwoFactorCookie("user-abc"))!;
    expect(await verifyTwoFactorCookie(cookie, "")).toBe(false);
  });

  it("rejects an expired cookie (iat older than max-age)", async () => {
    process.env.NEXPURA_2FA_COOKIE_MAX_AGE_SECONDS = "1"; // 1s window
    const cookie = (await signTwoFactorCookie("user-abc"))!;
    // fast-forward by overriding the payload iat via re-signing
    // easier: wait for max-age? No — we fake iat directly by re-signing.
    // The helper re-reads env on verify, so a stale cookie fails.
    // We can't time-travel without vi.useFakeTimers, so pin max-age=0 — but
    // 0 is coerced back to the default. Use a very small window and a
    // manually-crafted old-iat payload instead.
    const oldPayload = {
      uid: "user-abc",
      iat: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
    };
    const body = Buffer.from(JSON.stringify(oldPayload), "utf8");
    const mac = crypto.createHmac("sha256", TEST_SECRET).update(body).digest();
    const b64 = (b: Buffer) =>
      b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const stale = `${b64(body)}.${b64(mac)}`;
    expect(await verifyTwoFactorCookie(stale, "user-abc")).toBe(false);
    // Sanity: the valid cookie signed above is still OK within 1s.
    // (We don't assert this because the test harness may take >1s.)
    void cookie;
  });

  it("fail-closed: refuses to sign when the secret is unset", async () => {
    delete process.env.NEXPURA_2FA_COOKIE_SECRET;
    expect(getTwoFactorCookieSecret()).toBeNull();
    expect(await signTwoFactorCookie("user-abc")).toBeNull();
  });

  it("fail-closed: refuses to verify when the secret is unset", async () => {
    // Sign with the secret available…
    process.env.NEXPURA_2FA_COOKIE_SECRET = TEST_SECRET;
    const cookie = (await signTwoFactorCookie("user-abc"))!;
    // …then simulate the secret being removed (misconfigured prod).
    delete process.env.NEXPURA_2FA_COOKIE_SECRET;
    expect(await verifyTwoFactorCookie(cookie, "user-abc")).toBe(false);
  });

  it("fail-closed: refuses short (likely missing) secrets", async () => {
    process.env.NEXPURA_2FA_COOKIE_SECRET = "too-short";
    expect(getTwoFactorCookieSecret()).toBeNull();
    expect(await signTwoFactorCookie("user-abc")).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const cookie = (await signTwoFactorCookie("user-abc"))!;
    process.env.NEXPURA_2FA_COOKIE_SECRET = TEST_SECRET + "-rotated";
    expect(await verifyTwoFactorCookie(cookie, "user-abc")).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 2. Handlers wire the cookie on success / clear on logout+disable
// ───────────────────────────────────────────────────────────────────────

describe("2FA route handlers wire the AAL2 cookie", () => {
  const validate = read("src/app/api/auth/2fa/validate/route.ts");
  const verifySetup = read("src/app/api/auth/2fa/verify/route.ts");
  const disable = read("src/app/api/auth/2fa/disable/route.ts");
  const logout = read("src/app/api/auth/logout/route.ts");

  it("validate imports setTwoFactorCookie", () => {
    expect(validate).toMatch(
      /from ['"]@\/lib\/auth\/two-factor-cookie['"]/
    );
    expect(validate).toMatch(/setTwoFactorCookie/);
  });

  it("validate writes the cookie on both TOTP and backup-code success paths", () => {
    // Two distinct success branches must each call setTwoFactorCookie
    const calls = validate.match(/setTwoFactorCookie\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("validate fails-closed when cookie signing is unavailable (no 2FA-shaped success leak)", () => {
    // If setTwoFactorCookie returns false the handler must not return
    // `valid: true` — it must surface a 500. Regex is defensive.
    expect(validate).toMatch(/refusing AAL2 promotion|AAL2/);
    expect(validate).toMatch(/status:\s*500/);
  });

  it("verify (enrolment) writes the cookie after the TOTP code is validated", () => {
    expect(verifySetup).toMatch(
      /from ['"]@\/lib\/auth\/two-factor-cookie['"]/
    );
    expect(verifySetup).toMatch(/setTwoFactorCookie\(/);
  });

  it("disable clears the cookie so re-enabling 2FA forces a fresh proof", () => {
    expect(disable).toMatch(/clearTwoFactorCookie\(/);
  });

  it("logout API clears the cookie", () => {
    expect(logout).toMatch(/clearTwoFactorCookie\(/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 3. Middleware wiring
// ───────────────────────────────────────────────────────────────────────

describe("middleware AAL2 enforcement (W1-001 HIGH)", () => {
  const mw = read("src/lib/supabase/middleware.ts");

  it("imports the cookie verifier", () => {
    expect(mw).toMatch(
      /from ['"]@\/lib\/auth\/two-factor-cookie['"]/
    );
    expect(mw).toMatch(/verifyTwoFactorCookie/);
    expect(mw).toMatch(/TWO_FACTOR_COOKIE_NAME/);
  });

  it("defines enforceTwoFactor that redirects to /verify-2fa", () => {
    expect(mw).toMatch(/function enforceTwoFactor\(/);
    expect(mw).toMatch(/pathname\s*=\s*['"]\/verify-2fa['"]/);
  });

  it("enforceTwoFactor forwards a sanitized returnTo", () => {
    // The helper must set `returnTo=<encoded>` on the redirect URL so the
    // user lands back at their intended destination after verifying.
    expect(mw).toMatch(/returnTo=/);
    expect(mw).toMatch(/encodeURIComponent\(/);
  });

  it("exempts /verify-2fa itself (no redirect loop)", () => {
    expect(mw).toMatch(/['"]\/verify-2fa['"]/);
    expect(mw).toMatch(/isTwoFactorExemptPath/);
  });

  it("exempts /api/auth/2fa/* (the factor-validation endpoints)", () => {
    expect(mw).toMatch(/\/api\/auth\/2fa\//);
  });

  it("exempts /api/auth/login and /api/auth/logout", () => {
    expect(mw).toMatch(/\/api\/auth\/login/);
    expect(mw).toMatch(/\/api\/auth\/logout/);
  });

  it("exempts the /logout page", () => {
    expect(mw).toMatch(/['"]\/logout['"]/);
  });

  it("skips enforcement when totp_enabled is falsy (no forced-prompt regression)", () => {
    // The helper returns null early when totp_enabled is false/null, so
    // users without 2FA set up still pass without a cookie. Assert the
    // guard exists.
    expect(mw).toMatch(/if\s*\(\s*!\s*totpEnabled\s*\)\s*return\s+null/);
  });

  it("calls enforceTwoFactor in the tenant-slug branch", () => {
    // Count occurrences — we expect at least 3 call sites:
    // tenant-slug, flat-route and /admin. Source order ensures the
    // call comes AFTER the user+profile lookup.
    const calls = mw.match(/enforceTwoFactor\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3); // definition + 3 sites minimum
  });

  it("invokes enforceTwoFactor for the /admin surface", () => {
    // Static scan: between the isAdminRoute block and its return, we must
    // see an enforceTwoFactor call.
    const adminBlock = mw.slice(
      mw.indexOf("const isAdminRoute"),
      mw.indexOf("// --- Tenant-slug URL routing")
    );
    expect(adminBlock).toMatch(/enforceTwoFactor\(/);
  });

  it("invokes enforceTwoFactor for the tenant-slug branch (pre-subscription check)", () => {
    const tenantBlock = mw.slice(
      mw.indexOf("// --- Tenant-slug URL routing"),
      mw.indexOf("// Any flat /{route}")
    );
    expect(tenantBlock).toMatch(/enforceTwoFactor\(/);
  });

  it("invokes enforceTwoFactor for the flat-route branch", () => {
    const flatBlock = mw.slice(mw.indexOf("// Any flat /{route}"));
    expect(flatBlock).toMatch(/enforceTwoFactor\(/);
  });

  it("reads the signed cookie from request.cookies (not body/query)", () => {
    expect(mw).toMatch(/request\.cookies\.get\(\s*TWO_FACTOR_COOKIE_NAME/);
  });

  it("binds the verification call to the resolved user id", () => {
    // verifyTwoFactorCookie must be passed the user.id we resolved, not
    // whatever the client claims.
    expect(mw).toMatch(/verifyTwoFactorCookie\(\s*cookie\s*,\s*userId\s*\)/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 4. Login flow no longer relies on client-only JS for the 2FA hop
// ───────────────────────────────────────────────────────────────────────

describe("login → verify-2fa → cookie-backed session (W1-001 HIGH)", () => {
  const loginPage = read("src/app/(auth)/login/page.tsx");
  const verifyPage = read("src/app/(auth)/verify-2fa/page.tsx");

  it("login still routes 2FA users through /verify-2fa (client hop preserved for UX)", () => {
    expect(loginPage).toMatch(/\/verify-2fa/);
  });

  it("verify-2fa page posts to /api/auth/2fa/validate (which now mints the cookie)", () => {
    expect(verifyPage).toMatch(/\/api\/auth\/2fa\/validate/);
  });

  it("verify-2fa falls back to /api/auth/me when userId is absent (middleware-initiated redirect)", () => {
    // Middleware can land an already-authenticated user here without the
    // legacy ?userId= query param. The page must resolve identity from
    // the session instead of bouncing to /login.
    expect(verifyPage).toMatch(/\/api\/auth\/me/);
  });

  it("verify-2fa sanitizes returnTo to reject absolute-URL open redirects", () => {
    // Accept only relative paths that start with a single '/'.
    expect(verifyPage).toMatch(/startsWith\(\s*['"]\/['"]\s*\)/);
    expect(verifyPage).toMatch(/startsWith\(\s*['"]\/\/['"]\s*\)/);
  });

  it("logout page clears the AAL2 cookie via /api/auth/logout", () => {
    const logoutPage = read("src/app/logout/page.tsx");
    expect(logoutPage).toMatch(/\/api\/auth\/logout/);
  });
});
