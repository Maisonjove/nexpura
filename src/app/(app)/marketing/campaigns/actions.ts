"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendBulkMarketingEmail } from "@/lib/marketing/email";
import { getRecipientsForFilter } from "@/lib/marketing/segments";
import { logAuditEvent } from "@/lib/audit";
import { requireRole } from "@/lib/auth-context";

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
  // W5-CRIT-004: campaign create/edit/send is marketing-admin. Owner/manager only.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can manage campaigns." };
  }

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
  // W5-CRIT-004: owner/manager only.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can manage campaigns." };
  }

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
  // W5-CRIT-004: owner/manager only.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can delete campaigns." };
  }

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
  // W5-CRIT-004: duplicating creates a new send-ready campaign → owner/manager.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can duplicate campaigns." };
  }

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
  // W5-CRIT-004: the blast-the-list endpoint — highest-risk in this file.
  // Owner/manager only. Salesperson/workshop/accountant explicitly blocked.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can send campaigns." };
  }

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

  // Update status to sending.
  // Destructive return-error: this is the "claim the campaign for
  // sending" gate — without it, a parallel sendCampaignNow call could
  // double-blast the recipient list (real money + reputational risk).
  // Surface failure to the UI before any email is dispatched.
  const { error: claimErr } = await admin
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", id);
  if (claimErr) return { error: claimErr.message };

  try {
    // Get recipients
    const recipients = await getRecipientsForFilter(
      tenantId,
      campaign.recipient_type as "all" | "segment" | "tags" | "manual",
      (campaign.recipient_filter as { segment_id?: string; tags?: string[]; customer_ids?: string[] }) || {}
    );

    if (recipients.length === 0) {
      // Destructive return-error: revert the "sending" claim so the
      // user can re-edit the campaign. If this revert fails, the
      // campaign is stuck in "sending" with no actual send running —
      // surface that to the UI rather than swallowing.
      const { error: revertErr } = await admin
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id);
      if (revertErr) return { error: revertErr.message };
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

    // Update campaign stats and status.
    // Destructive return-error: the bulk email already went out above —
    // this update is the system-of-record marker that the campaign was
    // sent (drives "Sent" tab, prevents accidental re-sends, holds the
    // delivery stats). If this fails, the campaign sits in "sending"
    // and the user might re-trigger it; surface the failure rather
    // than silently leaving the row inconsistent.
    const { error: finalizeErr } = await admin
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
    if (finalizeErr) return { error: finalizeErr.message };

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
    // Destructive return-error: catch-block revert from "sending" back
    // to "draft" so the user can retry. If this revert itself fails,
    // the campaign is stuck in "sending" — we surface the underlying
    // send error preferentially (caller cares more about why it failed
    // than about the revert), but log the revert failure so ops can
    // unstick the row manually if needed.
    const { error: revertErr } = await admin
      .from("email_campaigns")
      .update({ status: "draft" })
      .eq("id", id);
    const sendErrMsg = err instanceof Error ? err.message : "Failed to send campaign";
    if (revertErr) {
      return { error: `${sendErrMsg} (additionally, status revert failed: ${revertErr.message} — campaign may be stuck in 'sending')` };
    }
    return { error: sendErrMsg };
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
