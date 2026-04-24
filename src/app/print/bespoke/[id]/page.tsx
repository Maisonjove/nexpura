import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default function PrintBespokePageWrapper(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <PrintBespokePage {...props} />
    </Suspense>
  );
}

async function PrintBespokePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // SECURITY: Verify user is authenticated and belongs to the same tenant
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  
  // Get user's tenant_id
  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  
  if (!userData?.tenant_id) {
    redirect("/login");
  }

  // W3-HIGH-06: pull tenant branding from the tenants row instead of
  // hardcoding "Marcus & Co." — previously every tenant's bespoke job
  // sheet rendered with Marcus's brand + address which is a trust /
  // privacy leak (printing another entity's letterhead on customer
  // paperwork).
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

  const { data: job } = await admin
    .from("bespoke_jobs")
    .select("*, customers(id, full_name, email, mobile, address_line1, suburb, state, postcode)")
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id) // SECURITY: Tenant isolation
    .single();

  if (!job) notFound();

  const customer = Array.isArray(job.customers) ? job.customers[0] ?? null : job.customers;

  let invoice = null;
  let lineItems: { description: string; quantity: number; unit_price: number }[] = [];
  let payments: { amount: number; payment_method: string; payment_date: string | null; notes: string | null }[] = [];

  if (job.invoice_id) {
    const { data: inv } = await admin.from("invoices").select("*").eq("id", job.invoice_id).single();
    if (inv) {
      invoice = inv;
      const { data: li } = await admin.from("invoice_line_items").select("*").eq("invoice_id", job.invoice_id);
      lineItems = li ?? [];
      const { data: pays } = await admin.from("payments").select("*").eq("invoice_id", job.invoice_id).order("created_at", { ascending: true });
      payments = pays ?? [];
    }
  }

  const { data: events } = await admin
    .from("job_events")
    .select("*")
    .eq("job_type", "bespoke")
    .eq("job_id", id)
    .order("created_at", { ascending: true });

  const fmt = (n: number | null | undefined) => {
    if (n == null) return "—";
    return `$${n.toFixed(2)}`;
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  };

  const humanise = (val: string | null | undefined) => {
    if (!val) return "—";
    return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const printedAt = new Date().toLocaleString("en-AU");
  const balanceDue = invoice ? Math.max(0, (invoice.total ?? 0) - (invoice.amount_paid ?? 0)) : 0;

  const css = `
    @media print { .no-print { display: none !important; } }
    body { font-family: Georgia, serif; font-size: 12pt; color: #000; margin: 0; padding: 20pt; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #ccc; padding: 4px 8px; font-size: 10pt; }
    th { background: #f5f5f5; text-align: left; }
    .section { margin-bottom: 16pt; }
    h1 { font-size: 18pt; margin: 0 0 4pt; }
    h2 { font-size: 13pt; margin: 8pt 0 4pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 16pt; }
    .meta { text-align: right; font-size: 10pt; color: #555; }
    .totals-row { font-weight: bold; background: #f9f9f9; }
    .balance-row { font-weight: bold; font-size: 11pt; }
    .footer { margin-top: 24pt; border-top: 1px solid #ccc; padding-top: 8pt; font-size: 9pt; color: #666; text-align: center; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
    .field { margin-bottom: 6pt; }
    .field label { font-weight: bold; font-size: 9pt; text-transform: uppercase; color: #666; display: block; }
    .field span { font-size: 11pt; }
    .no-border td, .no-border th { border: none; padding: 2px 4px; }
    .specs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin-top: 8pt; }
    .spec-item { background: #f9f9f9; padding: 6pt; border: 1px solid #eee; }
    .spec-item label { font-weight: bold; font-size: 8pt; text-transform: uppercase; color: #888; display: block; }
    .spec-item span { font-size: 10pt; font-weight: bold; }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <script dangerouslySetInnerHTML={{ __html: "window.onload=function(){window.print();};" }} /><script dangerouslySetInnerHTML={{ __html: "document.addEventListener(\"DOMContentLoaded\",function(){var b=document.getElementById(\"close-btn\");if(b)b.onclick=function(){window.close();};});" }} /><button id="close-btn" className="no-print" style={{position:"fixed",top:12,right:12,padding:"6px 14px",background:"#e5e7eb",border:"1px solid #ccc",borderRadius:6,cursor:"pointer",fontSize:12,zIndex:1000}}>Close</button>

      <div className="page-header">
        <div>
          <h1>{businessName}</h1>
          {headerDetails && <div style={{ fontSize: "10pt", color: "#555" }}>{headerDetails}</div>}
        </div>
        <div className="meta">
          <div><strong>Bespoke Job Sheet</strong></div>
          <div>Job: <strong>{job.job_number}</strong></div>
          <div>Printed: {printedAt}</div>
        </div>
      </div>

      <div className="two-col section">
        <div>
          <h2>Customer</h2>
          {customer ? (
            <div>
              <div className="field"><label>Name</label><span>{customer.full_name}</span></div>
              {customer.mobile && <div className="field"><label>Phone</label><span>{customer.mobile}</span></div>}
              {customer.email && <div className="field"><label>Email</label><span>{customer.email}</span></div>}
            </div>
          ) : <div style={{ color: "#888" }}>No customer linked</div>}
        </div>
        <div>
          <h2>Job Details</h2>
          <div className="field"><label>Stage</label><span style={{ textTransform: "capitalize" }}>{humanise(job.stage)}</span></div>
          <div className="field"><label>Priority</label><span style={{ textTransform: "capitalize" }}>{job.priority}</span></div>
          {job.due_date && <div className="field"><label>Due Date</label><span>{fmtDate(job.due_date)}</span></div>}
        </div>
      </div>

      <div className="section">
        <h2>Job Brief</h2>
        <div className="field"><label>Title</label><span style={{ fontWeight: "bold" }}>{job.title}</span></div>
        {job.description && <div className="field"><label>Description</label><span>{job.description}</span></div>}

        {(job.metal_type || job.stone_type || job.ring_size) && (
          <>
            <div style={{ marginTop: 8, fontWeight: "bold", fontSize: "10pt", color: "#555", textTransform: "uppercase" }}>Specifications</div>
            <div className="specs-grid">
              {job.jewellery_type && <div className="spec-item"><label>Type</label><span>{humanise(job.jewellery_type)}</span></div>}
              {job.metal_type && <div className="spec-item"><label>Metal</label><span>{humanise(job.metal_type)}</span></div>}
              {job.metal_colour && <div className="spec-item"><label>Metal Colour</label><span>{humanise(job.metal_colour)}</span></div>}
              {job.metal_purity && <div className="spec-item"><label>Purity</label><span>{job.metal_purity}</span></div>}
              {job.stone_type && <div className="spec-item"><label>Stone</label><span>{humanise(job.stone_type)}</span></div>}
              {job.stone_carat && <div className="spec-item"><label>Carat</label><span>{job.stone_carat}ct</span></div>}
              {job.stone_colour && <div className="spec-item"><label>Colour</label><span>{job.stone_colour}</span></div>}
              {job.stone_clarity && <div className="spec-item"><label>Clarity</label><span>{job.stone_clarity}</span></div>}
              {job.ring_size && <div className="spec-item"><label>Ring Size</label><span>{job.ring_size}</span></div>}
              {job.setting_style && <div className="spec-item"><label>Setting</label><span>{humanise(job.setting_style)}</span></div>}
            </div>
          </>
        )}

        {job.internal_notes && <div className="field" style={{ marginTop: 8 }}><label>Design Notes</label><span>{job.internal_notes}</span></div>}
        {job.workshop_notes && <div className="field"><label>Workshop Notes</label><span>{job.workshop_notes}</span></div>}
      </div>

      {lineItems.length > 0 && (
        <div className="section">
          <h2>Line Items</h2>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ width: 60, textAlign: "right" }}>Qty</th>
                <th style={{ width: 90, textAlign: "right" }}>Unit</th>
                <th style={{ width: 90, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, i) => (
                <tr key={i}>
                  <td>{li.description}</td>
                  <td style={{ textAlign: "right" }}>{li.quantity}</td>
                  <td style={{ textAlign: "right" }}>{fmt(li.unit_price)}</td>
                  <td style={{ textAlign: "right" }}>{fmt((li.quantity ?? 1) * (li.unit_price ?? 0))}</td>
                </tr>
              ))}
            </tbody>
            {invoice && (
              <tfoot>
                <tr><td colSpan={3} style={{ textAlign: "right", border: "none" }}>Subtotal</td><td style={{ textAlign: "right" }}>{fmt(invoice.subtotal)}</td></tr>
                <tr><td colSpan={3} style={{ textAlign: "right", border: "none" }}>GST (10%)</td><td style={{ textAlign: "right" }}>{fmt(invoice.tax_amount)}</td></tr>
                <tr className="totals-row"><td colSpan={3} style={{ textAlign: "right" }}>Total</td><td style={{ textAlign: "right" }}>{fmt(invoice.total)}</td></tr>
                <tr><td colSpan={3} style={{ textAlign: "right", border: "none" }}>Total Paid</td><td style={{ textAlign: "right" }}>{fmt(invoice.amount_paid)}</td></tr>
                <tr className="balance-row"><td colSpan={3} style={{ textAlign: "right" }}>Balance Due</td><td style={{ textAlign: "right" }}>{fmt(balanceDue)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {payments.length > 0 && (
        <div className="section">
          <h2>Payment History</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Notes</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td>{fmtDate(p.payment_date)}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.payment_method?.replace(/_/g, " ")}</td>
                  <td>{p.notes ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {events && events.length > 0 && (
        <div className="section">
          <h2>Activity Timeline</h2>
          <table className="no-border">
            <tbody>
              {events.map((ev: { id: string; created_at: string; description: string; actor?: string }) => (
                <tr key={ev.id}>
                  <td style={{ width: 140, color: "#666", fontSize: "9pt" }}>{fmtDate(ev.created_at)}</td>
                  <td>{ev.description}</td>
                  <td style={{ color: "#888", fontSize: "9pt" }}>{ev.actor ?? "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="footer">
        {["Thank you for choosing " + businessName, addressLine, contactLine].filter(Boolean).join(" · ")}
      </div>
    </>
  );
}
