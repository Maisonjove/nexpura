import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_FROM = "notifications@nexpura.com";

/**
 * Get the "from" email address for a tenant
 * Returns the proper from address with business name
 * 
 * Priority:
 * 1. Custom verified domain (e.g., hello@jewellershop.com)
 * 2. Fallback to notifications@nexpura.com with reply-to set to tenant email
 */
export async function getFromAddress(
  tenantId: string,
  type: "invoices" | "quotes" | "notifications" | "marketing" | "receipts" = "notifications"
): Promise<{
  from: string;
  replyTo?: string;
}> {
  const admin = createAdminClient();

  // Get tenant settings
  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name, name, email_from_name, reply_to_email, email")
    .eq("id", tenantId)
    .single();

  if (!tenant) {
    return {
      from: `Nexpura <${DEFAULT_FROM}>`,
    };
  }

  // Check for verified custom domain
  const { data: emailDomain } = await admin
    .from("email_domains")
    .select("domain, verified, from_email")
    .eq("tenant_id", tenantId)
    .eq("verified", true)
    .single();

  const displayName = tenant.email_from_name || tenant.business_name || tenant.name || "Nexpura";

  // If they have a verified custom domain, use it
  if (emailDomain?.verified && emailDomain.domain) {
    const localPart = getLocalPartForType(type);
    const fromEmail = emailDomain.from_email || `${localPart}@${emailDomain.domain}`;
    return {
      from: `${displayName} <${fromEmail}>`,
    };
  }

  // Otherwise use nexpura.com with reply-to
  const replyTo = tenant.reply_to_email || tenant.email;

  return {
    from: `${displayName} <${DEFAULT_FROM}>`,
    replyTo: replyTo || undefined,
  };
}

function getLocalPartForType(type: string): string {
  switch (type) {
    case "invoices":
      return "invoices";
    case "quotes":
      return "quotes";
    case "marketing":
      return "marketing";
    case "receipts":
      return "receipts";
    default:
      return "notifications";
  }
}

/**
 * Get from address for system emails (not tenant-specific)
 */
export function getSystemFromAddress(type: "support" | "nexpura" = "nexpura"): string {
  if (type === "support") {
    return `Nexpura Support <${DEFAULT_FROM}>`;
  }
  return `Nexpura <${DEFAULT_FROM}>`;
}
