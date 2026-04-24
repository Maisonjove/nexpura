/**
 * Dashboard shell cookie — carries the DashboardCriticalData so the
 * dashboard server component can render the first-paint shell without a
 * DB round-trip on a cold session.
 *
 * On a fresh login, the /api/auth/login route signs this cookie and
 * sets it alongside the Supabase session cookies. Dashboard page reads
 * the cookie and returns its payload directly if (a) signature verifies
 * and (b) issued-at is within the 24h window. Any miss (first-ever
 * login before this shipped, tampered cookie, expired cookie, subsequent
 * dashboard open after critical data changes) silently falls back to the
 * existing `getDashboardCriticalData` DB path, which refreshes the
 * cookie for the next hit.
 *
 * Security:
 *   - HMAC-SHA256 over the payload JSON using NEXPURA_2FA_COOKIE_SECRET
 *     (reuses an existing secret to avoid a new env var). Verification
 *     is timing-safe via Web Crypto's subtle.verify.
 *   - `userId` is embedded; dashboard page compares it to the session
 *     user and throws away the cookie data on mismatch (guards against
 *     a stale cookie surviving a sign-in-as-different-user flow).
 *   - HttpOnly, Secure in production, SameSite=Lax, path=/.
 *   - 24h max-age ensures eventual refresh if tenant business_name /
 *     currency / tz change (they rarely do).
 *
 * Edge-runtime compatible: uses globalThis.crypto.subtle + TextEncoder,
 * no node:crypto / Buffer.
 */

const COOKIE_NAME = "nexpura-dash-shell";
const MAX_AGE_SECONDS = 24 * 60 * 60;

export interface ShellPayload {
  userId: string;
  tenantId: string;
  firstName: string;
  tenantName: string | null;
  businessType: string | null;
  currency: string;
  timezone: string | null;
  isManager: boolean;
  iat: number;
}

function getSecret(): string | null {
  // Reuse the 2FA cookie secret — same security profile (HMAC-signed
  // server-issued cookie used on the critical-path render). Avoids a
  // new env var + a new rotation story.
  const s = process.env.NEXPURA_2FA_COOKIE_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 2 ? "==" : str.length % 4 === 3 ? "=" : "";
  const b64 = str.replaceAll("-", "+").replaceAll("_", "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(data) as BufferSource);
  return new Uint8Array(sig);
}

/**
 * Produce the signed cookie value for a shell payload. Returns null if
 * the server is not configured to sign cookies (missing/short secret).
 */
export async function signShellCookie(
  payload: Omit<ShellPayload, "iat">,
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const full: ShellPayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const json = JSON.stringify(full);
  const bodyB64 = b64urlEncode(new TextEncoder().encode(json));
  const sig = await hmac(secret, bodyB64);
  return `${bodyB64}.${b64urlEncode(sig)}`;
}

/**
 * Verify + parse the cookie. Returns null if missing, tampered,
 * expired, or malformed.
 */
export async function verifyShellCookie(
  value: string | undefined,
  expectedUserId: string,
): Promise<ShellPayload | null> {
  if (!value || !expectedUserId) return null;
  const secret = getSecret();
  if (!secret) return null;

  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const bodyB64 = value.slice(0, dot);
  const sigB64 = value.slice(dot + 1);

  let expected: Uint8Array;
  try {
    expected = await hmac(secret, bodyB64);
  } catch {
    return null;
  }
  let actual: Uint8Array;
  try {
    actual = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (actual.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  if (diff !== 0) return null;

  let parsed: ShellPayload;
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(bodyB64))) as ShellPayload;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.userId !== expectedUserId) return null;

  const ageSeconds = Math.floor(Date.now() / 1000) - (parsed.iat ?? 0);
  if (ageSeconds < 0 || ageSeconds > MAX_AGE_SECONDS) return null;

  return parsed;
}

export const SHELL_COOKIE_NAME = COOKIE_NAME;
export const SHELL_COOKIE_MAX_AGE = MAX_AGE_SECONDS;
