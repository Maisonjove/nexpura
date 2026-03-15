import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

export default async function PrintReceiptPage({
  params,
}: {
  params: Promise<{ jobType: string; jobId: string }>;
}) {
  const { jobType, jobId } = await params;
  const admin = createAdminClient();

  // Fetch job + invoice + payments + customer
  let customer: Record<string, unknown> | null = null;
  let jobNumber = "";
  let jobTitle = "";
  let itemDesc = "";

  if (jobType === "repair") {
    const { data } = await admin.from("repairs")
      .select("*, customers(id, full_name, email, mobile)")
      .eq("id", jobId).single();
    if (!data) notFound();
    customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    jobNumber = data.repair_number;
    jobTitle = `${data.repair_type}`;
    itemDesc = data.item_description;
  } else if (jobType === "bespoke") {
    const { data } = await admin.from("bespoke_jobs")
      .select("*, customers(id, full_name, email, mobile)")
      .eq("id", jobId).single();
    if (!data) notFound();
    customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    jobNumber = data.job_number;
    jobTitle = data.title;
    itemDesc = data.description ?? "";
  } else {
    notFound();
  }

  // Get invoice
  let invoice: Record<string, unknown> | null = null;
  let payments: Array<Record<string, unknown>> = [];

  const { data: inv } = await admin.from("invoices")
    .select("*")
    .eq("reference_type", jobType)
    .eq("reference_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inv) {
    invoice = inv;
    const { data: pays } = await admin.from("payments")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("payment_date", { ascending: true });
    payments = pays ?? [];
  }

  const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toFixed(2)}` : "—";
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  };

  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) ?? 0), 0);
  const balanceDue = invoice ? Math.max(0, Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0)) : 0;
  const receiptNumber = `RCP-${jobNumber}-${payments.length}`;
  const printedAt = new Date().toLocaleString("en-AU");

  const css = `
    @media print { .no-print { display: none !important; } }
    * { box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 12pt; color: #000; margin: 0; padding: 30pt; background: #fff; max-width: 400pt; }
    h1 { font-size: 16pt; margin: 0 0 2pt; }
    h2 { font-size: 11pt; margin: 12pt 0 4pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10pt; margin-bottom: 14pt; }
    .field { display: flex; justify-content: space-between; padding: 3pt 0; font-size: 10pt; }
    .field-label { color: #666; }
    .total-row { font-weight: bold; font-size: 12pt; border-top: 1px solid #000; padding-top: 4pt; margin-top: 4pt; }
    .balance-row { font-weight: bold; font-size: 13pt; }
    .balance-due { color: #8B5000; }
    .paid-full { color: #166534; }
    .payment-row { display: flex; justify-content: space-between; font-size: 10pt; padding: 2pt 0; border-bottom: 1px solid #f0f0f0; }
    .footer { margin-top: 24pt; text-align: center; font-size: 9pt; color: #666; border-top: 1px solid #ccc; padding-top: 8pt; }
    .receipt-badge { display: inline-block; border: 1px solid #ccc; padding: 2pt 8pt; font-size: 9pt; margin-top: 4pt; }
  `;

  return (
    <html>
      <head>
        <title>Receipt — {jobNumber}</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: "window.onload=function(){window.print();}; document.addEventListener('DOMContentLoaded',function(){var b=document.getElementById('close-btn');if(b)b.onclick=function(){window.close();};});" }} />
        <button id="close-btn" className="no-print" style={{position:"fixed",top:12,right:12,padding:"6px 14px",background:"#e5e7eb",border:"1px solid #ccc",borderRadius:6,cursor:"pointer",fontSize:12}}>Close</button>

        <div className="header">
          <h1>Marcus &amp; Co. Fine Jewellery</h1>
          <div style={{fontSize:"9pt",color:"#666"}}>32 Castlereagh St, Sydney NSW 2000 · hello@marcusandco.com.au</div>
          <div style={{marginTop:8,fontSize:"14pt",fontWeight:"bold",letterSpacing:"0.05em"}}>PAYMENT RECEIPT</div>
          <div className="receipt-badge">{receiptNumber}</div>
          <div style={{fontSize:"9pt",color:"#888",marginTop:4}}>Printed: {printedAt}</div>
        </div>

        <h2>Customer</h2>
        {customer ? (
          <div>
            <div className="field"><span className="field-label">Name</span><span>{String((customer as Record<string, unknown>).full_name ?? "")}</span></div>
            {!!(customer as Record<string, unknown>).mobile && <div className="field"><span className="field-label">Phone</span><span>{String((customer as Record<string, unknown>).mobile)}</span></div>}
            {!!(customer as Record<string, unknown>).email && <div className="field"><span className="field-label">Email</span><span>{String((customer as Record<string, unknown>).email)}</span></div>}
          </div>
        ) : <div style={{color:"#888",fontSize:"10pt"}}>No customer on file</div>}

        <h2>Job Reference</h2>
        <div className="field"><span className="field-label">Job Number</span><span style={{fontWeight:"bold"}}>{jobNumber}</span></div>
        <div className="field"><span className="field-label">Description</span><span>{itemDesc}</span></div>
        {jobType === "repair" && <div className="field"><span className="field-label">Service</span><span>{jobTitle}</span></div>}
        {jobType === "bespoke" && <div className="field"><span className="field-label">Project</span><span>{jobTitle}</span></div>}
        {invoice && <div className="field"><span className="field-label">Invoice</span><span>{String((invoice as {invoice_number?: unknown}).invoice_number)}</span></div>}

        {payments.length > 0 && (
          <>
            <h2>Payments Received</h2>
            {payments.map((p, i) => {
              const pMethod = String(p.payment_method ?? "");
              const pDate = p.payment_date ? String(p.payment_date) : null;
              const pNotes = p.notes ? String(p.notes) : null;
              const pAmount = Number(p.amount ?? 0);
              return (
                <div key={i} className="payment-row">
                  <div>
                    <span style={{textTransform:"capitalize"}}>{pMethod.replace(/_/g," ")}</span>
                    <span style={{color:"#888",marginLeft:8,fontSize:"9pt"}}>{fmtDate(pDate)}</span>
                    {pNotes && <span style={{color:"#888",marginLeft:8,fontSize:"9pt"}}>· {pNotes}</span>}
                  </div>
                  <span style={{fontWeight:"bold"}}>{fmt(pAmount)}</span>
                </div>
              );
            })}
          </>
        )}

        <div style={{marginTop:12}}>
          {invoice && (
            <div className="field total-row"><span>Invoice Total</span><span>{fmt(Number(invoice.total))}</span></div>
          )}
          <div className="field" style={{fontWeight:"bold",fontSize:"11pt"}}>
            <span>Total Paid</span><span>{fmt(totalPaid)}</span>
          </div>
          <div className={`field balance-row ${balanceDue > 0 ? "balance-due" : "paid-full"}`}>
            <span>{balanceDue > 0 ? "Balance Remaining" : "✓ Paid in Full"}</span>
            <span>{balanceDue > 0 ? fmt(balanceDue) : fmt(0)}</span>
          </div>
        </div>

        <div className="footer">
          Thank you for choosing Marcus &amp; Co. Fine Jewellery<br />
          ABN: 12 345 678 901 · hello@marcusandco.com.au
        </div>
      </body>
    </html>
  );
}
