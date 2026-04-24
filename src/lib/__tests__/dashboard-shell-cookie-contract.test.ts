import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  signShellCookie,
  verifyShellCookie,
  SHELL_COOKIE_NAME,
  SHELL_COOKIE_MAX_AGE,
} from "../dashboard/shell-cookie";

/**
 * Contract test locking in the dashboard shell cookie — the Option C
 * fast path that skips the DB round-trip on a cold dashboard render.
 *
 * Invariants locked here:
 *   1. Sign/verify round-trip returns the same payload (happy path).
 *   2. Secret under the 16-char minimum = signing returns null (fail
 *      closed in dev/local misconfig — never emit an unsigned value).
 *   3. Tampered body rejected.
 *   4. Tampered signature rejected.
 *   5. userId mismatch rejected (prevents sharing a cookie across
 *      sign-in-as-different-user flows on the same browser).
 *   6. Expired payload rejected (>24h).
 *   7. Malformed cookie rejected cleanly (no throw).
 *   8. tenantId comes through intact (callers use it to validate the
 *      shell matches the caller's session tenant).
 */

const TEST_SECRET = "a".repeat(32);
const BASE_PAYLOAD = {
  userId: "user-uuid-aaaa",
  tenantId: "tenant-uuid-bbbb",
  firstName: "Acme Jewellers",
  tenantName: "Acme Jewellers",
  businessType: "jewellery_store",
  currency: "AUD",
  timezone: "Australia/Sydney",
  isManager: true,
};

describe("dashboard shell cookie — sign/verify contract", () => {
  beforeEach(() => {
    vi.stubEnv("NEXPURA_2FA_COOKIE_SECRET", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trip: sign then verify returns the same payload", async () => {
    const cookie = await signShellCookie(BASE_PAYLOAD);
    expect(cookie).toBeTruthy();
    const payload = await verifyShellCookie(cookie!, BASE_PAYLOAD.userId);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(BASE_PAYLOAD.userId);
    expect(payload!.tenantId).toBe(BASE_PAYLOAD.tenantId);
    expect(payload!.firstName).toBe(BASE_PAYLOAD.firstName);
    expect(payload!.currency).toBe("AUD");
    expect(typeof payload!.iat).toBe("number");
  });

  it("signing returns null when secret is missing", async () => {
    vi.stubEnv("NEXPURA_2FA_COOKIE_SECRET", "");
    const cookie = await signShellCookie(BASE_PAYLOAD);
    expect(cookie).toBeNull();
  });

  it("signing returns null when secret is too short (<16 chars)", async () => {
    vi.stubEnv("NEXPURA_2FA_COOKIE_SECRET", "short");
    const cookie = await signShellCookie(BASE_PAYLOAD);
    expect(cookie).toBeNull();
  });

  it("verification returns null when secret is missing", async () => {
    const cookie = await signShellCookie(BASE_PAYLOAD);
    vi.stubEnv("NEXPURA_2FA_COOKIE_SECRET", "");
    const payload = await verifyShellCookie(cookie!, BASE_PAYLOAD.userId);
    expect(payload).toBeNull();
  });

  it("rejects a tampered body", async () => {
    const cookie = await signShellCookie(BASE_PAYLOAD);
    expect(cookie).toBeTruthy();
    const [body, sig] = cookie!.split(".");
    // Flip a char in the body
    const tamperedBody = body.slice(0, -1) + (body.endsWith("A") ? "B" : "A");
    const tampered = `${tamperedBody}.${sig}`;
    const payload = await verifyShellCookie(tampered, BASE_PAYLOAD.userId);
    expect(payload).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const cookie = await signShellCookie(BASE_PAYLOAD);
    expect(cookie).toBeTruthy();
    const [body, sig] = cookie!.split(".");
    const tamperedSig = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    const tampered = `${body}.${tamperedSig}`;
    const payload = await verifyShellCookie(tampered, BASE_PAYLOAD.userId);
    expect(payload).toBeNull();
  });

  it("rejects when expected userId does not match payload userId", async () => {
    const cookie = await signShellCookie(BASE_PAYLOAD);
    expect(cookie).toBeTruthy();
    const payload = await verifyShellCookie(cookie!, "different-user-uuid");
    expect(payload).toBeNull();
  });

  it("rejects a cookie with iat older than 24h", async () => {
    // Build a cookie manually with stale iat. Use the real encoder.
    const cookie = await signShellCookie(BASE_PAYLOAD);
    expect(cookie).toBeTruthy();
    const [body, sig] = cookie!.split(".");

    // Decode base64url → parse JSON → backdate → re-encode body → SIGN
    // again with the same secret (we can't just reuse sig because the
    // body changed). This simulates a legitimately old cookie.
    const decode = (s: string): Uint8Array => {
      const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
      const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + pad;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    };
    const encode = (bytes: Uint8Array): string => {
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
    };
    const payload = JSON.parse(new TextDecoder().decode(decode(body)));
    payload.iat = Math.floor(Date.now() / 1000) - (25 * 60 * 60); // 25h ago
    const staleBody = encode(new TextEncoder().encode(JSON.stringify(payload)));

    // Re-sign the stale body with the same secret (mimics an attacker
    // replaying an old but-still-signed cookie captured earlier).
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      enc.encode(TEST_SECRET) as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const newSig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(staleBody) as BufferSource);
    const stale = `${staleBody}.${encode(new Uint8Array(newSig))}`;

    const verified = await verifyShellCookie(stale, BASE_PAYLOAD.userId);
    expect(verified).toBeNull();

    // Sanity: the freshly-signed cookie is still valid (proves the
    // rejection was age, not secret mismatch).
    void sig;
    const fresh = await verifyShellCookie(cookie!, BASE_PAYLOAD.userId);
    expect(fresh).not.toBeNull();
  });

  it("rejects malformed cookie values without throwing", async () => {
    for (const bad of ["", "not-a-cookie", "no-dot-here", ".only-dot.", "a.b.c.d"]) {
      const payload = await verifyShellCookie(bad, BASE_PAYLOAD.userId);
      expect(payload).toBeNull();
    }
  });

  it("rejects undefined cookie value", async () => {
    const payload = await verifyShellCookie(undefined, BASE_PAYLOAD.userId);
    expect(payload).toBeNull();
  });

  it("exported constants match the login-route contract", () => {
    expect(SHELL_COOKIE_NAME).toBe("nexpura-dash-shell");
    expect(SHELL_COOKIE_MAX_AGE).toBe(24 * 60 * 60);
  });
});
