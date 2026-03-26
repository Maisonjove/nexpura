"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendBulkMarketingEmail, replaceTemplateVariables } from "@/lib/marketing/email";
import { getRecipientsForFilter } from "@/lib/marketing/segments";
import { logAuditEvent } from "@/lib/audit";

interface CampaignData {
  name: string;
  subject: string;
  body: string;
  recipient_type: "all" | "segment" | "tags" | "manual";
  recipient_filter: {
    segment_id?: string;
    tags?: string[];
    customer_ids?: string[];
  };
  scheduled_at?: string | null;
}

export async function createCampaign(data: CampaignData) {
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

  const status = data.scheduled_at ? "scheduled" : "draft";

  const { data: campaign, error } = await admin.from("email_campaigns").insert({
    tenant_id: userData.tenant_id,
    name: data.name,
    subject: data.subject,
    body: data.body,
    recipient_type: data.recipient_type,
    recipient_filter: data.recipient_filter,
    scheduled_at: data.scheduled_at || null,
    status,
  }).select().single();

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: userData.tenant_id,
    userId: user.id,
    action: "campaign_create",
    entityType: "campaign",
    entityId: campaign.id,
    newData: { name: data.name, subject: data.subject, recipientType: data.recipient_type },
  });

  revalidatePath("/marketing/campaigns");
  return { success: true, campaign };
}

export async function updateCampaign(id: string, data: Partial<CampaignData>) {
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

  // Check campaign belongs to tenant and is still editable
  const { data: existing } = await admin
    .from("email_campaigns")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!existing) return { error: "Campaign not found" };
  if (existing.status === "sent" || existing.status === "sending") {
    return { error: "Cannot edit a sent or sending campaign" };
  }

  const status = data.scheduled_at ? "scheduled" : "draft";

  const { error } = await admin
    .from("email_campaigns")
    .update({
      ...data,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: userData.tenant_id,
    userId: user.id,
    action: "campaign_update",
    entityType: "campaign",
    entityId: id,
    newData: data as Record<string, unknown>,
  });

  revalidatePath("/marketing/campaigns");
  revalidatePath(`/marketing/campaigns/${id}`);
  return { success: true };
}

export async function deleteCampaign(id: string) {
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

  // Check campaign is not currently sending
  const { data: existing } = await admin
    .from("email_campaigns")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!existing) return { error: "Campaign not found" };
  if (existing.status === "sending") {
    return { error: "Cannot delete a campaign that is currently sending" };
  }

  const { error } = await admin
    .from("email_campaigns")
    .delete()
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id);

  if (error) return { error: error.message };

  await logAuditEvent({
    tenantId: userData.tenant_id,
    userId: user.id,
    action: "campaign_delete",
    entityType: "campaign",
    entityId: id,
    oldData: { name: existing.status },
  });

  revalidatePath("/marketing/campaigns");
  return { success: true };
}

export async function duplicateCampaign(id: string) {
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

  const { data: original } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!original) return { error: "Campaign not found" };

  const { data: newCampaign, error } = await admin.from("email_campaigns").insert({
    tenant_id: userData.tenant_id,
    name: `${original.name} (Copy)`,
    subject: original.subject,
    body: original.body,
    recipient_type: original.recipient_type,
    recipient_filter: original.recipient_filter,
    status: "draft",
  }).select().single();

  if (error) return { error: error.message };

  revalidatePath("/marketing/campaigns");
  return { success: true, campaign: newCampaign };
}

export async function sendCampaignNow(id: string) {
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
  const tenantId = userData.tenant_id;
  const tenantData = userData.tenants as { name?: string; business_name?: string } | null;
  const businessName = tenantData?.business_name || tenantData?.name || "Business";

  // Get campaign
  const { data: campaign } = await admin
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!campaign) return { error: "Campaign not found" };
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { error: "Campaign already sent" };
  }

  // Update status to sending
  await admin
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", id);

  try {
    // Get recipients
    const recipients = await getRecipientsForFilter(
      tenantId,
      campaign.recipient_type as "all" | "segment" | "tags" | "manual",
      (campaign.recipient_filter as { segment_id?: string; tags?: string[]; customer_ids?: string[] }) || {}
    );

    if (recipients.length === 0) {
      await admin
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id);
      return { error: "No recipients found for this campaign" };
    }

    // Prepare recipients with variables
    const recipientData = recipients
      .filter(r => r.email)
      .map(r => ({
        email: r.email!,
        name: r.full_name || undefined,
        customerId: r.id,
        variables: {
          customer_name: r.full_name || "Valued Customer",
          business_name: businessName,
        },
      }));

    // Send emails
    const result = await sendBulkMarketingEmail({
      tenantId,
      subject: campaign.subject,
      body: campaign.body || "",
      recipients: recipientData,
      campaignId: id,
    });

    // Update campaign stats and status
    await admin
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        stats: {
          sent: result.sent,
          opened: 0,
          clicked: 0,
          bounced: result.failed,
        },
      })
      .eq("id", id);

    await logAuditEvent({
      tenantId,
      userId: user.id,
      action: "campaign_send",
      entityType: "campaign",
      entityId: id,
      newData: { 
        sent: result.sent, 
        failed: result.failed, 
        recipientCount: recipientData.length,
        subject: campaign.subject,
      },
    });

    revalidatePath("/marketing/campaigns");
    revalidatePath(`/marketing/campaigns/${id}`);

    return {
      success: true,
      sent: result.sent,
      failed: result.failed,
    };
  } catch (err) {
    await admin
      .from("email_campaigns")
      .update({ status: "draft" })
      .eq("id", id);
    return { error: err instanceof Error ? err.message : "Failed to send campaign" };
  }
}

export async function getRecipientCount(
  recipientType: "all" | "segment" | "tags" | "manual",
  filter: { segment_id?: string; tags?: string[]; customer_ids?: string[] }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { count: 0 };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) return { count: 0 };

  const recipients = await getRecipientsForFilter(
    userData.tenant_id,
    recipientType,
    filter
  );

  return { count: recipients.filter(r => r.email).length };
}
