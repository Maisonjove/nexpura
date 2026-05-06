/**
 * Manager PIN — hash + verify using node:crypto's scrypt.
 *
 * A1 (2026-05-06): refunds beyond the 30-day window or without an
 * original sale require a manager PIN. The PIN is per-team_member,
 * self-set on first override, hashed at rest.
 *
 * Why scrypt and not bcrypt:
 *   - bcrypt is a node-gyp native dep — heavy, breaks Vercel
 *     serverless cold-starts, requires build matrix updates.
 *   - scrypt ships in `node:crypto` (Node ≥ 10), no install, runs
 *     fine on Vercel + Edge runtime fallback.
 *   - For a 4-6 digit PIN (low-entropy by definition), scrypt's
 *     memory-hard parameters are at least as good a defense against
 *     offline brute-force as bcrypt at the same wall-clock cost.
 *   - The migration column is `manager_pin_hash TEXT` — format-
 *     agnostic. We encode `scrypt:N=<>:r=<>:p=<>:salt=<hex>:hash=<hex>`
 *     so the format is self-describing for future rotation.
 *
 * NOT a general-purpose password hasher. PINs are a 4-6 digit
 * supplemental check on top of an already-authenticated session;
 * they're NOT replacing the user's main password.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// Tunable parameters. N×r×p ≥ 16384×8×1 is the OWASP scrypt baseline
// for password-equivalent secrets (2024 guidance). For 4-digit PINs
// we hold the same baseline so an offline attacker with the hash file
// can't iterate the 10000-key space in under a few hours per CPU.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

const FORMAT_PREFIX = "scrypt";

/**
 * Hash a PIN. Caller must validate the PIN shape (4-6 digits, all
 * numeric) before calling — this function trusts the input.
 *
 * Returns a self-describing string for storage in
 * team_members.manager_pin_hash:
 *   `scrypt:N=16384:r=8:p=1:salt=<32-hex>:hash=<64-hex>`
 *
 * Total length is ~120 chars; well within TEXT column limits.
 */
export async function hashManagerPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scrypt(pin, salt, KEY_LEN);
  return [
    FORMAT_PREFIX,
    `N=${SCRYPT_N}`,
    `r=${SCRYPT_R}`,
    `p=${SCRYPT_P}`,
    `salt=${salt.toString("hex")}`,
    `hash=${hash.toString("hex")}`,
  ].join(":");
}

/**
 * Verify a PIN against a stored hash. Returns false on any parse
 * error / format mismatch / hash mismatch — never throws on bad
 * input, since this runs on user-supplied data.
 *
 * Uses timingSafeEqual to defeat timing-side-channel PIN guessing.
 */
export async function verifyManagerPin(
  pin: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash || typeof storedHash !== "string") return false;

  const parts = storedHash.split(":");
  if (parts.length !== 6 || parts[0] !== FORMAT_PREFIX) return false;

  // Parse the parameter triple. We don't honour stored N/r/p that
  // differ from current — those would be legacy hashes from a future
  // rotation, which we'd handle by re-hashing on next-set rather
  // than supporting on-the-fly verification at the old cost. For
  // now, reject non-current parameters defensively.
  const param = (key: string): string | null => {
    const part = parts.find((p) => p.startsWith(`${key}=`));
    return part ? part.slice(key.length + 1) : null;
  };
  const N = Number(param("N"));
  const r = Number(param("r"));
  const p = Number(param("p"));
  const saltHex = param("salt");
  const hashHex = param("hash");
  if (
    !Number.isFinite(N) || N !== SCRYPT_N ||
    !Number.isFinite(r) || r !== SCRYPT_R ||
    !Number.isFinite(p) || p !== SCRYPT_P ||
    !saltHex || !hashHex
  ) {
    return false;
  }

  let salt: Buffer;
  let stored: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    stored = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length !== SALT_LEN || stored.length !== KEY_LEN) return false;

  const computed = await scrypt(pin, salt, KEY_LEN);
  // timingSafeEqual rejects unequal-length buffers, so the length
  // check above is the gate; here we just compare.
  return timingSafeEqual(computed, stored);
}

/**
 * Validate a PIN's surface shape — 4-6 digits, numeric only. Caller
 * uses this BEFORE hashing to reject malformed input early.
 *
 * Note: not enforcing entropy beyond the regex. A user typing "1234"
 * is still a valid PIN; the policy lives in UX (warn on common
 * sequences) + rate-limiting on the verify endpoint, not here.
 */
const PIN_RE = /^\d{4,6}$/;
export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === "string" && PIN_RE.test(pin);
}
