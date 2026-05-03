import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default function PrintSaleReceiptWrapper(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <PrintSaleReceipt {...props} />
    </Suspense>
  );
}

async function PrintSaleReceipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) redirect("/login");

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("business_name, name, abn, address_line1, suburb, state, postcode, email, phone")
    .eq("id", userData.tenant_id)
    .single();
  const businessName = tenantRow?.business_name || tenantRow?.name || "Your Business";
  const tenantEmail = tenantRow?.email || null;
  const tenantPhone = tenantRow?.phone || null;
  const addressLine = [tenantRow?.address_line1, tenantRow?.suburb, tenantRow?.state, tenantRow?.postcode]
    .filter(Boolean)
    .join(", ");
  const contactLine = [tenantPhone, tenantEmail].filter(Boolean).join(" · ");
  const headerDetails = [addressLine, contactLine].filter(Boolean).join(" · ");

  // Joey 2026-05-03 P2-D audit: filter soft-deleted sales (sales.deleted_at).
  const { data: sale } = await admin
    .from("sales")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id)
    .is("deleted_at", null)
    .single();
  if (!sale) notFound();

  const { data: itemsRaw } = await admin
    .from("sale_items")
    .select("description, quantity, unit_price, line_total, discount_pct")
    .eq("sale_id", id);
  const items = itemsRaw ?? [];

  const fmt = (n: number | null | undefined) => `$${(n ?? 0).toFixed(2)}`;
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "—";

  const printedAt = new Date().toLocaleString("en-AU");

  const css = `
    @media print { .no-print { display: none !important; } }
    body { font-family: Georgia, serif; font-size: 12pt; color: #000; margin: 0; padding: 20pt; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #ccc; padding: 4px 8px; font-size: 10pt; }
    th { background: #f5f5f5; text-align: left; }
    .section { margin-bottom: 16pt; }
    h1 { font-size: 18pt; margin: 0 0 4pt; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 16pt; }
    .meta { text-align: right; font-size: 10pt; color: #555; }
    .totals-row { font-weight: bold; background: #f9f9f9; }
    .footer { margin-top: 24pt; border-top: 1px solid #ccc; padding-top: 8pt; font-size: 9pt; color: #666; text-align: center; }
    .field { margin-bottom: 6pt; }
    .field label { font-weight: bold; font-size: 9pt; text-transform: uppercase; color: #666; display: block; }
    .field span { font-size: 11pt; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <script dangerouslySetInnerHTML={{ __html: "window.onload=function(){window.print();};" }} />

      <div className="page-header">
        <div>
          <h1>{businessName}</h1>
          {headerDetails && <div style={{ fontSize: "10pt", color: "#555" }}>{headerDetails}</div>}
          {tenantRow?.abn && <div style={{ fontSize: "10pt", color: "#555" }}>ABN: {tenantRow.abn}</div>}
        </div>
        <div className="meta">
          <div><strong>Sale Receipt</strong></div>
          <div>Sale: <strong>{sale.sale_number}</strong></div>
          <div>Date: {fmtDate(sale.sale_date || sale.created_at)}</div>
          <div>Printed: {printedAt}</div>
        </div>
      </div>

      <div className="section">
        <div className="field"><label>Customer</label><span>{sale.customer_name || "Walk-in"}</span></div>
        {sale.customer_email && (
          <div className="field"><label>Email</label><span>{sale.customer_email}</span></div>
        )}
      </div>

      <div className="section">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style={{ width: "60pt", textAlign: "right" }}>Qty</th>
              <th style={{ width: "80pt", textAlign: "right" }}>Unit</th>
              <th style={{ width: "60pt", textAlign: "right" }}>Disc%</th>
              <th style={{ width: "80pt", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.description}</td>
                <td style={{ textAlign: "right" }}>{it.quantity}</td>
                <td style={{ textAlign: "right" }}>{fmt(it.unit_price)}</td>
                <td style={{ textAlign: "right" }}>{it.discount_pct ?? 0}%</td>
                <td style={{ textAlign: "right" }}>{fmt(it.line_total)}</td>
              </tr>
            ))}
            <tr className="totals-row">
              <td colSpan={4} style={{ textAlign: "right" }}>Subtotal</td>
              <td style={{ textAlign: "right" }}>{fmt(sale.subtotal)}</td>
            </tr>
            {sale.discount_amount > 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }}>Discount</td>
                <td style={{ textAlign: "right" }}>-{fmt(sale.discount_amount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={4} style={{ textAlign: "right" }}>Tax</td>
              <td style={{ textAlign: "right" }}>{fmt(sale.tax_amount)}</td>
            </tr>
            <tr className="totals-row">
              <td colSpan={4} style={{ textAlign: "right" }}><strong>Total</strong></td>
              <td style={{ textAlign: "right" }}><strong>{fmt(sale.total)}</strong></td>
            </tr>
            {sale.amount_paid != null && sale.amount_paid > 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "right" }}>Paid ({sale.payment_method ?? "—"})</td>
                <td style={{ textAlign: "right" }}>{fmt(sale.amount_paid)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sale.notes && (
        <div className="section">
          <div className="field"><label>Notes</label><span>{sale.notes}</span></div>
        </div>
      )}

      <div className="footer">Thank you for your purchase. Please retain this receipt for your records.</div>
    </>
  );
}
