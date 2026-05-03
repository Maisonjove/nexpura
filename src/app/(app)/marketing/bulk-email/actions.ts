"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendBulkMarketingEmail, sendMarketingEmail } from "@/lib/marketing/email";
import { getRecipientsForFilter } from "@/lib/marketing/segments";
import { requireRole } from "@/lib/auth-context";

interface BulkEmailData {
  subject: string;
  body: string;
  recipient_type: "all" | "segment" | "tags" | "manual";
  recipient_filter: {
    segment_id?: string;
    tags?: string[];
    customer_ids?: string[];
  };
}

export async function sendBulkEmail(data: BulkEmailData) {
  // W5-CRIT-004: bulk-email is the direct blast endpoint. Owner/manager only.
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can send bulk emails." };
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

  try {
    // Get recipients
    const recipients = await getRecipientsForFilter(
      tenantId,
      data.recipient_type,
      data.recipient_filter
    );

    if (recipients.length === 0) {
      return { error: "No recipients found with valid email addresses" };
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
      subject: data.subject,
      body: data.body,
      recipients: recipientData,
    });

    revalidatePath("/marketing");
    revalidatePath("/marketing/bulk-email");

    return {
      success: true,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors.slice(0, 5), // Limit errors shown
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send emails" };
  }
}

/**
 * Sandbox send: route the same campaign payload to ONLY the authed
 * user's email address — never to any customer. This is the
 * "test-yourself-first" path required by Joey's master operating
 * manual rule 7. Owner/manager only (same gate as bulk send).
 *
 * Behaviour:
 *  - Reads the authed user's email from auth.users (not from a form
 *    field) so a malicious form submission can't reroute the test
 *    elsewhere.
 *  - Skips the customer_id linkage so this send doesn't pollute any
 *    customer's communications history or campaign analytics.
 *  - No customer_segments query — there's no "audience" for a test.
 */
export async function sendTestEmail(data: {
  subject: string;
  body: string;
}): Promise<{ success?: boolean; error?: string; sentTo?: string }> {
  try {
    await requireRole("owner", "manager");
  } catch {
    return { error: "Only owner or manager can send test emails." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Authed user has no email on file." };

  const admin = createAdminClient();
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) return { error: "Tenant not found" };

  if (!data.subject?.trim() || !data.body?.trim()) {
    return { error: "Subject and body are required for the test send." };
  }

  const result = await sendMarketingEmail({
    tenantId: userData.tenant_id,
    to: user.email,
    toName: "Test recipient",
    subject: `[TEST] ${data.subject}`,
    body: data.body,
    // No campaignId / customerId — keeps this send out of analytics +
    // out of any customer's history.
  });

  if (!result.success) {
    return { error: result.error ?? "Test send failed" };
  }
  return { success: true, sentTo: user.email };
}

