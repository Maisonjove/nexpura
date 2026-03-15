import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import BespokeCommandCenter from "./BespokeCommandCenter";

export default async function BespokeJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Auth + user data in parallel with job fetch
  const [{ data: { user } }, { data: job }, { data: inventory }] = await Promise.all([
    supabase.auth.getUser(),
    adminClient
      .from("bespoke_jobs")
      .select("*, customers(id, full_name, email, mobile)")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    adminClient
      .from("inventory")
      .select("id, name, sku, retail_price")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(100),
  ]);

  if (!job) notFound();

  // User tenant lookup (needs user.id) — run in parallel with attachments + events
  const [{ data: userData }, { data: attachments }, { data: events }] = await Promise.all([
    user
      ? adminClient.from("users").select("tenant_id, tenants(currency)").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    adminClient
      .from("job_attachments")
      .select("*")
      .eq("job_type", "bespoke")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("job_events")
      .select("*")
      .eq("job_type", "bespoke")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const tenantId = userData?.tenant_id ?? "";
  const tenantCurrency = (userData?.tenants as { currency?: string } | null)?.currency || "AUD";
  const customer = Array.isArray(job.customers) ? job.customers[0] ?? null : job.customers;
  const invoiceId = job.invoice_id ?? null;

  // Invoice + line items + payments in parallel (only if invoice exists)
  let invoice = null;
  if (invoiceId) {
    const [{ data: inv }, { data: lineItems }, { data: payments }] = await Promise.all([
      adminClient
        .from("invoices")
        .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
        .eq("id", invoiceId)
        .single(),
      adminClient
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId),
      adminClient
        .from("payments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true }),
    ]);

    if (inv) {
      invoice = {
        ...inv,
        lineItems: lineItems ?? [],
        payments: payments ?? [],
      };
    }
  }

  const depositPaid = job.deposit_received ?? job.deposit_paid ?? false;

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
      inventory={inventory ?? []}
      tenantId={tenantId}
      currency={tenantCurrency}
      attachments={attachments ?? []}
      events={events ?? []}
    />
  );
}
