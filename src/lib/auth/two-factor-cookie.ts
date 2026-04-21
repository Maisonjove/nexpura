/**
 * PR-05 (Pattern 5): server-side proof that a user has passed 2FA.
 *
 * The historical flow granted a full Supabase session cookie the moment
 * `signInWithPassword` resolved, then relied on *client-side JS* in
 * `/login` to send the user to `/verify-2fa`. An attacker with valid
 * credentials could simply skip that redirect and navigate to `/dashboard`
 * — the session cookie was already valid and middleware never checked for
 * a 2FA step, so the second factor was purely cosmetic (W1-001 HIGH).
 *
 * This module issues an HttpOnly, HMAC-signed cookie (`nexpura-2fa-ok`)
 * the moment the server has *verified* a TOTP or backup code.
 * Middleware requires this cookie for any user whose `users.totp_enabled`
 * is true, otherwise redirects to `/verify-2fa`.
 *
 * Cookie format:   `<base64url(payload)>.<base64url(hmac-sha256)>`
 * Payload:         `{ uid: <supabase user id>, iat: <unix ms> }`
 *
 * Security properties:
 *   - HMAC-signed with `NEXPURA_2FA_COOKIE_SECRET` (fail-closed when
 *     missing: middleware treats it as "no valid cookie" and redirects).
 *   - Bound to the Supabase user ID: a cookie forged for user A cannot
 *     grant AAL2 to user B on the same browser (session rotation).
 *   - TTL equal to Supabase session TTL (7 days by default). Configurable
 *     via `NEXPURA_2FA_COOKIE_MAX_AGE_SECONDS` if an operator wants a
 *     stricter re-prompt cadence.
 *   - HttpOnly so JS cannot read or mutate it.
 *   - Secure + SameSite=Lax; Domain matches Supabase session cookies so
 *     it follows the user across tenant subdomains.
 */
import crypto from "crypto";
import type { NextResponse } from "next/server";
import { getCookieDomain, getIsSecure } from "@/lib/supabase/cookie-config";

export const TWO_FACTOR_COOKIE_NAME = "nexpura-2fa-ok";

// Default: 7 days, matching the default Supabase session. Rotation happens
// on re-login (the cookie is cleared on logout) and on /2fa/disable.
const DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getMaxAgeSeconds(): number {
  const env = process.env.NEXPURA_2FA_COOKIE_MAX_AGE_SECONDS;
  if (!env) return DEFAULT_MAX_AGE_SECONDS;
  const parsed = parseInt(env, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_AGE_SECONDS;
  return parsed;
}

/**
 * Retrieve the cookie-signing secret.
 *
 * Fail-closed: when unset we return null and callers MUST treat that as
 * "cannot issue / cannot verify" — NOT as "permit without 2FA". The
 * middleware enforcement logic refuses to grant AAL2 when the secret is
 * missing in production.
 */
export function getTwoFactorCookieSecret(): string | null {
  const s = process.env.NEXPURA_2FA_COOKIE_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  let str = s.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

interface TwoFactorCookiePayload {
  uid: string;
  iat: number;
}

/**
 * Sign a payload bound to a specific user ID.
 * Returns null if the secret is unavailable (fail-closed).
 */
export function signTwoFactorCookie(userId: string): string | null {
  const secret = getTwoFactorCookieSecret();
  if (!secret) return null;
  if (!userId) return null;
  const payload: TwoFactorCookiePayload = { uid: userId, iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const mac = crypto.createHmac("sha256", secret).update(body).digest();
  return `${b64url(body)}.${b64url(mac)}`;
}

/**
 * Verify a cookie value against the expected user ID.
 *
 * Returns true only if:
 *   - secret is configured
 *   - cookie is well-formed `body.sig`
 *   - HMAC matches (constant-time compare)
 *   - payload uid equals the supplied expected user ID
 *   - payload is not older than the configured max-age
 */
export function verifyTwoFactorCookie(
  cookieValue: string | null | undefined,
  expectedUserId: string
): boolean {
  if (!cookieValue || !expectedUserId) return false;
  const secret = getTwoFactorCookieSecret();
  if (!secret) return false;

  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return false;

  const bodyPart = cookieValue.slice(0, dot);
  const sigPart = cookieValue.slice(dot + 1);

  let body: Buffer;
  let sig: Buffer;
  try {
    body = b64urlDecode(bodyPart);
    sig = b64urlDecode(sigPart);
  } catch {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(sig, expected)) return false;
  } catch {
    return false;
  }

  let parsed: TwoFactorCookiePayload;
  try {
    parsed = JSON.parse(body.toString("utf8")) as TwoFactorCookiePayload;
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  if (typeof parsed.uid !== "string" || parsed.uid !== expectedUserId) {
    return false;
  }
  if (typeof parsed.iat !== "number" || !Number.isFinite(parsed.iat)) {
    return false;
  }
  const maxAgeMs = getMaxAgeSeconds() * 1000;
  if (Date.now() - parsed.iat > maxAgeMs) return false;

  return true;
}

/**
 * Write the signed 2FA cookie onto a response.
 * Caller is responsible for ensuring the user has actually proved
 * possession of the second factor before calling this.
 *
 * If the secret is missing (local dev without the env set) we refuse to
 * write the cookie so the user is re-prompted on the next request. We
 * never pass-through without proof.
 */
export function setTwoFactorCookie(
  response: NextResponse,
  userId: string,
  host: string | undefined,
  protocol: string | undefined
): boolean {
  const value = signTwoFactorCookie(userId);
  if (!value) return false;
  response.cookies.set(TWO_FACTOR_COOKIE_NAME, value, {
    httpOnly: true,
    secure: getIsSecure(protocol, host),
    sameSite: "lax",
    maxAge: getMaxAgeSeconds(),
    path: "/",
    domain: getCookieDomain(host),
  });
  return true;
}

/**
 * Delete the cookie. Called from /logout, /2fa/disable, and anywhere
 * else we want to force the user to re-prove possession of the factor.
 */
export function clearTwoFactorCookie(
  response: NextResponse,
  host: string | undefined,
  protocol: string | undefined
): void {
  response.cookies.set(TWO_FACTOR_COOKIE_NAME, "", {
    httpOnly: true,
    secure: getIsSecure(protocol, host),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
    domain: getCookieDomain(host),
  });
}
