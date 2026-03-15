"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export async function emailQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) return { success: false, error: "No tenant found" };

    const admin = createAdminClient();

    // Fetch quote with customer + tenant
    const [quoteResult, tenantResult] = await Promise.all([
      admin
        .from("quotes")
        .select("id, quote_number, total_amount, expires_at, notes, items, created_at, customers(full_name, email)")
        .eq("id", quoteId)
        .eq("tenant_id", userData.tenant_id)
        .single(),
      admin
        .from("tenants")
        .select("name, business_name, email, phone")
        .eq("id", userData.tenant_id)
        .single(),
    ]);

    const quote = quoteResult.data;
    if (!quote) return { success: false, error: "Quote not found" };

    const tenant = tenantResult.data;
    const businessName = tenant?.business_name || tenant?.name || "Your Business";

    const customerRaw = Array.isArray(quote.customers)
      ? (quote.customers[0] ?? null)
      : quote.customers;

    const customerEmail = customerRaw?.email ?? null;
    if (!customerEmail) return { success: false, error: "No customer email on file" };

    const customerName = customerRaw?.full_name || "Valued Customer";
    const quoteNumber = quote.quote_number || quote.id.slice(0, 8).toUpperCase();

    // Build line items HTML
    const items: Array<{ description: string; quantity: number; unit_price: number }> =
      Array.isArray(quote.items) ? quote.items : [];

    const itemRows = items
      .map(
        (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F0EDE8;font-size:14px;color:#1A1A1A;">${item.description}</td>
        <td style="padding:10px 0;border-bottom:1px solid #F0EDE8;font-size:14px;color:#666;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #F0EDE8;font-size:14px;color:#666;text-align:right;">${fmt(item.unit_price)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #F0EDE8;font-size:14px;font-weight:600;color:#1A1A1A;text-align:right;">${fmt(item.quantity * item.unit_price)}</td>
      </tr>`
      )
      .join("");

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote ${quoteNumber}</title></head>
<body style="margin:0;padding:0;background:#F8F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="background:#1A1A1A;border-radius:12px 12px 0 0;padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${businessName}</p>
        </td>
        <td align="right">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;">QUOTE</p>
          <p style="margin:3px 0 0;font-size:20px;font-weight:700;color:#8B7355;">${quoteNumber}</p>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr>
    <td style="background:#fff;padding:36px;">
      <p style="margin:0 0 6px;font-size:15px;color:#1A1A1A;font-weight:600;">Hi ${customerName},</p>
      <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.6;">
        Thank you for your enquiry. Please find your quote details below.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding-bottom:16px;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;" width="33%">Quote #</td>
          <td style="padding-bottom:16px;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;" width="33%">Date</td>
          <td style="padding-bottom:16px;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;" width="33%">Valid Until</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#1A1A1A;font-weight:600;">${quoteNumber}</td>
          <td style="font-size:14px;color:#1A1A1A;font-weight:600;">${fmtDate(quote.created_at)}</td>
          <td style="font-size:14px;color:#1A1A1A;font-weight:600;">${quote.expires_at ? fmtDate(quote.expires_at) : "30 days"}</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;border-radius:8px;border:1px solid #E5E2DE;margin-bottom:24px;">
        <tr>
          <td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr>
                  <th style="text-align:left;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;">Description</th>
                  <th style="text-align:center;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;">Qty</th>
                  <th style="text-align:right;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;">Unit Price</th>
                  <th style="text-align:right;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows || `<tr><td colspan="4" style="text-align:center;padding:16px;color:#999;font-size:13px;">No items</td></tr>`}
              </tbody>
            </table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="text-align:right;font-size:14px;color:#666;">Total</td>
          <td style="text-align:right;font-size:22px;font-weight:700;color:#8B7355;padding-left:24px;">${fmt(quote.total_amount || 0)}</td>
        </tr>
      </table>

      ${quote.notes ? `<div style="background:#FAFAF9;border-left:3px solid #8B7355;border-radius:0 4px 4px 0;padding:12px 16px;margin-bottom:24px;"><p style="margin:0;font-size:13px;color:#666;font-style:italic;">${quote.notes}</p></div>` : ""}

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        To approve this quote or ask any questions, please reply to this email${tenant?.phone ? ` or call us at ${tenant.phone}` : ""}.
      </p>
    </td>
  </tr>
  <tr>
    <td style="background:#F8F5F0;border-radius:0 0 12px 12px;padding:20px 36px;border-top:1px solid #E5E2DE;">
      <p style="margin:0;font-size:11px;color:#aaa;text-align:center;">
        Sent by <strong>${businessName}</strong>${tenant?.phone ? ` | ${tenant.phone}` : ""} using <a href="https://nexpura.com" style="color:#8B7355;text-decoration:none;font-weight:600;">Nexpura</a>
      </p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>`;

    const { error: sendError } = await resend.emails.send({
      from: `${businessName} <quotes@nexpura.com>`,
      to: customerEmail,
      replyTo: tenant?.email ? tenant.email : undefined,
      subject: `Quote ${quoteNumber} from ${businessName}`,
      html: htmlBody,
    });

    if (sendError) return { success: false, error: sendError.message };

    return { success: true };
  } catch (err) {
    console.error("emailQuote error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send quote",
    };
  }
}
