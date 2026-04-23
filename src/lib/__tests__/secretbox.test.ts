/**
 * secretbox round-trip + fail-closed coverage.
 *
 * W6-HIGH-12 remediation: integration OAuth tokens and webhook secrets
 * are AES-GCM-sealed before hitting `integrations.config_encrypted`.
 * These tests ensure:
 *   - round-trip correctness (encrypt then decrypt recovers plaintext)
 *   - GCM auth tag catches ciphertext tampering
 *   - Wrong/rotated key rejects on decrypt
 *   - Missing env var throws (fail-closed, no silent passthrough)
 *   - Malformed key (too short) throws
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
} from "../crypto/secretbox";

const KEY_ENV = "NEXPURA_INTEGRATIONS_ENCRYPTION_KEY";
// 32 random bytes, base64 encoded
const TEST_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
const OTHER_KEY = "////////AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBk=";

const originalKey = process.env[KEY_ENV];

afterAll(() => {
  if (originalKey === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = originalKey;
});

describe("secretbox AES-GCM round-trip", () => {
  beforeEach(() => {
    process.env[KEY_ENV] = TEST_KEY;
  });

  it("round-trips a plaintext string", async () => {
    const pt = "shpat_abc123xyz789_really_long_shopify_access_token";
    const sealed = await encrypt(pt);
    expect(sealed.v).toBe(1);
    expect(sealed.c).toBeTypeOf("string");
    expect(sealed.i).toBeTypeOf("string");
    expect(sealed.c).not.toContain("shpat");
    const recovered = await decrypt(sealed);
    expect(recovered).toBe(pt);
  });

  it("round-trips a JSON object", async () => {
    const obj = {
      access_token: "xero_token_123",
      refresh_token: "xero_refresh_abc",
      expires_at: "2026-12-31T00:00:00Z",
    };
    const sealed = await encryptJson(obj);
    const recovered = await decryptJson<typeof obj>(sealed);
    expect(recovered).toEqual(obj);
  });

  it("produces a different ciphertext for the same plaintext (fresh IV)", async () => {
    const a = await encrypt("same");
    const b = await encrypt("same");
    expect(a.c).not.toBe(b.c);
    expect(a.i).not.toBe(b.i);
  });

  it("decryptJson returns null for null/undefined sealed", async () => {
    expect(await decryptJson(null)).toBeNull();
    expect(await decryptJson(undefined)).toBeNull();
  });
});

describe("secretbox tamper detection (AES-GCM auth tag)", () => {
  beforeEach(() => {
    process.env[KEY_ENV] = TEST_KEY;
  });

  it("rejects a modified ciphertext byte", async () => {
    const sealed = await encrypt("secret");
    // Flip one base64 char deep in the ciphertext
    const bad = {
      ...sealed,
      c: sealed.c.slice(0, -2) + (sealed.c.slice(-2, -1) === "A" ? "B" : "A") + sealed.c.slice(-1),
    };
    await expect(decrypt(bad)).rejects.toBeTruthy();
  });

  it("rejects a swapped IV", async () => {
    const a = await encrypt("secret-a");
    const b = await encrypt("secret-b");
    const bad = { ...a, i: b.i };
    await expect(decrypt(bad)).rejects.toBeTruthy();
  });

  it("rejects malformed sealed record", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(decrypt({ v: 2 as any, c: "x", i: "y" })).rejects.toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(decrypt({ v: 1, c: "", i: "" } as any)).rejects.toBeTruthy();
  });
});

describe("secretbox key-rotation / wrong-key rejection", () => {
  it("sealed with one key cannot be opened with a different key", async () => {
    process.env[KEY_ENV] = TEST_KEY;
    const sealed = await encrypt("top-secret-oauth-token");
    process.env[KEY_ENV] = OTHER_KEY;
    await expect(decrypt(sealed)).rejects.toBeTruthy();
  });
});

describe("secretbox fail-closed on missing/malformed key", () => {
  it("throws when key env is unset", async () => {
    delete process.env[KEY_ENV];
    await expect(encrypt("x")).rejects.toThrow(/not set/);
    await expect(decrypt({ v: 1, c: "a", i: "b" })).rejects.toThrow(/not set/);
  });

  it("throws when key env is empty", async () => {
    process.env[KEY_ENV] = "";
    await expect(encrypt("x")).rejects.toThrow(/not set/);
  });

  it("throws when key decodes to < 32 bytes", async () => {
    process.env[KEY_ENV] = "AAEC"; // 3 bytes base64
    await expect(encrypt("x")).rejects.toThrow(/32 bytes/);
  });

  it("throws when key is gibberish (neither base64 nor hex)", async () => {
    process.env[KEY_ENV] = "not-a-real-key-!!!";
    await expect(encrypt("x")).rejects.toThrow(/32 bytes/);
  });

  it("accepts a 64-char hex key", async () => {
    process.env[KEY_ENV] = "00".repeat(32);
    const sealed = await encrypt("hex-key-test");
    const out = await decrypt(sealed);
    expect(out).toBe("hex-key-test");
  });
});
