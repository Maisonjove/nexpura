/**
 * POST /api/stripe/connect/create-account
 * 
 * Creates a Stripe Connect account for the tenant and returns onboarding URL
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenant
    const admin = createAdminClient();
    const { data: userData } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "No tenant" }, { status: 400 });
    }

    const tenantId = userData.tenant_id;

    // Check if tenant already has a Stripe account
    const { data: tenant } = await admin
      .from("tenants")
      .select("stripe_account_id, business_name, owner_email")
      .eq("id", tenantId)
      .single();

    if (tenant?.stripe_account_id) {
      // Account exists, create new onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: tenant.stripe_account_id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?refresh=true`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?success=true`,
        type: "account_onboarding",
      });

      return NextResponse.json({ url: accountLink.url });
    }

    // Parse request body for business name
    const body = await req.json().catch(() => ({}));
    const businessName = body.businessName || tenant?.business_name || "Business";

    // Create new Connect account (Standard type)
    const account = await stripe.accounts.create({
      type: "standard",
      business_type: "company",
      company: {
        name: businessName,
      },
      email: tenant?.owner_email || user.email,
      metadata: {
        tenant_id: tenantId,
      },
    });

    // Save account ID to tenant
    await admin
      .from("tenants")
      .update({ stripe_account_id: account.id })
      .eq("id", tenantId);

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payments?success=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ 
      accountId: account.id,
      url: accountLink.url,
    });
  } catch (err) {
    console.error("[stripe/connect/create-account]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create account" },
      { status: 500 }
    );
  }
}
