import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import BespokeCommandCenter from "./BespokeCommandCenter";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function BespokeJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rt?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const adminClient = createAdminClient();

  let tenantId: string | null = null;
  let tenantCurrencyFromCtx = "AUD";
  const isReviewMode = !!(sp.rt && REVIEW_TOKENS.includes(sp.rt));
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ud } = await adminClient.from("users").select("tenant_id, tenants(currency)").eq("id", user.id).single();
        tenantId = ud?.tenant_id ?? null;
        tenantCurrencyFromCtx = (ud?.tenants as { currency?: string } | null)?.currency || "AUD";
      }
    } catch { /* no session */ }
    if (!tenantId) redirect("/login");
  }

  // Fetch job + inventory in parallel (adminClient has no auth dependency)
  const [{ data: job }, { data: inventory }] = await Promise.all([
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

  // Attachments + events in parallel
  const [{ data: attachments }, { data: events }] = await Promise.all([
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

  const resolvedTenantId = tenantId ?? "";
  const tenantCurrency = tenantCurrencyFromCtx;
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
      tenantId={resolvedTenantId}
      currency={tenantCurrency}
      readOnly={isReviewMode}
      attachments={attachments ?? []}
      events={events ?? []}
    />
  );
}
