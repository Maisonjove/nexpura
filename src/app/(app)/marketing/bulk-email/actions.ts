"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendBulkMarketingEmail } from "@/lib/marketing/email";
import { getRecipientsForFilter } from "@/lib/marketing/segments";

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
