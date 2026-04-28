/**
 * Symmetric authenticated encryption for database column-level secrets.
 *
 * Audit finding W6-HIGH-12: OAuth tokens and webhook secrets for
 * Shopify / WooCommerce / Xero / Mailchimp / Google Calendar were stored
 * verbatim in `integrations.config` jsonb. A database-level backup leak
 * (cold storage, snapshot, support dump) would hand an attacker every
 * merchant's provider access tokens — effectively owning their Shopify
 * store, their Xero books, their Google Calendar, etc.
 *
 * Fix: every secret-bearing field is encrypted with AES-GCM-256 before
 * the row is written, and decrypted only at the integration-client-factory
 * boundary. Ciphertext + iv live in `integrations.config_encrypted`.
 *
 * Why Web Crypto (not `node:crypto`): `lib/integrations.ts` is imported
 * from a few routes that the middleware pulls in as part of the server
 * bundle; keeping the primitives on Web Crypto keeps them edge-compatible
 * and consistent with `lib/webhook-security.ts` primitives.
 *
 * Fail-closed: if the key env var is missing / too short / not valid
 * base64|hex, `encrypt()` and `decrypt()` reject. No silent passthrough.
 *
 * Key format: `NEXPURA_INTEGRATIONS_ENCRYPTION_KEY` must be 32 bytes,
 * supplied as either base64 or hex. Generate with:
 *   `openssl rand -base64 32`  or
 *   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
 */

/** Record shape persisted to `integrations.config_encrypted`. Version for future rotation. */
export interface Sealed {
  v: 1;
  /** base64 ciphertext (includes the 16-byte AES-GCM auth tag appended) */
  c: string;
  /** base64 12-byte IV */
  i: string;
}

const KEY_ENV = "NEXPURA_INTEGRATIONS_ENCRYPTION_KEY";
// Optional grace-window key. During a key rotation, set the previous key
// here so existing ciphertext stays decryptable while the re-encrypt
// script (scripts/rotate-encryption-key.ts) walks every sealed row and
// rewrites it under the new key. Once that completes, unset this and
// redeploy. encrypt() always uses the current key only.
const PREV_KEY_ENV = "NEXPURA_INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS";

function decodeKey(raw: string): Uint8Array {
  // Prefer base64; fall back to hex. Reject anything < 32 bytes.
  const trimmed = raw.trim();
  // Try base64
  try {
    const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? b64 : b64 + "=".repeat(4 - (b64.length % 4));
    const bin = atob(pad);
    if (bin.length === 32) {
      const out = new Uint8Array(32);
      for (let i = 0; i < 32; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch {
    // fall through to hex
  }
  // Try hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  throw new Error(
    `[secretbox] ${KEY_ENV} must decode to exactly 32 bytes (base64 or hex)`,
  );
}

async function importKeyFromEnv(envName: string, usages: KeyUsage[]): Promise<CryptoKey | null> {
  const raw = process.env[envName];
  if (!raw || raw.length === 0) return null;
  const bytes = decodeKey(raw);
  if (bytes.length !== 32) {
    throw new Error(`[secretbox] ${envName} decoded to ${bytes.length} bytes, need 32`);
  }
  const buf = new ArrayBuffer(32);
  new Uint8Array(buf).set(bytes);
  return globalThis.crypto.subtle.importKey("raw", buf, { name: "AES-GCM" }, false, usages);
}

async function loadKey(): Promise<CryptoKey> {
  const key = await importKeyFromEnv(KEY_ENV, ["encrypt", "decrypt"]);
  if (!key) {
    throw new Error(`[secretbox] ${KEY_ENV} is not set — refusing to encrypt/decrypt`);
  }
  return key;
}

/**
 * Decryption-only fallback for the rotation grace window. Returns null
 * when no previous key is configured, which is the steady state.
 */
async function loadPrevKey(): Promise<CryptoKey | null> {
  return importKeyFromEnv(PREV_KEY_ENV, ["decrypt"]);
}

function u8ToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Encrypt a plaintext UTF-8 string with a fresh 12-byte IV.
 * Throws if key env missing / malformed.
 */
export async function encrypt(plain: string): Promise<Sealed> {
  const key = await loadKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ptBytes = new TextEncoder().encode(plain);
  const ptBuf = new ArrayBuffer(ptBytes.length);
  new Uint8Array(ptBuf).set(ptBytes);
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    ptBuf,
  );
  return { v: 1, c: u8ToB64(new Uint8Array(ct)), i: u8ToB64(iv) };
}

/**
 * Decrypt a sealed record. Throws on:
 *   - missing/bad key env
 *   - wrong version
 *   - malformed base64
 *   - authentication-tag mismatch (tampered ciphertext, wrong key)
 */
export async function decrypt(sealed: Sealed): Promise<string> {
  if (!sealed || sealed.v !== 1 || !sealed.c || !sealed.i) {
    throw new Error("[secretbox] malformed sealed record");
  }
  const ivBytes = b64ToU8(sealed.i);
  const ctBytes = b64ToU8(sealed.c);
  const ivBuf = new ArrayBuffer(ivBytes.length);
  new Uint8Array(ivBuf).set(ivBytes);
  const ctBuf = new ArrayBuffer(ctBytes.length);
  new Uint8Array(ctBuf).set(ctBytes);

  const key = await loadKey();
  try {
    const pt = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
      key,
      ctBuf,
    );
    return new TextDecoder().decode(pt);
  } catch (primaryErr) {
    // GCM auth-tag mismatch — try the rotation-grace previous key if
    // configured. Steady-state this is a no-op (env var unset → null).
    const prev = await loadPrevKey();
    if (!prev) throw primaryErr;
    const pt = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
      prev,
      ctBuf,
    );
    return new TextDecoder().decode(pt);
  }
}

/**
 * Encrypt a JSON-serializable value.
 */
export async function encryptJson<T>(value: T): Promise<Sealed> {
  return encrypt(JSON.stringify(value ?? null));
}

/**
 * Decrypt a sealed JSON value. Returns null when the sealed record is
 * empty/undefined (e.g. legacy row with no encrypted column yet).
 */
export async function decryptJson<T>(sealed: Sealed | null | undefined): Promise<T | null> {
  if (!sealed) return null;
  const plain = await decrypt(sealed);
  return JSON.parse(plain) as T;
}

/** Test-only: reset any memoised key so env changes take effect. */
export function __resetKeyCacheForTests(): void {
  // currently no caching; placeholder for future.
}
