"use server";

// Forgot-password server action.
//
// Historically this page called `supabase.auth.resetPasswordForEmail`
// directly from the browser client. Two problems with that:
//
//   1. Supabase's platform rate-limit (default ~6 req/hr/email or
//      ~30 req/hr/IP) tripped before our Upstash limiter ever saw the
//      request, surfacing as "API rate limit reached" to the user with
//      no email actually sent.
//   2. The client-side call leaked the raw Supabase error string to
//      the user, which is both confusing and (marginally) info-leaky.
//
// The fix: move the call server-side, gate it on our Upstash `auth`
// bucket (keyed by `ip` + normalised `email` so 10/min is shared
// across axes), use the admin client so we control the retry path,
// and ALWAYS return a generic success response regardless of whether
// the email exists — enumeration-safe by construction.

import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { headers } from "next/headers";
import logger from "@/lib/logger";

export type ForgotPasswordResult = {
  ok: boolean;
  // Generic user-facing message. Never reveals whether the email exists.
  message: string;
  // HTTP-ish status for the client to branch on (display vs. input error).
  status: 200 | 400 | 429 | 500;
};

const GENERIC_SUCCESS =
  "If an account exists for that email, we've sent a reset link. Check your inbox (and spam).";

const PLATFORM_RATE_LIMITED =
  "Too many reset requests for this email in the last hour — please wait a bit and try again, or check your inbox for the earlier email.";

const UPSTASH_RATE_LIMITED =
  "Too many requests. Please wait a minute and try again.";

const GENERIC_ERROR =
  "Something went wrong — please try again in a moment.";

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

function resolveRedirectOrigin(h: Headers): string {
  // Prefer the request's own origin so preview branches + localhost all
  // send reset links back to themselves. Falls back to the configured
  // site URL if the header isn't present.
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://nexpura.com";
}

export async function requestPasswordReset(
  formData: FormData
): Promise<ForgotPasswordResult> {
  // 1. Parse + validate input.
  const raw = formData.get("email");
  const parse = forgotPasswordSchema.safeParse({ email: raw ?? "" });
  if (!parse.success) {
    // Enumeration safety: we DO surface "invalid format" (it's
    // client-side obvious anyway from the HTML5 email input), but we
    // never reveal whether the address exists in our DB.
    const first = parse.error.issues[0];
    return {
      ok: false,
      message: first?.message || "Please enter a valid email.",
      status: 400,
    };
  }
  const email = parse.data.email; // already lowercased + trimmed by zod

  // 2. Upstash rate limit — keyed by ip+email so 10/min is shared
  // across both axes. Gives a legitimate user room to retry while
  // preventing enumeration bursts from a single attacker.
  const ip = await getClientIp();
  const rlKey = `forgot-password:${ip}:${email}`;
  const rl = await checkRateLimit(rlKey, "auth");
  if (!rl.success) {
    return {
      ok: false,
      message: UPSTASH_RATE_LIMITED,
      status: 429,
    };
  }

  // 3. Dispatch to Supabase. Use the admin client so we catch platform
  // errors here and translate them to friendly copy, rather than
  // leaking "API rate limit reached" to the user.
  try {
    const admin = createAdminClient();
    const h = await headers();
    const origin = resolveRedirectOrigin(h);
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      // Machine-readable code path (Supabase v2).
      const code = (error as { code?: string }).code ?? "";
      const msg = error.message ?? "";
      const status = (error as { status?: number }).status;
      const isPlatformRateLimited =
        code === "over_email_send_rate_limit" ||
        status === 429 ||
        /rate.?limit/i.test(msg) ||
        /too many requests/i.test(msg);

      if (isPlatformRateLimited) {
        // Still a "soft" result — don't show it as a hard error.
        return { ok: false, message: PLATFORM_RATE_LIMITED, status: 429 };
      }

      // Log the real error server-side for debugging, but never show it.
      logger.error("[forgot-password] supabase reset error", {
        code,
        status,
        // Deliberately not logging email — keeps the log enumeration-safe too.
      });
      return { ok: false, message: GENERIC_ERROR, status: 500 };
    }
  } catch (err) {
    logger.error("[forgot-password] unexpected error", {
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, message: GENERIC_ERROR, status: 500 };
  }

  // 4. Always return generic success. Enumeration-safe.
  return { ok: true, message: GENERIC_SUCCESS, status: 200 };
}
