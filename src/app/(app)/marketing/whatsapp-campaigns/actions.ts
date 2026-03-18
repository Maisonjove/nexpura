"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const PRICE_PER_MESSAGE_CENTS = 16; // $0.16 AUD

export async function createWhatsAppCampaign(data: {
  name: string;
  message: string;
  recipient_type: "all" | "segment" | "tags" | "manual";
  recipient_filter: Record<string, unknown>;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { error: "Tenant not found" };

  // Calculate recipient count
  let recipientCount = 0;

  if (data.recipient_type === "all") {
    const { count } = await admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", userData.tenant_id)
      .is("deleted_at", null)
      .not("phone", "is", null);
    recipientCount = count || 0;
  } else if (data.recipient_type === "segment" && data.recipient_filter.segment_id) {
    const { data: segment } = await admin
      .from("customer_segments")
      .select("customer_count")
      .eq("id", data.recipient_filter.segment_id as string)
      .single();
    recipientCount = segment?.customer_count || 0;
  } else if (data.recipient_type === "tags" && Array.isArray(data.recipient_filter.tags)) {
    const { count } = await admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", userData.tenant_id)
      .is("deleted_at", null)
      .not("phone", "is", null)
      .overlaps("tags", data.recipient_filter.tags as string[]);
    recipientCount = count || 0;
  } else if (data.recipient_type === "manual" && Array.isArray(data.recipient_filter.customer_ids)) {
    recipientCount = (data.recipient_filter.customer_ids as string[]).length;
  }

  if (recipientCount === 0) {
    return { error: "No recipients found for this campaign" };
  }

  const amountCents = recipientCount * PRICE_PER_MESSAGE_CENTS;

  const { data: campaign, error } = await admin
    .from("whatsapp_campaigns")
    .insert({
      tenant_id: userData.tenant_id,
      name: data.name,
      message: data.message,
      recipient_type: data.recipient_type,
      recipient_filter: data.recipient_filter,
      recipient_count: recipientCount,
      amount_cents: amountCents,
      price_per_message_cents: PRICE_PER_MESSAGE_CENTS,
      status: "draft",
      payment_status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/marketing/whatsapp-campaigns");
  return { id: campaign.id };
}

export async function createCampaignCheckout(campaignId: string): Promise<{
  checkoutUrl?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id, tenants(name, business_name)")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { error: "Tenant not found" };

  // Get campaign
  const { data: campaign, error: campaignError } = await admin
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (campaignError || !campaign) {
    return { error: "Campaign not found" };
  }

  if (campaign.payment_status === "paid") {
    return { error: "Campaign already paid" };
  }

  const tenantData = userData.tenants as { name?: string; business_name?: string } | null;
  const businessName = tenantData?.business_name || tenantData?.name || "Business";

  try {
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: "WhatsApp Marketing Messages",
              description: `${campaign.recipient_count.toLocaleString()} messages for campaign: ${campaign.name}`,
            },
            unit_amount: PRICE_PER_MESSAGE_CENTS,
          },
          quantity: campaign.recipient_count,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.nexpura.com"}/marketing/whatsapp-campaigns?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.nexpura.com"}/marketing/whatsapp-campaigns?canceled=true`,
      metadata: {
        campaign_id: campaignId,
        tenant_id: userData.tenant_id,
        type: "whatsapp_campaign",
      },
      customer_email: user.email || undefined,
    });

    // Update campaign with Stripe session ID
    await admin
      .from("whatsapp_campaigns")
      .update({
        stripe_session_id: session.id,
        status: "pending_payment",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    // Create purchase record
    await admin.from("marketing_purchases").insert({
      tenant_id: userData.tenant_id,
      campaign_id: campaignId,
      campaign_type: "whatsapp",
      stripe_session_id: session.id,
      amount_cents: campaign.amount_cents,
      message_count: campaign.recipient_count,
      price_per_message_cents: PRICE_PER_MESSAGE_CENTS,
      currency: "aud",
      status: "pending",
    });

    revalidatePath("/marketing/whatsapp-campaigns");
    return { checkoutUrl: session.url! };
  } catch (err) {
    console.error("[createCampaignCheckout] Error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create checkout" };
  }
}

export async function retryCampaignPayment(campaignId: string): Promise<{
  checkoutUrl?: string;
  error?: string;
}> {
  return createCampaignCheckout(campaignId);
}

export async function deleteCampaign(campaignId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { error: "Tenant not found" };

  // Check campaign exists and is deletable
  const { data: campaign } = await admin
    .from("whatsapp_campaigns")
    .select("status, payment_status")
    .eq("id", campaignId)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!campaign) {
    return { error: "Campaign not found" };
  }

  if (campaign.status === "sending" || campaign.status === "sent") {
    return { error: "Cannot delete a campaign that has been sent" };
  }

  if (campaign.payment_status === "paid") {
    return { error: "Cannot delete a paid campaign. Contact support for refunds." };
  }

  const { error } = await admin
    .from("whatsapp_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("tenant_id", userData.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/marketing/whatsapp-campaigns");
  return {};
}
