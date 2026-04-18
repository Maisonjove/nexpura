import { getResend } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";

// Default fallback email
const DEFAULT_FROM_EMAIL = "notifications@nexpura.com";
const DEFAULT_FROM_NAME = "Nexpura";

interface EmailConfig {
  tenantId: string;
  type: "quotes" | "invoices" | "marketing" | "notifications" | "receipts";
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 * Get the "from" email address for a tenant
 * Priority:
 * 1. Custom verified domain (e.g., hello@jewellershop.com)
 * 2. Nexpura subdomain (e.g., notifications@nexpura.com with reply-to)
 */
export async function getTenantEmailConfig(config: EmailConfig): Promise<{
  from: string;
  replyTo?: string;
}> {
  const admin = createAdminClient();

  // Get tenant settings
  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name, email_from_name, reply_to_email, email")
    .eq("id", config.tenantId)
    .single();

  if (!tenant) {
    return {
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
    };
  }

  // Check for verified custom domain
  const { data: emailDomain } = await admin
    .from("email_domains")
    .select("domain, verified, resend_domain_id")
    .eq("tenant_id", config.tenantId)
    .eq("verified", true)
    .single();

  const displayName = tenant.email_from_name || tenant.business_name || DEFAULT_FROM_NAME;

  // If they have a verified custom domain, use it
  if (emailDomain?.verified && emailDomain.domain) {
    const localPart = getLocalPartForType(config.type);
    return {
      from: `${displayName} <${localPart}@${emailDomain.domain}>`,
    };
  }

  // Otherwise use nexpura.com with reply-to
  const replyTo = tenant.reply_to_email || tenant.email;

  return {
    from: `${displayName} <${DEFAULT_FROM_EMAIL}>`,
    replyTo: replyTo || undefined,
  };
}

/**
 * Get the local part of email based on type
 */
function getLocalPartForType(type: EmailConfig["type"]): string {
  switch (type) {
    case "quotes":
      return "quotes";
    case "invoices":
      return "invoices";
    case "marketing":
      return "marketing";
    case "receipts":
      return "receipts";
    case "notifications":
    default:
      return "notifications";
  }
}

/**
 * Send an email using the tenant's configured email settings
 */
export async function sendTenantEmail(
  config: EmailConfig,
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const emailConfig = await getTenantEmailConfig(config);

    const { data, error } = await getResend().emails.send({
      from: emailConfig.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || emailConfig.replyTo,
      attachments: options.attachments,
    });

    if (error) {
      logger.error(`[sendTenantEmail] Error:`, error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    logger.error(`[sendTenantEmail] Exception:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send a simple email without tenant context (system emails)
 */
export async function sendSystemEmail(
  options: SendEmailOptions & { from?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data, error } = await getResend().emails.send({
      from: options.from || `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
      attachments: options.attachments,
    });

    if (error) {
      logger.error(`[sendSystemEmail] Error:`, error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    logger.error(`[sendSystemEmail] Exception:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
