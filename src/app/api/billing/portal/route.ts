import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { ServerTiming } from "@/lib/server-timing";
import { withSentryFlush } from "@/lib/sentry-flush";

function withTimingHeader(timing: ServerTiming, res: NextResponse): NextResponse {
  const value = timing.toHeader();
  if (value) res.headers.set("Server-Timing", value);
  return res;
}

export const POST = withSentryFlush(async (request: NextRequest) => {
  const timing = new ServerTiming();
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await timing.measure("rate_limit", () =>
    checkRateLimit(ip, "api"),
  );
  if (!success) {
    return withTimingHeader(
      timing,
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await timing.measure("auth_getuser", () => supabase.auth.getUser());

    if (!user) {
      return withTimingHeader(
        timing,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    // RBAC: opening the billing portal lets the holder update payment
    // methods, change plans, or cancel the subscription on behalf of
    // the tenant. Owners only — staff with tenant access shouldn't be
    // able to schedule the tenant's cancellation by clicking "Manage
    // billing". Pre-fix this was open to any authed tenant member.
    const admin = createAdminClient();
    const { data: roleProfile } = await timing.measure("role_lookup", async () =>
      admin
        .from("users")
        .select("tenant_id, role")
        .eq("id", user.id)
        .single(),
    );
    if (!roleProfile?.tenant_id) {
      return withTimingHeader(
        timing,
        NextResponse.json({ error: "User not found" }, { status: 404 }),
      );
    }
    if (roleProfile.role !== "owner") {
      return withTimingHeader(
        timing,
        NextResponse.json(
          { error: "Only the tenant owner can manage billing." },
          { status: 403 },
        ),
      );
    }
    const userData = { tenant_id: roleProfile.tenant_id };

    // Get subscription with stripe_customer_id
    const { data: subscription } = await timing.measure("sub_lookup", async () =>
      supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("tenant_id", userData.tenant_id)
        .single(),
    );

    if (!subscription?.stripe_customer_id) {
      return withTimingHeader(
        timing,
        NextResponse.json(
          { error: "No billing account found" },
          { status: 400 },
        ),
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `https://${request.headers.get("host")}`;

    const session = await timing.measure("stripe_portal_create", () =>
      stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${appUrl}/billing`,
      }),
    );

    return withTimingHeader(timing, NextResponse.json({ url: session.url }));
  } catch (error) {
    logger.error("Portal error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return withTimingHeader(
      timing,
      NextResponse.json({ error: message }, { status: 500 }),
    );
  }
});
