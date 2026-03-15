import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { PrintAutoScript, CloseButton } from "@/app/print/PrintAutoScript";

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: invoice } = await admin.from("invoices").select("*").eq("id", id).single();
  if (!invoice) notFound();

  let customer = null;
  if (invoice.customer_id) {
    const { data: cust } = await admin.from("customers").select("full_name, email, mobile, address_line1, suburb, state, postcode").eq("id", invoice.customer_id).single();
    customer = cust;
  }

  const { data: lineItems } = await admin.from("invoice_line_items").select("*").eq("invoice_id", id);

  let jobRef = null;
  if (invoice.reference_type === "repair" && invoice.reference_id) {
    const { data: repair } = await admin.from("repairs").select("repair_number, item_description").eq("id", invoice.reference_id).single();
    if (repair) jobRef = { label: "Repair", number: repair.repair_number, desc: repair.item_description };
  } else if (invoice.reference_type === "bespoke" && invoice.reference_id) {
    const { data: bespoke } = await admin.from("bespoke_jobs").select("job_number, title").eq("id", invoice.reference_id).single();
    if (bespoke) jobRef = { label: "Bespoke Job", number: bespoke.job_number, desc: bespoke.title };
  }

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    return `$${n.toFixed(2)}`;
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  };

  const balanceDue = Math.max(0, (invoice.total ?? 0) - (invoice.amount_paid ?? 0));
  const statusColor = invoice.status === "paid" ? "#1c1917" : invoice.status === "partial" ? "#fef3c7" : "#f5f5f4";
  const statusText = invoice.status === "paid" ? "#fff" : invoice.status === "partial" ? "#92400e" : "#666";

  const css = `
    @media print { .no-print { display: none !important; } }
    body { font-family: Georgia, serif; font-size: 12pt; color: #000; margin: 0; padding: 24pt; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 10pt; }
    th { background: #f5f5f5; text-align: left; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20pt; border-bottom: 2px solid #000; padding-bottom: 12pt; }
    h1 { font-size: 18pt; margin: 0 0 4pt; }
    .invoice-title { font-size: 24pt; font-weight: bold; text-align: right; }
    .invoice-meta { text-align: right; font-size: 10pt; color: #555; margin-top: 8pt; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 20pt; }
    .address-block { flex: 1; }
    .address-block h3 { font-size: 9pt; text-transform: uppercase; color: #888; margin: 0 0 4pt; }
    .total-section { margin-top: 12pt; width: 300pt; margin-left: auto; }
    .total-section table td, .total-section table th { border: none; padding: 3px 8px; }
    .grand-total td { font-weight: bold; font-size: 13pt; border-top: 2px solid #000 !important; }
    .balance-row td { font-weight: bold; color: ${balanceDue > 0 ? "#b45309" : "#333"}; }
    .footer { margin-top: 32pt; border-top: 1px solid #ccc; padding-top: 8pt; font-size: 9pt; color: #666; text-align: center; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 9pt; font-weight: bold; text-transform: uppercase; background: ${statusColor}; color: ${statusText}; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <PrintAutoScript />
      <CloseButton />

      <div className="page-header">
        <div>
          <h1>Marcus &amp; Co. Fine Jewellery</h1>
          <div style={{ fontSize: "10pt", color: "#555" }}>32 Castlereagh St, Sydney NSW 2000</div>
          <div style={{ fontSize: "10pt", color: "#555" }}>hello@marcusandco.com.au · ABN 00 000 000 000</div>
        </div>
        <div>
          <div className="invoice-title">INVOICE</div>
          <div className="invoice-meta">
            <div><strong>{invoice.invoice_number}</strong></div>
            <div>Date: {fmtDate(invoice.invoice_date)}</div>
            {invoice.due_date && <div>Due: {fmtDate(invoice.due_date)}</div>}
            <div style={{ marginTop: 4 }}><span className="status-badge">{invoice.status}</span></div>
          </div>
        </div>
      </div>

      <div className="addresses">
        <div className="address-block">
          <h3>Bill To</h3>
          {customer ? (
            <div>
              <div style={{ fontWeight: "bold" }}>{customer.full_name}</div>
              {customer.email && <div style={{ fontSize: "10pt" }}>{customer.email}</div>}
              {customer.mobile && <div style={{ fontSize: "10pt" }}>{customer.mobile}</div>}
              {customer.address_line1 && <div style={{ fontSize: "10pt" }}>{customer.address_line1}, {customer.suburb} {customer.state} {customer.postcode}</div>}
            </div>
          ) : <div style={{ color: "#888", fontSize: "10pt" }}>No customer</div>}
        </div>
        {jobRef && (
          <div className="address-block" style={{ textAlign: "right" }}>
            <h3>Reference</h3>
            <div style={{ fontWeight: "bold" }}>{jobRef.label}: {jobRef.number}</div>
            <div style={{ fontSize: "10pt" }}>{jobRef.desc}</div>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ width: 60, textAlign: "right" }}>Qty</th>
            <th style={{ width: 100, textAlign: "right" }}>Unit Price</th>
            <th style={{ width: 100, textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(lineItems ?? []).map((li: { id: string; description: string; quantity: number; unit_price: number }, i) => (
            <tr key={i}>
              <td>{li.description}</td>
              <td style={{ textAlign: "right" }}>{li.quantity}</td>
              <td style={{ textAlign: "right" }}>{fmt(li.unit_price)}</td>
              <td style={{ textAlign: "right" }}>{fmt((li.quantity ?? 1) * (li.unit_price ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total-section">
        <table>
          <tbody>
            <tr><td>Subtotal</td><td style={{ textAlign: "right" }}>{fmt(invoice.subtotal)}</td></tr>
            <tr><td>GST (10%)</td><td style={{ textAlign: "right" }}>{fmt(invoice.tax_amount)}</td></tr>
            {(invoice.discount_amount ?? 0) > 0 && (
              <tr><td>Discount</td><td style={{ textAlign: "right" }}>-{fmt(invoice.discount_amount)}</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="grand-total"><td>Total</td><td style={{ textAlign: "right" }}>{fmt(invoice.total)}</td></tr>
            <tr><td style={{ color: "#666" }}>Amount Paid</td><td style={{ textAlign: "right", color: "#666" }}>{fmt(invoice.amount_paid)}</td></tr>
            <tr className="balance-row"><td>Balance Due</td><td style={{ textAlign: "right" }}>{fmt(balanceDue)}</td></tr>
          </tfoot>
        </table>
      </div>

      {invoice.notes && (
        <div style={{ marginTop: 16, padding: 8, background: "#f9f9f9", border: "1px solid #eee", fontSize: "10pt" }}>
          <strong>Notes:</strong> {invoice.notes}
        </div>
      )}

      <div className="footer">
        Payment is due by {fmtDate(invoice.due_date)}. Thank you for your business.<br />
        Marcus &amp; Co. Fine Jewellery · 32 Castlereagh St, Sydney NSW 2000 · hello@marcusandco.com.au
      </div>
    </>
  );
}
