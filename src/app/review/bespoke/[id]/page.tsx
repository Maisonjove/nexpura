import { createAdminClient } from "@/lib/supabase/admin";
import BespokeCommandCenter from "@/app/(app)/bespoke/[id]/BespokeCommandCenter";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export default async function ReviewBespokeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adminClient = createAdminClient();

  const { data: job } = await adminClient
    .from("bespoke_jobs")
    .select("*, customers(id, full_name, email, mobile)")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!job) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Job Not Found</h1>
        <p className="text-stone-500">This bespoke job doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  const customer = Array.isArray(job.customers) ? job.customers[0] ?? null : job.customers;

  let invoice = null;
  const invoiceId = job.invoice_id ?? null;

  if (invoiceId) {
    const { data: inv } = await adminClient
      .from("invoices")
      .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
      .eq("id", invoiceId)
      .eq("tenant_id", TENANT_ID)
      .single();

    if (inv) {
      const { data: lineItems } = await adminClient
        .from("invoice_line_items")
        .select("id, description, quantity, unit_price, total")
        .eq("invoice_id", invoiceId)
        .order("id", { ascending: true });

      const { data: payments } = await adminClient
        .from("payments")
        .select("id, amount, payment_method, payment_date, notes")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      invoice = {
        ...inv,
        lineItems: lineItems ?? [],
        payments: payments ?? [],
      };
    }
  }

  const depositPaid = job.deposit_received ?? job.deposit_paid ?? false;

  // Fetch attachments
  const { data: attachments } = await adminClient
    .from("job_attachments")
    .select("id, file_name, file_url, caption, created_at")
    .eq("job_type", "bespoke")
    .eq("job_id", id)
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: true });

  return (
    <BespokeCommandCenter
      job={{
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        description: job.description ?? null,
        jewellery_type: job.jewellery_type ?? null,
        metal_type: job.metal_type ?? null,
        metal_colour: job.metal_colour ?? null,
        metal_purity: job.metal_purity ?? null,
        stone_type: job.stone_type ?? null,
        stone_carat: job.stone_carat ?? null,
        stone_colour: job.stone_colour ?? null,
        stone_clarity: job.stone_clarity ?? null,
        ring_size: job.ring_size ?? null,
        setting_style: job.setting_style ?? null,
        stage: job.stage,
        priority: job.priority ?? "normal",
        quoted_price: job.quoted_price ?? null,
        deposit_amount: job.deposit_amount ?? null,
        deposit_paid: depositPaid,
        due_date: job.due_date ?? null,
        invoice_id: job.invoice_id ?? null,
        internal_notes: job.internal_notes ?? null,
        workshop_notes: job.workshop_notes ?? null,
      }}
      customer={customer}
      invoice={invoice}
      inventory={[]}
      tenantId={TENANT_ID}
      currency="AUD"
      readOnly={true}
      attachments={attachments ?? []}
    />
  );
}
