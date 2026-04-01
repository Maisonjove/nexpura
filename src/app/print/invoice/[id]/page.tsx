import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // SECURITY: Verify user is authenticated and belongs to the same tenant as the invoice
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

  // Fetch invoice with tenant info - MUST match user's tenant
  const { data: invoice } = await admin
    .from("invoices")
    .select(`
      *,
      tenants(name, business_name, abn, phone, email, logo_url, address_line1, suburb, state, postcode, bank_name, bank_bsb, bank_account, invoice_footer)
    `)
    .eq("id", id)
    .eq("tenant_id", userData.tenant_id) // SECURITY: Tenant isolation
    .single();
  if (!invoice) notFound();

  const tenant = invoice.tenants as {
    name?: string;
    business_name?: string;
    abn?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    address_line1?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    bank_name?: string;
    bank_bsb?: string;
    bank_account?: string;
    invoice_footer?: string;
  } | null;

  const businessName = tenant?.business_name || tenant?.name || "Business";
  const businessAddress = [tenant?.address_line1, tenant?.suburb, tenant?.state, tenant?.postcode]
    .filter(Boolean)
    .join(", ");

  let customer = null;
  if (invoice.customer_id) {
    const { data: cust } = await admin.from("customers").select("full_name, email, mobile, phone, address_line1, suburb, state, postcode").eq("id", invoice.customer_id).single();
    customer = cust;
  }

  const { data: lineItems } = await admin.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order");

  const { data: payments } = await admin
    .from("payments")
    .select("id, amount, payment_method, payment_date")
    .eq("invoice_id", id)
    .order("payment_date", { ascending: true });

  let jobRef = null;
  if (invoice.reference_type === "repair" && invoice.reference_id) {
    const { data: repair } = await admin.from("repairs").select("repair_number, item_description").eq("id", invoice.reference_id).single();
    if (repair) jobRef = { label: "Repair", number: repair.repair_number, desc: repair.item_description };
  } else if (invoice.reference_type === "bespoke" && invoice.reference_id) {
    const { data: bespoke } = await admin.from("bespoke_jobs").select("job_number, title").eq("id", invoice.reference_id).single();
    if (bespoke) jobRef = { label: "Bespoke Job", number: bespoke.job_number, desc: bespoke.title };
  }

  const formatCurrency = (n: number | null | undefined) => {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  };

  const paymentsTotal = (payments ?? []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const amountPaid = paymentsTotal > 0 ? paymentsTotal : (invoice.amount_paid || 0);
  const balanceDue = Math.max(0, (invoice.total ?? 0) - amountPaid);

  const customerAddress = customer
    ? [customer.address_line1, customer.suburb, customer.state, customer.postcode].filter(Boolean).join(", ")
    : null;

  return (
    <html>
      <head>
        <title>Invoice {invoice.invoice_number}</title>
        <style>{`
          @media print {
            @page { margin: 15mm; size: A4; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #1a1a1a;
            margin: 0;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .logo-section { display: flex; align-items: flex-start; gap: 16px; }
          .logo { width: 64px; height: 64px; object-fit: contain; }
          .business-name { font-size: 24px; font-weight: 700; margin: 0; }
          .business-details { font-size: 12px; color: #666; margin-top: 4px; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { font-size: 32px; font-weight: 700; margin: 0; color: #92400e; }
          .invoice-number { font-size: 14px; color: #666; margin-top: 4px; }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
          }
          .status-paid { background: #dcfce7; color: #166534; }
          .status-partial { background: #fef3c7; color: #92400e; }
          .status-unpaid { background: #fee2e2; color: #991b1b; }
          .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .address-block { flex: 1; }
          .address-label { font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 8px; }
          .dates { display: flex; gap: 40px; margin-bottom: 40px; }
          .date-block label { font-size: 12px; color: #666; display: block; }
          .date-block span { font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #e5e5e5; font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; }
          td { padding: 12px 8px; border-bottom: 1px solid #f0f0f0; }
          .text-right { text-align: right; }
          .totals { margin-left: auto; width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .totals-row.subtotal { border-bottom: 1px solid #e5e5e5; }
          .totals-row.total { font-size: 18px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 12px; margin-top: 8px; }
          .totals-row.paid { color: #166534; }
          .totals-row.balance { font-size: 16px; font-weight: 700; color: #92400e; background: #fef3c7; padding: 12px; border-radius: 8px; margin-top: 8px; }
          .payments-section { margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; }
          .payments-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
          .payment-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
          .bank-details { margin-top: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; }
          .bank-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
          .bank-row { font-size: 13px; padding: 2px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
          .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #92400e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
          .close-btn { position: fixed; top: 20px; right: 20px; padding: 8px 16px; background: #e5e7eb; color: #333; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; font-size: 12px; }
        `}</style>
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('DOMContentLoaded', function() {
            document.querySelector('.print-btn')?.addEventListener('click', function() { window.print(); });
            document.querySelector('.close-btn')?.addEventListener('click', function() { window.close(); });
          });
        `}} />
        <button className="print-btn no-print">Print Invoice</button>
        <button className="close-btn no-print">Close</button>

        <div className="header">
          <div className="logo-section">
            {tenant?.logo_url && (
              <img src={tenant.logo_url} alt="" className="logo" />
            )}
            <div>
              <h2 className="business-name">{businessName}</h2>
              {tenant?.abn && <div className="business-details">ABN: {tenant.abn}</div>}
              {businessAddress && <div className="business-details">{businessAddress}</div>}
              {tenant?.phone && <div className="business-details">{tenant.phone}</div>}
              {tenant?.email && <div className="business-details">{tenant.email}</div>}
            </div>
          </div>
          <div className="invoice-title">
            <h1>INVOICE</h1>
            <div className="invoice-number">#{invoice.invoice_number}</div>
            <span className={`status-badge status-${invoice.status === "paid" ? "paid" : amountPaid > 0 ? "partial" : "unpaid"}`}>
              {invoice.status === "paid" ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID"}
            </span>
          </div>
        </div>

        <div className="addresses">
          <div className="address-block">
            <div className="address-label">Bill To</div>
            <div><strong>{customer?.full_name || "Walk-in Customer"}</strong></div>
            {customerAddress && <div>{customerAddress}</div>}
            {customer?.email && <div>{customer.email}</div>}
            {(customer?.phone || customer?.mobile) && <div>{customer.phone || customer.mobile}</div>}
          </div>
          {jobRef && (
            <div className="address-block" style={{ textAlign: "right" }}>
              <div className="address-label">Reference</div>
              <div><strong>{jobRef.label}: {jobRef.number}</strong></div>
              <div style={{ fontSize: "13px" }}>{jobRef.desc}</div>
            </div>
          )}
        </div>

        <div className="dates">
          <div className="date-block">
            <label>Invoice Date</label>
            <span>{formatDate(invoice.invoice_date)}</span>
          </div>
          {invoice.due_date && (
            <div className="date-block">
              <label>Due Date</label>
              <span>{formatDate(invoice.due_date)}</span>
            </div>
          )}
          {invoice.paid_at && (
            <div className="date-block">
              <label>Paid Date</label>
              <span>{formatDate(invoice.paid_at)}</span>
            </div>
          )}
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(lineItems ?? []).map((item: { id: string; description: string; quantity: number; unit_price: number; total?: number }) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">{formatCurrency(item.unit_price)}</td>
                <td className="text-right">{formatCurrency(item.total ?? item.unit_price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div className="totals-row subtotal">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {(invoice.discount_amount ?? 0) > 0 && (
            <div className="totals-row">
              <span>Discount</span>
              <span>-{formatCurrency(invoice.discount_amount)}</span>
            </div>
          )}
          <div className="totals-row">
            <span>{invoice.tax_name || "GST"} ({((invoice.tax_rate ?? 0.1) * 100).toFixed(0)}%)</span>
            <span>{formatCurrency(invoice.tax_amount)}</span>
          </div>
          <div className="totals-row total">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
          {amountPaid > 0 && (
            <div className="totals-row paid">
              <span>Amount Paid</span>
              <span>-{formatCurrency(amountPaid)}</span>
            </div>
          )}
          {balanceDue > 0 && (
            <div className="totals-row balance">
              <span>Balance Due</span>
              <span>{formatCurrency(balanceDue)}</span>
            </div>
          )}
          {balanceDue === 0 && invoice.status === "paid" && (
            <div className="totals-row" style={{ color: "#166534", fontWeight: 600 }}>
              <span>✓ Paid in Full</span>
              <span></span>
            </div>
          )}
        </div>

        {(payments ?? []).length > 0 && (
          <div className="payments-section">
            <div className="payments-title">Payment History</div>
            {(payments ?? []).map((p: { id: string; amount: number; payment_method?: string; payment_date?: string }) => (
              <div key={p.id} className="payment-row">
                <span>{formatDate(p.payment_date)} — {p.payment_method?.replace(/_/g, " ") || "Payment"}</span>
                <span>{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {balanceDue > 0 && (tenant?.bank_name || tenant?.bank_bsb || tenant?.bank_account) && (
          <div className="bank-details">
            <div className="bank-title">Bank Details for Payment</div>
            {tenant?.bank_name && <div className="bank-row"><strong>Bank:</strong> {tenant.bank_name}</div>}
            {tenant?.bank_bsb && <div className="bank-row"><strong>BSB:</strong> {tenant.bank_bsb}</div>}
            {tenant?.bank_account && <div className="bank-row"><strong>Account:</strong> {tenant.bank_account}</div>}
            <div className="bank-row"><strong>Reference:</strong> {invoice.invoice_number}</div>
          </div>
        )}

        {(invoice.notes || invoice.footer_text || tenant?.invoice_footer) && (
          <div className="footer">
            {invoice.notes && <p>{invoice.notes}</p>}
            {invoice.footer_text || tenant?.invoice_footer}
          </div>
        )}
      </body>
    </html>
  );
}
