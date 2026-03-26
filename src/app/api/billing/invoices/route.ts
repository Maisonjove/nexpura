import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";
import logger from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2026-02-25.clover" });

export async function GET(request: NextRequest) {
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
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 401 });

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
}
