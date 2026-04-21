import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import logger from "@/lib/logger";
import { isSandbox, sandboxRedirectEmail, logSandboxSuppressedSend } from "@/lib/sandbox";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    // Sandbox short-circuit — see src/lib/sandbox.ts for the gate rules.
    // Either log-and-drop, or redirect to the QA inbox with a banner
    // so the template can be inspected end-to-end without hitting the
    // real recipient.
    if (isSandbox()) {
      const redirect = sandboxRedirectEmail();
      if (!redirect) {
        logSandboxSuppressedSend({ channel: "email", to: options.to, subject: options.subject, preview: options.html });
        return { success: true, messageId: "sandbox-suppressed" };
      }
      const originalTo = Array.isArray(options.to) ? options.to.join(", ") : options.to;
      const emailConfig = await getTenantEmailConfig(config);
      const banner = `<div style="background:#fff3cd;border:1px solid #ffe69c;padding:12px;margin-bottom:16px;color:#664d03;font-family:sans-serif;"><strong>[SANDBOX]</strong> Originally intended for: ${originalTo}. This copy was redirected to ${redirect} by SANDBOX_REDIRECT_EMAIL.</div>`;
      const { data, error } = await resend.emails.send({
        from: emailConfig.from,
        to: redirect,
        subject: `[SANDBOX] ${options.subject}`,
        html: banner + options.html,
        replyTo: options.replyTo || emailConfig.replyTo,
        attachments: options.attachments,
      });
      if (error) {
        logger.error(`[sendTenantEmail:sandbox-redirect] Error:`, error);
        return { success: false, error: error.message };
      }
      return { success: true, messageId: data?.id };
    }

    const emailConfig = await getTenantEmailConfig(config);

    const { data, error } = await resend.emails.send({
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
    if (isSandbox()) {
      const redirect = sandboxRedirectEmail();
      if (!redirect) {
        logSandboxSuppressedSend({ channel: "email", to: options.to, subject: options.subject, preview: options.html });
        return { success: true, messageId: "sandbox-suppressed" };
      }
      const originalTo = Array.isArray(options.to) ? options.to.join(", ") : options.to;
      const banner = `<div style="background:#fff3cd;border:1px solid #ffe69c;padding:12px;margin-bottom:16px;color:#664d03;font-family:sans-serif;"><strong>[SANDBOX]</strong> Originally intended for: ${originalTo}. This copy was redirected to ${redirect} by SANDBOX_REDIRECT_EMAIL.</div>`;
      const { data, error } = await resend.emails.send({
        from: options.from || `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
        to: redirect,
        subject: `[SANDBOX] ${options.subject}`,
        html: banner + options.html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });
      if (error) {
        logger.error(`[sendSystemEmail:sandbox-redirect] Error:`, error);
        return { success: false, error: error.message };
      }
      return { success: true, messageId: data?.id };
    }

    const { data, error } = await resend.emails.send({
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
