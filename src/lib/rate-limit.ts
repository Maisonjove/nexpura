import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

// Postgres-backed rate limiting.
//
// This replaces the prior Upstash/Redis limiter. Approved stack is
// Supabase + Vercel only — no external cache services. See
// supabase/migrations/20260424_postgres_rate_limit_and_login_attempts.sql
// for the table + RPC.
//
// Fail-CLOSED posture. Audit finding: the original Upstash impl returned
// { success: true } whenever env vars were missing, which turned every
// rate-limited endpoint (login, 2FA verify, invite accept,
// bespoke approval-response, POS refund) into an unthrottled surface if
// env ever went unset. Same invariant here — if the DB call fails, we
// deny the request in production. Better a brief 503 wave than a
// brute-force window.
//
// Window algorithm: fixed-window via
// `check_and_increment_rate_limit(key, limit, window_seconds)` RPC. This
// permits up to 2× the configured rate at a boundary (standard trade-off
// for O(1) SQL limiters; identical to Upstash's approximation). The
// absolute per-minute cap is still bounded and the login-attempt module
// sits on top as a stricter anti-brute-force layer.

export type RateLimitType =
  | "api"
  | "auth"
  | "ai"
  | "webhook"
  | "heavy"
  | "pdf"
  | "export"
  | "shop";

interface BucketConfig {
  limit: number;
  windowSeconds: number;
}

// Keep parity with the previous Upstash slidingWindow(N, "60 s") configs.
//
// `shop` (P3 Probe 5, 2026-05-05): tighter anti-spam bucket for the public
// /api/shop/[subdomain]/* routes (enquiry, repair-enquiry, appointment,
// repair-track). 10/min/IP matches the auth bucket — anon submissions
// shouldn't be more permissive than authenticated logins. Pre-fix these
// shared the 100/min `api` bucket, which left the public surface 10x
// looser than the rest of the auth-touching app.
const BUCKETS: Record<RateLimitType, BucketConfig> = {
  api: { limit: 100, windowSeconds: 60 },
  auth: { limit: 10, windowSeconds: 60 },
  ai: { limit: 20, windowSeconds: 60 },
  webhook: { limit: 50, windowSeconds: 60 },
  heavy: { limit: 5, windowSeconds: 60 },
  pdf: { limit: 10, windowSeconds: 60 },
  export: { limit: 3, windowSeconds: 60 },
  shop: { limit: 10, windowSeconds: 60 },
};

// Types mirror the previous API so the 120+ call sites don't need changes.
export interface RateLimitResult {
  success: boolean;
  remaining?: number;
}

export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = "api",
): Promise<RateLimitResult> {
  const cfg = BUCKETS[type];
  if (!cfg) {
    logger.error("[rate-limit] unknown bucket type", { type });
    return { success: false };
  }

  // Key format keeps each bucket isolated so an "api" burst from a user
  // doesn't starve the same user's "auth" allowance.
  const key = `${type}:${identifier}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
      p_key: key,
      p_limit: cfg.limit,
      p_window_seconds: cfg.windowSeconds,
    });

    if (error || !data) {
      // Fail-CLOSED. In dev/test an explicit localhost allow-list keeps
      // the app testable when the DB is offline.
      if (process.env.NODE_ENV !== "production") {
        const isLocalOrTest = /^(::1|127\.0\.0\.1|localhost|anonymous|test:)/.test(identifier);
        if (isLocalOrTest) return { success: true };
      }
      logger.error("[rate-limit] denying request — RPC error", {
        identifier: key,
        type,
        error: error?.message,
      });
      return { success: false };
    }

    const result = data as {
      success: boolean;
      remaining: number;
    };
    return { success: result.success, remaining: result.remaining };
  } catch (err) {
    // DB unreachable. Fail-closed.
    if (process.env.NODE_ENV !== "production") {
      const isLocalOrTest = /^(::1|127\.0\.0\.1|localhost|anonymous|test:)/.test(identifier);
      if (isLocalOrTest) return { success: true };
    }
    logger.error("[rate-limit] denying request — RPC threw", {
      identifier: key,
      type,
      error: err,
    });
    return { success: false };
  }
}

// Legacy export preserved for backward compatibility. A handful of call
// sites still reference `ratelimit.limit(id)` or `rateLimiters[type]` —
// the thin shim below keeps them working without a code change.
export const rateLimiters: Record<RateLimitType, { limit: (id: string) => Promise<RateLimitResult> }> = {
  api: { limit: (id: string) => checkRateLimit(id, "api") },
  auth: { limit: (id: string) => checkRateLimit(id, "auth") },
  ai: { limit: (id: string) => checkRateLimit(id, "ai") },
  webhook: { limit: (id: string) => checkRateLimit(id, "webhook") },
  heavy: { limit: (id: string) => checkRateLimit(id, "heavy") },
  pdf: { limit: (id: string) => checkRateLimit(id, "pdf") },
  export: { limit: (id: string) => checkRateLimit(id, "export") },
  shop: { limit: (id: string) => checkRateLimit(id, "shop") },
};

export const ratelimit = rateLimiters.api;
