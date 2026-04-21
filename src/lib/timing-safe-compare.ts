import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

/**
 * Constant-time string equality. Use for every server-side comparison
 * of a secret provided by an untrusted caller (cron bearer tokens,
 * review/staff bypass tokens, HMAC outputs, any shared-secret check).
 *
 * Audit finding (High): previous `authHeader !== "Bearer " + SECRET`
 * comparisons were not constant-time — an attacker with a responsive
 * endpoint could recover the secret byte-by-byte via timing measurements
 * over a few thousand requests. Node's `timingSafeEqual` runs in the
 * same number of operations regardless of where the first byte diverges.
 *
 * Returns false if either input is missing/empty/length-mismatched.
 * The length check is itself NOT timing-safe, but revealing the expected
 * length of a crypto-random token (typically 32-64 chars) is not a
 * meaningful information leak — the token content is what matters.
 */
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return nodeTimingSafeEqual(aBuf, bBuf);
}

/**
 * Extract a Bearer token from an Authorization header and compare it
 * constant-time against the expected value. Returns false if the header
 * is missing, malformed, or doesn't match.
 */
export function safeBearerMatch(authHeader: string | null | undefined, expected: string | null | undefined): boolean {
  if (!authHeader || !expected) return false;
  if (!authHeader.startsWith("Bearer ")) return false;
  return safeCompare(authHeader.slice(7), expected);
}
