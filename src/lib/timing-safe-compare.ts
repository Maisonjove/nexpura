/**
 * Constant-time string equality. Use for every server-side comparison
 * of a secret provided by an untrusted caller (cron bearer tokens,
 * review/staff bypass tokens, HMAC outputs, any shared-secret check).
 *
 * Audit finding (High): previous `authHeader !== "Bearer " + SECRET`
 * comparisons were not constant-time — an attacker with a responsive
 * endpoint could recover the secret byte-by-byte via timing measurements
 * over a few thousand requests. This implementation XOR's every byte
 * of both inputs in the same number of operations regardless of where
 * the first byte diverges.
 *
 * Runtime: this module is imported from middleware (Edge Runtime) and
 * API routes (Node runtime), so we avoid Node's `crypto` module and
 * `Buffer` and rely only on built-in `TextEncoder` + plain JS.
 *
 * Returns false if either input is missing/empty/length-mismatched.
 * The length check is itself NOT timing-safe, but revealing the expected
 * length of a crypto-random token (typically 32-64 chars) is not a
 * meaningful information leak — the token content is what matters.
 *
 * --------------------------------------------------------------
 * Timing-safe sweep audit (P2-A Item 7, 2026-05-05)
 * --------------------------------------------------------------
 * Grepped src/ for direct `===` / `!==` comparisons of any value
 * holding a secret/token/bearer/HMAC payload, plus all
 * `process.env.*SECRET*` and `process.env.*TOKEN*` reads. Findings:
 *
 *   - All cron route handlers use `safeBearerMatch` against
 *     CRON_SECRET (cleanup, daily-tasks-digest, fx-refresh,
 *     grace-period-checker, migration-chunk-runner, overdue-invoices,
 *     payment-required, process-tenant-deletions, scheduled-reports,
 *     shopify-reconciliation, totp-pending-sweep, trial-end-checker,
 *     webhook-audit-summary).
 *   - All webhook handlers (Stripe, Stripe-marketing, Resend) verify
 *     signatures via node:crypto.timingSafeEqual inside
 *     `src/lib/webhook-security.ts`.
 *   - Review/staff bypass tokens in `src/lib/auth/review.ts` use
 *     `safeCompare`.
 *   - Middleware bearer/cookie checks (review token, AAL2 cookie,
 *     shell cookie) all use safeCompare or its Web Crypto equivalent
 *     in `src/lib/auth/two-factor-cookie.ts` /
 *     `src/lib/dashboard/shell-cookie.ts`.
 *   - Outbound `Bearer ${apiKey}` headers (Resend, OpenAI, Stripe,
 *     Google, Shopify, Xero, Mailchimp, WhatsApp) are interpolations,
 *     NOT comparisons — out of scope.
 *
 * No remaining direct-comparison sites identified. If a new
 * secret-handling endpoint lands, route the comparison through
 * `safeCompare` / `safeBearerMatch` / `crypto.timingSafeEqual` and
 * leave a comment pointing back here.
 */
const textEncoder = new TextEncoder();

export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aBuf = textEncoder.encode(a);
  const bBuf = textEncoder.encode(b);
  if (aBuf.length !== bBuf.length) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) {
    diff |= aBuf[i] ^ bBuf[i];
  }
  return diff === 0;
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
