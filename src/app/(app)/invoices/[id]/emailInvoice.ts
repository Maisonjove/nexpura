"use server";

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { InvoicePDF } from "@/lib/pdf/InvoicePDF";
import { getTenantEmailConfig } from "@/lib/email-sender";
import { Resend } from "resend";
import React, { type JSXElementConstructor, type ReactElement } from "react";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString(
      "en-AU",
      { day: "2-digit", month: "short", year: "numeric" }
    );
  } catch {
    return d;
  }
}

function fmt(amount: number): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export async function emailInvoice(
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Auth + get tenant
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    const { data: userData } = await createAdminClient()
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return { success: false, error: "No tenant found" };
    }

    // 2. Fetch invoice with customers join + line_items + tenant
    const [invoiceResult, lineItemsResult, tenantResult] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          `id, invoice_number, status, invoice_date, due_date,
           subtotal, tax_amount, discount_amount, total, paid_at,
           tax_name, tax_rate, tax_inclusive, notes, footer_text,
           customer_id,
           customers(full_name, email, phone, address)`
        )
        .eq("id", invoiceId)
        .eq("tenant_id", userData.tenant_id)
        .single(),

      supabase
        .from("invoice_line_items")
        .select("description, quantity, unit_price, discount_pct, total")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true }),

      supabase
        .from("tenants")
        .select(
          "name, business_name, abn, logo_url, phone, email, address_line1, suburb, state, postcode, bank_name, bank_bsb, bank_account, invoice_footer, tax_name, tax_rate, tax_inclusive, invoice_accent_color"
        )
        .eq("id", userData.tenant_id)
        .single(),
    ]);

    const invoice = invoiceResult.data;
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    const tenant = tenantResult.data;
    const lineItemsRaw = lineItemsResult.data ?? [];

    // Get customer
    const customerRaw = Array.isArray(invoice.customers)
      ? (invoice.customers[0] ?? null)
      : invoice.customers;

    // Check customer email
    const customerEmail = customerRaw?.email ?? null;
    if (!customerEmail) {
      return { success: false, error: "No customer email on file" };
    }

    // 3. Compute amount_paid/amount_due
    const isPaid = invoice.status === "paid";
    const amount_paid = isPaid ? (invoice.total ?? 0) : 0;
    const amount_due = isPaid ? 0 : (invoice.total ?? 0);

    const invoiceData = {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date ?? null,
      paid_at: invoice.paid_at ?? null,
      subtotal: invoice.subtotal ?? 0,
      tax_amount: invoice.tax_amount ?? 0,
      discount_amount: invoice.discount_amount ?? 0,
      total: invoice.total ?? 0,
      amount_paid,
      amount_due,
      tax_name: invoice.tax_name ?? "GST",
      tax_rate: invoice.tax_rate ?? 0.1,
      tax_inclusive: invoice.tax_inclusive ?? true,
      notes: invoice.notes ?? null,
      footer_text: invoice.footer_text ?? null,
      customers: customerRaw
        ? {
            full_name: customerRaw.full_name ?? null,
            email: customerRaw.email ?? null,
            phone: customerRaw.phone ?? null,
            address: customerRaw.address ?? null,
          }
        : null,
    };

    const lineItems = lineItemsRaw.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      discount_pct: Number(item.discount_pct ?? 0),
      total: Number(
        (item as Record<string, unknown>).total ??
          0
      ),
    }));

    const tenantData = tenant
      ? {
          name: tenant.name ?? "",
          business_name: tenant.business_name ?? null,
          abn: tenant.abn ?? null,
          logo_url: tenant.logo_url ?? null,
          phone: tenant.phone ?? null,
          email: tenant.email ?? null,
          address_line1: tenant.address_line1 ?? null,
          suburb: tenant.suburb ?? null,
          state: tenant.state ?? null,
          postcode: tenant.postcode ?? null,
          bank_name: tenant.bank_name ?? null,
          bank_bsb: tenant.bank_bsb ?? null,
          bank_account: tenant.bank_account ?? null,
          invoice_footer: tenant.invoice_footer ?? null,
          invoice_accent_color: tenant.invoice_accent_color ?? null,
        }
      : null;

    // 4. Render PDF to buffer
    const element = React.createElement(InvoicePDF, {
      invoice: invoiceData,
      lineItems,
      tenant: tenantData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      element as unknown as ReactElement<
        DocumentProps,
        JSXElementConstructor<DocumentProps>
      >
    );

    const businessName =
      tenant?.business_name || tenant?.name || "Your Business";
    const customerName = customerRaw?.full_name || "Valued Customer";

    // 5. Build HTML email body
    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Tax Invoice ${invoice.invoice_number}</title></head>
<body style="margin:0;padding:0;background:#F8F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="background:#1A1A1A;border-radius:12px 12px 0 0;padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${businessName}</p>
          ${tenant?.abn ? `<p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">ABN: ${tenant.abn}</p>` : ""}
        </td>
        <td align="right">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;">TAX INVOICE</p>
          <p style="margin:3px 0 0;font-size:20px;font-weight:700;color:#8B7355;">${invoice.invoice_number}</p>
        </td>
      </tr></table>
    </td>
  </tr>
  <tr>
    <td style="background:#fff;padding:36px;">
      <p style="margin:0 0 6px;font-size:15px;color:#1A1A1A;font-weight:600;">Hi ${customerName},</p>
      <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.6;">
        Please find your invoice attached as a PDF. Here's a summary:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9;border-radius:8px;margin-bottom:28px;border:1px solid #E5E2DE;">
        <tr><td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:12px;width:50%;">
                <p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Invoice #</p>
                <p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${invoice.invoice_number}</p>
              </td>
              <td style="padding-bottom:12px;width:50%;">
                <p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Date</p>
                <p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${fmtDate(invoice.invoice_date)}</p>
              </td>
            </tr>
            <tr>
              <td style="width:50%;">
                <p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Due Date</p>
                <p style="margin:3px 0 0;font-size:14px;color:#1A1A1A;font-weight:600;">${invoice.due_date ? fmtDate(invoice.due_date) : "On Receipt"}</p>
              </td>
              <td style="width:50%;">
                <p style="margin:0;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Total</p>
                <p style="margin:3px 0 0;font-size:20px;color:#8B7355;font-weight:700;">${fmt(invoice.total ?? 0)}</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      ${
        tenantData?.bank_name || tenantData?.bank_bsb
          ? `<div style="background:#FAFAF9;border-radius:8px;padding:16px 20px;margin-bottom:24px;border:1px solid #E5E2DE;">
        <p style="margin:0 0 8px;font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Payment Details</p>
        ${tenantData?.bank_name ? `<p style="margin:0 0 3px;font-size:13px;color:#1A1A1A;">Bank: <strong>${tenantData.bank_name}</strong></p>` : ""}
        ${tenantData?.bank_bsb ? `<p style="margin:0 0 3px;font-size:13px;color:#1A1A1A;">BSB: <strong>${tenantData.bank_bsb}</strong></p>` : ""}
        ${tenantData?.bank_account ? `<p style="margin:0 0 3px;font-size:13px;color:#1A1A1A;">Account: <strong>${tenantData.bank_account}</strong></p>` : ""}
        <p style="margin:0;font-size:13px;color:#1A1A1A;">Reference: <strong>${invoice.invoice_number}</strong></p>
      </div>`
          : ""
      }

      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        The PDF invoice is attached to this email. ${invoice.footer_text || tenantData?.invoice_footer || "Thank you for your business!"}
      </p>
    </td>
  </tr>
  <tr>
    <td style="background:#F8F5F0;border-radius:0 0 12px 12px;padding:20px 36px;border-top:1px solid #E5E2DE;">
      <p style="margin:0;font-size:11px;color:#aaa;text-align:center;">
        Sent by <strong>${businessName}</strong>${tenantData?.phone ? ` | ${tenantData.phone}` : ""}${tenantData?.address_line1 ? ` | ${[tenantData.address_line1, tenantData.suburb, tenantData.state, tenantData.postcode].filter(Boolean).join(", ")}` : ""} using <a href="https://nexpura.com" style="color:#8B7355;text-decoration:none;font-weight:600;">Nexpura</a>
      </p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>`;

    // 6. Get tenant email config (custom domain or fallback to nexpura.com)
    const emailConfig = await getTenantEmailConfig({
      tenantId: userData.tenant_id,
      type: "invoices",
    });

    // 7. Send via Resend with PDF attachment
    const { error: sendError } = await resend.emails.send({
      from: emailConfig.from,
      to: customerEmail,
      replyTo: emailConfig.replyTo || (tenant?.email ? tenant.email : undefined),
      subject: `Tax Invoice ${invoice.invoice_number} from ${businessName}`,
      html: htmlBody,
      attachments: [
        {
          filename: `invoice-${invoice.invoice_number.replace(/\//g, "-")}.pdf`,
          content: Buffer.from(pdfBuffer).toString("base64"),
        },
      ],
    });

    if (sendError) {
      return { success: false, error: sendError.message };
    }

    // 8. Update invoice status to 'sent' if was draft
    if (invoice.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "unpaid", sent_at: new Date().toISOString() })
        .eq("id", invoiceId);

      revalidatePath(`/invoices/${invoiceId}`);
      revalidatePath("/invoices");
    }

    // 9. Log to customer_communications
    if ((invoice as Record<string, unknown>).customer_id) {
      await supabase.from("customer_communications").insert({
        tenant_id: userData.tenant_id,
        customer_id: (invoice as Record<string, unknown>).customer_id,
        type: "invoice",
        subject: `Tax Invoice ${invoice.invoice_number}`,
        sent_at: new Date().toISOString(),
        sent_by: user.id,
      });
    }

    return { success: true };
  } catch (err) {
    logger.error("emailInvoice error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send invoice",
    };
  }
}
