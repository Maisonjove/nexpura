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
 * Paranoid startup assert: if sandbox mode is on but a live Stripe key
 * is configured, fail loudly. The common mistake this prevents is
 * "oh, I set SANDBOX_MODE=true in preview but forgot to swap to the
 * test STRIPE_SECRET_KEY — my checkout hits live Stripe from a sandbox
 * deploy." Call this once at startup from instrumentation.ts.
 *
 * We deliberately don't crash the whole app — a Stripe mismatch in a
 * preview deploy isn't a security breach, it just means card events
 * go to the wrong Stripe account. A loud logger.error is enough.
 */
export function checkStripeKeyMatchesSandboxMode(): void {
  if (!isSandbox()) return;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return;
  if (key.startsWith("sk_live_")) {
    logger.error(
      "[sandbox] LIVE Stripe key detected in a sandbox-mode deployment. " +
      "Swap STRIPE_SECRET_KEY to an sk_test_… key in this environment's " +
      "Vercel env vars. Real Stripe charges are still possible right now.",
      { vercelEnv: process.env.VERCEL_ENV, nodeEnv: process.env.NODE_ENV },
    );
  }
}
