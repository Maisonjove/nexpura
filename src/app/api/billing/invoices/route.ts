import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withSentryFlush } from "@/lib/sentry-flush";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2026-02-25.clover" });

export const GET = withSentryFlush(async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "api");
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 401 });

    // RBAC: invoices expose tenant billing history (amounts paid, hosted
    // PDF URLs) — same blast radius as the sibling /api/billing/portal
    // and /api/billing/checkout routes, both of which gate on owner.
    // Half-fix-pair audit finding #4 / cleanup #23: invoices was missing
    // the role check, so a staff user with a session could fetch the
    // tenant's invoice history. Mirror the sibling shape exactly.
    if (userData.role !== "owner") {
      // Cleanup #33: copy parity with sibling /api/billing/portal so
      // the UI surfaces identical error text on a same-shape RBAC fail.
      // Previous "Owner only" was correct but terse; lift the more
      // informative phrasing rather than divide the same denial into
      // two flavours.
      return NextResponse.json(
        { error: "Only the tenant owner can manage billing." },
        { status: 403 },
      );
    }

    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: sub.stripe_customer_id,
      limit: 24,
    });

    const result = invoices.data.map((inv) => ({
      id: inv.id,
      amount_paid: inv.amount_paid / 100,
      amount_due: inv.amount_due / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status,
      invoice_pdf: inv.invoice_pdf,
      hosted_invoice_url: inv.hosted_invoice_url,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      number: inv.number,
    }));

    return NextResponse.json({ invoices: result });
  } catch (err) {
    logger.error("Billing invoices error:", err);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
});
