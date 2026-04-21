import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/sanitize";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = _request.headers.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(ip, "pdf");
  if (!success) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) return new NextResponse("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const { data: refund } = await admin
    .from("refunds")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .single();

  if (!refund) return new NextResponse("Refund not found", { status: 404 });

  const { data: items } = await admin
    .from("refund_items")
    .select("*")
    .eq("refund_id", id);

  const { data: tenant } = await admin
    .from("tenants")
    .select("business_name, name, abn, address_line1, suburb, state, postcode, phone, email")
    .eq("id", userData.tenant_id)
    .single();

  // Simple HTML receipt. W3-HIGH-05: every customer-authored field
  // (customer_name, reason, notes, item.description, refund_method) is
  // interpolated into raw HTML — previously that gave same-tenant
  // stored-XSS: a refund with a <script> reason would execute for any
  // tenant staffer who opened the PDF. Run every dynamic field through
  // escapeHtml().
  const businessName = escapeHtml(tenant?.business_name || tenant?.name || "Business");
  const tenantAbn = tenant?.abn ? escapeHtml(tenant.abn) : null;
  const tenantPhone = tenant?.phone ? escapeHtml(tenant.phone) : null;
  const refundNumber = escapeHtml(refund.refund_number ?? "");
  const customerName = escapeHtml(refund.customer_name || "Walk-in");
  const refundMethod = escapeHtml(refund.refund_method || "—");
  const refundReason = escapeHtml(refund.reason || "—");
  const refundNotes = refund.notes ? escapeHtml(refund.notes) : null;

  const itemRows = (items ?? []).map((item: any) =>
    `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(String(item.description ?? ""))}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center">${Number(item.quantity ?? 0)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">$${Number(item.unit_price ?? 0).toFixed(2)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">$${Number(item.line_total ?? 0).toFixed(2)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center;color:${item.restock ? '#16a34a' : '#aaa'}">${item.restock ? '✓' : '—'}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Refund ${refundNumber}</title>
<style>
  body{font-family:sans-serif;margin:40px;color:#111;max-width:700px}
  h1{font-size:24px;margin-bottom:4px}
  .label{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{text-align:left;font-size:11px;color:#888;text-transform:uppercase;padding:6px 0;border-bottom:2px solid #eee}
  .total-row td{padding-top:12px;font-weight:bold;font-size:16px;color:#dc2626}
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:start">
    <div>
      <h1>CREDIT NOTE / REFUND</h1>
      <p style="color:#888;margin:0">${refundNumber}</p>
    </div>
    <div style="text-align:right">
      <strong>${businessName}</strong>
      ${tenantAbn ? `<br><span style="color:#888">ABN ${tenantAbn}</span>` : ""}
      ${tenantPhone ? `<br>${tenantPhone}` : ""}
    </div>
  </div>
  <hr style="margin:20px 0;border-color:#eee">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px">
    <div><div class="label">Date</div><div>${escapeHtml(new Date(refund.created_at).toLocaleDateString("en-AU"))}</div></div>
    <div><div class="label">Customer</div><div>${customerName}</div></div>
    <div><div class="label">Refund Method</div><div style="text-transform:capitalize">${refundMethod}</div></div>
    <div><div class="label">Reason</div><div>${refundReason}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th>
      <th style="text-align:right">Total</th><th style="text-align:center">Restocked</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr><td colspan="3" style="padding-top:12px;text-align:right;color:#888">Subtotal</td>
          <td style="padding-top:12px;text-align:right">$${Number(refund.subtotal ?? 0).toFixed(2)}</td><td></td></tr>
      <tr><td colspan="3" style="padding:4px 0;text-align:right;color:#888">Tax</td>
          <td style="text-align:right">$${Number(refund.tax_amount ?? 0).toFixed(2)}</td><td></td></tr>
      <tr class="total-row">
        <td colspan="3" style="text-align:right">Total Refunded</td>
        <td style="text-align:right;color:#dc2626">−$${Number(refund.total ?? 0).toFixed(2)}</td><td></td>
      </tr>
    </tfoot>
  </table>
  ${refundNotes ? `<div style="margin-top:24px;padding:16px;background:#f9f9f9;border-radius:8px"><div class="label">Notes</div><p>${refundNotes}</p></div>` : ""}
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="refund-${refund.refund_number}.html"`,
    },
  });
}
