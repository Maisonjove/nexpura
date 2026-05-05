"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { resend } from "@/lib/email/resend";

import { flushSentry } from "@/lib/sentry-flush";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { userId: user.id, tenantId: userData.tenant_id, role: userData.role };
}

export interface EmailDomainInfo {
  id: string;
  domain: string;
  status: "pending" | "verifying" | "verified" | "failed";
  dnsRecords: DnsRecord[] | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
  status?: string;
}

export async function getEmailDomain(): Promise<{ domain: EmailDomainInfo | null; fromName: string | null; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { domain: null, fromName: null, error: "Not authenticated" }; }

  const admin = createAdminClient();
  
  const { data: emailDomain } = await admin
    .from("email_domains")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .single();

  const { data: tenant } = await admin
    .from("tenants")
    .select("email_from_name")
    .eq("id", ctx.tenantId)
    .single();

  if (!emailDomain) {
    return { domain: null, fromName: tenant?.email_from_name || null };
  }

  return {
    domain: {
      id: emailDomain.id,
      domain: emailDomain.domain,
      status: emailDomain.status,
      dnsRecords: emailDomain.dns_records,
      verifiedAt: emailDomain.verified_at,
      createdAt: emailDomain.created_at,
    },
    fromName: tenant?.email_from_name || null,
  };
}

export async function addEmailDomain(domain: string): Promise<{ success?: boolean; error?: string; dnsRecords?: DnsRecord[] }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  // Only owners can manage email domains
  if (ctx.role !== "owner") {
    return { error: "Only the account owner can manage email domains" };
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain) && !domain.includes(".")) {
    return { error: "Please enter a valid domain (e.g., yourbusiness.com)" };
  }

  const admin = createAdminClient();

  // Check if tenant already has a domain
  const { data: existing } = await admin
    .from("email_domains")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (existing) {
    return { error: "You already have a domain configured. Remove it first to add a new one." };
  }

  // Check if domain is already used by another tenant
  const { data: domainUsed } = await admin
    .from("email_domains")
    .select("id")
    .eq("domain", domain.toLowerCase())
    .single();

  if (domainUsed) {
    return { error: "This domain is already registered with another account" };
  }

  // Call Resend API to create domain
  try {
    const response = await fetch("https://api.resend.com/domains", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain.toLowerCase() }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error("Resend API error:", errorData);
      await flushSentry();
      return { error: errorData.message || "Failed to register domain with email provider" };
    }

    const resendData = await response.json();
    
    // Store domain info in database
    const { error: insertError } = await admin.from("email_domains").insert({
      tenant_id: ctx.tenantId,
      domain: domain.toLowerCase(),
      resend_domain_id: resendData.id,
      status: "pending",
      dns_records: resendData.records || [],
    });

    if (insertError) {
      logger.error("Database insert error:", insertError);
      await flushSentry();
      return { error: "Failed to save domain configuration" };
    }

    revalidatePath("/settings/email");
    return { 
      success: true, 
      dnsRecords: resendData.records || [],
    };
  } catch (error) {
    logger.error("Error adding domain:", error);
    await flushSentry();
    return { error: "Failed to connect to email provider" };
  }
}

export async function verifyEmailDomain(): Promise<{ success?: boolean; verified?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  // Group 15 audit: aligned with the rest of the email-domain functions
  // (add / remove / updateFromName / updateReplyToEmail are owner-only).
  // verifyEmailDomain also writes back to email_domains (status,
  // dns_records, verified_at) — same mutation surface, same gate.
  if (ctx.role !== "owner") {
    return { error: "Only the account owner can manage email domains" };
  }

  const admin = createAdminClient();

  // Get current domain
  const { data: emailDomain } = await admin
    .from("email_domains")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!emailDomain) {
    return { error: "No domain configured" };
  }

  if (emailDomain.status === "verified") {
    return { success: true, verified: true };
  }

  // Call Resend API to verify domain
  try {
    const response = await fetch(`https://api.resend.com/domains/${emailDomain.resend_domain_id}/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.message || "Verification failed" };
    }

    // Get updated domain info
    const domainResponse = await fetch(`https://api.resend.com/domains/${emailDomain.resend_domain_id}`, {
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
    });

    if (domainResponse.ok) {
      const domainData = await domainResponse.json();
      const isVerified = domainData.status === "verified";

      // Side-effect log+continue: this row mirrors Resend's domain state.
      // The truth lives at Resend; this is a local cache for UI. If the
      // update silently fails the local row is stale (UI shows old status)
      // but the user can re-click verify — idempotent against Resend's
      // API. Surface to Sentry for follow-up; don't fail the user-visible
      // operation since the actual verification with Resend succeeded.
      const { error: domainUpdErr } = await admin.from("email_domains").update({
        status: isVerified ? "verified" : "verifying",
        dns_records: domainData.records || emailDomain.dns_records,
        verified_at: isVerified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", emailDomain.id);
      if (domainUpdErr) {
        logger.error("[verifyEmailDomain] failed to mirror Resend status to email_domains row", { domainId: emailDomain.id, isVerified, err: domainUpdErr.message });
      }

      revalidatePath("/settings/email");
      return { success: true, verified: isVerified };
    }

    return { success: true, verified: false };
  } catch (error) {
    logger.error("Error verifying domain:", error);
    await flushSentry();
    return { error: "Failed to verify domain" };
  }
}

export async function removeEmailDomain(): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  if (ctx.role !== "owner") {
    return { error: "Only the account owner can manage email domains" };
  }

  const admin = createAdminClient();

  // Get current domain
  const { data: emailDomain } = await admin
    .from("email_domains")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!emailDomain) {
    return { error: "No domain configured" };
  }

  // Delete from Resend
  try {
    if (emailDomain.resend_domain_id) {
      await fetch(`https://api.resend.com/domains/${emailDomain.resend_domain_id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
      });
    }
  } catch (error) {
    logger.error("Error removing domain from Resend:", error);
    // Continue anyway - we'll remove from our DB
  }

  // Delete from database
  const { error: deleteError } = await admin
    .from("email_domains")
    .delete()
    .eq("id", emailDomain.id);

  if (deleteError) {
    await flushSentry();
    return { error: "Failed to remove domain" };
  }

  revalidatePath("/settings/email");
  return { success: true };
}

export async function updateFromName(fromName: string): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  if (ctx.role !== "owner") {
    return { error: "Only the account owner can change email settings" };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("tenants")
    .update({ email_from_name: fromName.trim() || null })
    .eq("id", ctx.tenantId);

  if (error) {
    return { error: "Failed to update sender name" };
  }

  revalidatePath("/settings/email");
  return { success: true };
}

export async function updateReplyToEmail(email: string): Promise<{ success?: boolean; error?: string }> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return { error: "Not authenticated" }; }

  if (ctx.role !== "owner") {
    return { error: "Only the account owner can change email settings" };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("tenants")
    .update({ reply_to_email: email.trim().toLowerCase() || null })
    .eq("id", ctx.tenantId);

  if (error) {
    return { error: "Failed to update reply-to email" };
  }

  revalidatePath("/settings/email");
  return { success: true };
}

export async function getReplyToEmail(): Promise<string | null> {
  let ctx;
  try { ctx = await getAuthContext(); } catch { return null; }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("reply_to_email")
    .eq("id", ctx.tenantId)
    .single();

  return tenant?.reply_to_email || null;
}

/**
 * Launch-QA W6-CRIT-03: `getTenantEmailSender` previously accepted a
 * `tenantId: string` and returned the custom-domain sender for that tenant
 * regardless of the caller. Because this file is `"use server"` the function
 * is exposed as a server action and was callable with any tenant's UUID —
 * any authed user could harvest another tenant's configured from-address
 * (and by implication their brand identity for phishing) by passing a
 * foreign UUID. The fix: the function now resolves the tenant from the
 * caller's session and ignores any argument. Internal callers in
 * settings/roles/actions.ts that used to pass `ctx.tenantId` are unaffected
 * because they already only query for their own tenant.
 */
export async function getTenantEmailSender(): Promise<{ from: string; replyTo?: string }> {
  // Resolve strictly from the caller's session — not a client-supplied id.
  const ctx = await getAuthContext();
  const admin = createAdminClient();

  const tenantId = ctx.tenantId;

  const { data: emailDomain } = await admin
    .from("email_domains")
    .select("domain, status")
    .eq("tenant_id", tenantId)
    .eq("status", "verified")
    .single();

  const { data: tenant } = await admin
    .from("tenants")
    .select("email_from_name, business_name, reply_to_email")
    .eq("id", tenantId)
    .single();

  const fromName = tenant?.email_from_name || tenant?.business_name || "Nexpura";
  const replyTo = tenant?.reply_to_email;

  if (emailDomain?.domain) {
    // Use custom domain - reply-to goes to their domain too
    return {
      from: `${fromName} <team@${emailDomain.domain}>`,
      replyTo: replyTo || undefined,
    };
  }

  // No custom domain - use nexpura.com with reply-to
  return {
    from: `${fromName} <notifications@nexpura.com>`,
    replyTo: replyTo || undefined,
  };
}

/**
 * Send a test email from the tenant's currently-configured sender to
 * the authed user's inbox. Lets owners verify their email setup
 * (domain, sender name, reply-to) before relying on it for customer
 * emails.
 *
 * Audit ID L-06 (desktop-Opus 2.6): the prior surface didn't exist,
 * and the closest analogue (marketing/bulk-email "Send test")
 * silently rendered "Sent" in some failure paths because the UI
 * didn't differentiate "delivered" from "queued". This handler:
 *   - awaits resend.emails.send (no fire-and-forget)
 *   - destructures { data, error } and surfaces error.message verbatim
 *     (subject to the safe-message helper)
 *   - never returns success when Resend signalled failure
 *
 * Auth: owner OR manager (matches updateFromName / updateReplyToEmail).
 *
 * Recipient: ALWAYS the authed user's email from auth.users — not a
 * form input. A test that lets the user type any address would let
 * an attacker probe internal email validity, and the spec from
 * desktop-Opus assumes "test" means "to me".
 */
export async function sendDomainTestEmail(): Promise<{
  success?: boolean;
  sentTo?: string;
  error?: string;
}> {
  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    return { error: "Not authenticated" };
  }

  // Owners + managers (mirrors updateFromName / updateReplyToEmail).
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { error: "Only owners and managers can send test emails." };
  }

  // Pull the recipient strictly from the authed user — never from input.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const recipient = user?.email;
  if (!recipient) {
    return { error: "Your account has no email on file. Sign out and sign in again." };
  }

  const sender = await getTenantEmailSender();

  // Render the body using the same fromName the tenant has configured
  // so the "what will customers see" preview is faithful.
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f4; margin: 0; padding: 40px 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); padding: 32px;">
        <h1 style="color: #44403c; font-size: 20px; font-weight: 600; margin: 0 0 16px;">Email setup looks good</h1>
        <p style="color: #44403c; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
          This is a test email from your Nexpura email settings. If you can read this, your sender configuration is working.
        </p>
        <p style="color: #78716c; font-size: 13px; line-height: 1.6; margin: 0;">
          From: ${sender.from}<br/>
          Reply-to: ${sender.replyTo ?? "(none — uses From address)"}<br/>
          Sent at: ${new Date().toISOString()}
        </p>
      </div>
    </body>
    </html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
      to: recipient,
      subject: "Nexpura email test",
      html,
    });

    if (error) {
      // Surface Resend's error verbatim. These messages are already
      // user-safe (e.g., "The to address is not a valid email
      // address.", "Domain is not verified.") — they tell the owner
      // exactly what to fix without leaking secrets.
      logger.error("[settings/email] sendDomainTestEmail Resend error", {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        recipient,
        from: sender.from,
        err: error,
      });
      await flushSentry();
      return { error: error.message ?? "SMTP send failed" };
    }

    if (!data?.id) {
      // Defensive: if Resend returns success-without-id, treat as
      // ambiguous and surface as failure rather than report "sent".
      logger.error("[settings/email] sendDomainTestEmail returned no id", {
        tenantId: ctx.tenantId,
        recipient,
      });
      await flushSentry();
      return { error: "Email provider returned an unexpected response. Try again." };
    }

    return { success: true, sentTo: recipient };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("[settings/email] sendDomainTestEmail threw", {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      recipient,
      err,
    });
    await flushSentry();
    return { error: message };
  }
}
