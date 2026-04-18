import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get subscription with stripe_customer_id
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      `https://${request.headers.get("host")}`;

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("Portal error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
