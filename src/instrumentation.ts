import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Fires once per server boot. Loudly logs if SANDBOX_MODE is on but
    // a live Stripe key is still configured — the exact footgun that
    // lets a preview deploy charge real cards. See src/lib/sandbox.ts.
    const { checkStripeKeyMatchesSandboxMode } = await import("@/lib/sandbox");
    checkStripeKeyMatchesSandboxMode();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
