import { resend } from '@/lib/email/resend';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';

interface SendMarketingEmailParams {
  tenantId: string;
  to: string;
  toName?: string;
  subject: string;
  body: string;
  campaignId?: string;
  customerId?: string;
}

interface SendEmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Get the email configuration for a tenant
 * Returns the from address, reply-to, and domain status
 */
export async function getTenantEmailConfig(tenantId: string) {
  const admin = createAdminClient();

  // Get tenant info
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, business_name, email, reply_to_email')
    .eq('id', tenantId)
    .single();

  // Check for verified email domain
  const { data: emailDomain } = await admin
    .from('email_domains')
    .select('domain, verified, from_email')
    .eq('tenant_id', tenantId)
    .eq('verified', true)
    .single();

  const businessName = tenant?.business_name || tenant?.name || 'Business';
  
  // If tenant has verified domain, use that
  if (emailDomain?.verified && emailDomain.from_email) {
    return {
      from: `${businessName} <${emailDomain.from_email}>`,
      replyTo: tenant?.reply_to_email || tenant?.email || emailDomain.from_email,
      hasCustomDomain: true,
    };
  }

  // Otherwise use default nexpura.com with reply-to
  return {
    from: `${businessName} via Nexpura <notifications@nexpura.com>`,
    replyTo: tenant?.reply_to_email || tenant?.email || undefined,
    hasCustomDomain: false,
  };
}

/**
 * Send a marketing email to a customer
 */
export async function sendMarketingEmail(params: SendMarketingEmailParams): Promise<SendEmailResult> {
  const { tenantId, to, toName, subject, body, campaignId, customerId } = params;
  const admin = createAdminClient();

  try {
    // Check if email is bounced or opted-out (don't waste sends)
    if (customerId) {
      const { data: customer } = await admin
        .from('customers')
        .select('email_status, email_opted_out')
        .eq('id', customerId)
        .single();
      
      if (customer?.email_status === 'bounced') {
        return { success: false, error: 'Email address has bounced previously' };
      }
      if (customer?.email_status === 'complained') {
        return { success: false, error: 'Customer has marked emails as spam' };
      }
      if (customer?.email_opted_out) {
        return { success: false, error: 'Customer has opted out of marketing emails' };
      }
    }

    // Get email configuration
    const emailConfig = await getTenantEmailConfig(tenantId);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: toName ? `${toName} <${to}>` : to,
      replyTo: emailConfig.replyTo,
      subject,
      html: body,
    });

    if (error) {
      // Log failed send. Side-effect log+continue: email_sends is the
      // observability ledger for marketing email — a missed row means
      // we lose this failure record but the actual send result already
      // returned to caller via the function's return value.
      const { error: logErr } = await admin.from('email_sends').insert({
        tenant_id: tenantId,
        campaign_id: campaignId || null,
        customer_id: customerId || null,
        email: to,
        subject,
        status: 'failed',
        error_message: error.message,
      });
      if (logErr) {
        logger.error('[marketing/email] failed-send log insert failed (non-fatal — observability gap)', {
          tenantId, to, campaignId, err: logErr,
        });
      }

      return { success: false, error: error.message };
    }

    // Log successful send. Side-effect log+continue: ledger row missing
    // means analytics undercounts but the email was already delivered
    // by Resend. Surfacing failure to caller would falsely report send
    // failure to UI for an email that did go out.
    const { error: sentLogErr } = await admin.from('email_sends').insert({
      tenant_id: tenantId,
      campaign_id: campaignId || null,
      customer_id: customerId || null,
      email: to,
      subject,
      status: 'sent',
      resend_id: data?.id || null,
    });
    if (sentLogErr) {
      logger.error('[marketing/email] sent-log insert failed (non-fatal — email delivered, ledger gap)', {
        tenantId, to, campaignId, resendId: data?.id, err: sentLogErr,
      });
    }

    return { success: true, emailId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Catch-block log row. Side-effect log+continue: same observability
    // role as the failed-send branch above; we already have an error
    // to propagate via return below.
    const { error: catchLogErr } = await admin.from('email_sends').insert({
      tenant_id: tenantId,
      campaign_id: campaignId || null,
      customer_id: customerId || null,
      email: to,
      subject,
      status: 'failed',
      error_message: errorMessage,
    });
    if (catchLogErr) {
      logger.error('[marketing/email] catch-log insert failed (non-fatal — original error returned to caller)', {
        tenantId, to, originalError: errorMessage, err: catchLogErr,
      });
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Replace template variables in email body
 */
export function replaceTemplateVariables(
  body: string,
  variables: Record<string, string>
): string {
  let result = body;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Send bulk marketing emails to multiple customers
 */
export async function sendBulkMarketingEmail(params: {
  tenantId: string;
  subject: string;
  body: string;
  recipients: Array<{ email: string; name?: string; customerId?: string; variables?: Record<string, string> }>;
  campaignId?: string;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { tenantId, subject, body, recipients, campaignId } = params;
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process in batches to avoid rate limiting (Resend allows 100/sec)
  const BATCH_SIZE = 10;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (recipient) => {
        const personalizedBody = recipient.variables
          ? replaceTemplateVariables(body, recipient.variables)
          : body;
        
        const personalizedSubject = recipient.variables
          ? replaceTemplateVariables(subject, recipient.variables)
          : subject;

        const result = await sendMarketingEmail({
          tenantId,
          to: recipient.email,
          toName: recipient.name,
          subject: personalizedSubject,
          body: personalizedBody,
          campaignId,
          customerId: recipient.customerId,
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
          if (result.error) {
            errors.push(`${recipient.email}: ${result.error}`);
          }
        }
      })
    );

    // Small delay between batches to be nice to the API
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { sent, failed, errors };
}
