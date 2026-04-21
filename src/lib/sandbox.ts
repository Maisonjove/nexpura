// sandbox.ts — single source of truth for "am I allowed to hit real
// customers right now?"
//
// Three outbound surfaces route through this: Resend email, Twilio SMS,
// Twilio WhatsApp. If isSandbox() returns true, those senders short-
// circuit: log the intent, return fake success, never hit the real API.
//
// Why centralise it here instead of `NODE_ENV !== "production"` checks
// sprinkled in each sender:
//   1. Vercel preview deployments run with NODE_ENV=production too — a
//      naive check would let preview builds text real customers.
//   2. We sometimes want prod (NODE_ENV=production) with sandbox-mode ON
//      for a demo tenant; one env var to toggle is cleaner than patching
//      code to fake a setting.
//   3. A single place to add future guards (Stripe, webhooks, cron) as
//      we bring them under the same umbrella.
//
// Enabling sandbox mode:
//   - set SANDBOX_MODE=true explicitly, OR
//   - Vercel preview/dev deployments (VERCEL_ENV !== "production"), OR
//   - local dev (NODE_ENV === "development").
//
// Optional: set SANDBOX_REDIRECT_EMAIL to a single inbox; sandbox email
// sends are rewritten to that address with a banner noting the original
// recipient, so QA can visually inspect the rendered template without
// touching real customers.

import logger from "@/lib/logger";

export function isSandbox(): boolean {
  if (process.env.SANDBOX_MODE === "true") return true;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export function sandboxRedirectEmail(): string | undefined {
  const v = process.env.SANDBOX_REDIRECT_EMAIL?.trim();
  return v && v.length > 0 ? v : undefined;
}

/**
 * Log-only record of a send intent that was suppressed by sandbox mode.
 * Appears in Vercel logs as structured JSON so QA can verify what
 * *would* have gone out to whom.
 */
export function logSandboxSuppressedSend(args: {
  channel: "email" | "sms" | "whatsapp";
  to: string | string[];
  subject?: string;
  preview?: string;
}) {
  logger.info("[sandbox] suppressed outbound send", {
    channel: args.channel,
    to: args.to,
    subject: args.subject,
    preview: args.preview?.slice(0, 140),
    sandboxMode: true,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}

/**
 * Startup assert: if sandbox mode is on but a live Stripe key is
 * configured, THROW. Audit finding: previously this logged a warning
 * and returned — meaning a preview deployment with the wrong env could
 * charge real customer cards during QA. A wrong Stripe account is a
 * money-loss event, so we hard-fail boot.
 *
 * Called from instrumentation.ts at server start so a misconfigured
 * deploy cannot serve traffic.
 *
 * Also: in production, require an `sk_` prefix at all — nothing should
 * boot in prod with an empty or malformed Stripe key. Missing key in
 * prod means checkout, webhooks, and billing all silently break.
 */
export function checkStripeKeyMatchesSandboxMode(): void {
  const key = process.env.STRIPE_SECRET_KEY;

  if (isSandbox()) {
    if (key && key.startsWith("sk_live_")) {
      const msg =
        "[sandbox] Refusing to boot: LIVE Stripe key detected in a sandbox-mode deployment. " +
        "SANDBOX_MODE / VERCEL_ENV=preview / NODE_ENV=development cannot use sk_live_*. " +
        "Swap STRIPE_SECRET_KEY to an sk_test_… key in this environment's Vercel env vars.";
      logger.error(msg, { vercelEnv: process.env.VERCEL_ENV, nodeEnv: process.env.NODE_ENV });
      throw new Error(msg);
    }
    return;
  }

  // Production: require the key exists and is a live key.
  if (process.env.NODE_ENV === "production") {
    if (!key) {
      throw new Error("[stripe] Refusing to boot: STRIPE_SECRET_KEY required in production.");
    }
    if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) {
      throw new Error("[stripe] Refusing to boot: production must use sk_live_ / rk_live_ keys.");
    }
  }
}
