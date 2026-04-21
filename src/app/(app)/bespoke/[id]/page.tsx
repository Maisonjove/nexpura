import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import BespokeCommandCenter from "./BespokeCommandCenter";
import type { OrderMessage } from "@/lib/messaging";
import { resolveReadLocationScope } from "@/lib/location-read-scope";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("bespoke_jobs")
    .select("job_number, title")
    .eq("id", id)
    .maybeSingle();
  const num = (data?.job_number as string | null) ?? null;
  const title = (data?.title as string | null) ?? null;
  if (num && title) return { title: `${num} · ${title} — Nexpura` };
  if (num) return { title: `Bespoke ${num} — Nexpura` };
  return { title: "Bespoke Job — Nexpura" };
}

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

  // Check for review mode or auth
  let tenantId: string | null = null;
  let userId: string | null = null;
  let tenantCurrency = "AUD";
  const isReviewMode = !!(sp.rt && REVIEW_TOKENS.includes(sp.rt));

  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
    userId = auth.userId;
    tenantCurrency = auth.currency;
  }

  // Phase 1: Fetch core job + cached reference data in parallel
  const [jobResult, inventory, tenantSettings] = await Promise.all([
    adminClient
      .from("bespoke_jobs")
      .select("*, customers(id, full_name, email, mobile), bespoke_milestones(*)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single(),

    // Inventory for upsell - cache for 2 minutes
    getCached(
      tenantCacheKey(tenantId, "bespoke-inventory"),
      async () => {
        const { data } = await adminClient
          .from("inventory")
          .select("id, name, sku, retail_price")
          .eq("status", "active")
          .eq("tenant_id", tenantId)
          .order("name", { ascending: true })
          .limit(100);
        return data ?? [];
      },
      120
    ),

    // Tenant settings - cache for 5 minutes
    getCached(
      tenantCacheKey(tenantId!, "tenant-settings"),
      async () => {
        const [tenant, twilio, website] = await Promise.all([
          adminClient
            .from("tenants")
            .select("name, business_name, sms_templates")
            .eq("id", tenantId)
            .single(),
          adminClient
            .from("tenant_integrations")
            .select("enabled")
            .eq("tenant_id", tenantId)
            .eq("integration_type", "twilio")
            .maybeSingle(),
          adminClient
            .from("website_config")
            .select("subdomain")
            .eq("tenant_id", tenantId)
            .maybeSingle(),
        ]);
        return {
          businessName: tenant.data?.business_name || tenant.data?.name || "",
          smsTemplates: (tenant.data?.sms_templates as { job_ready?: string } | null) || {},
          twilioConnected: !!twilio?.data?.enabled,
          storeSubdomain: (website?.data?.subdomain as string) ?? null,
        };
      },
      300
    ),
  ]);

  const { data: job } = jobResult;
  if (!job) notFound();

  // Location-scope read guard — see src/lib/location-read-scope.ts.
  if (!isReviewMode && userId && job.location_id) {
    const scope = await resolveReadLocationScope(userId, tenantId);
    if (!scope.all && !scope.allowedIds.includes(job.location_id)) notFound();
  }

  // Phase 2: Fetch job-specific data in parallel
  const [attachmentsResult, eventsResult, invoiceData, messagesResult] = await Promise.all([
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
    // Invoice + line items + payments if exists
    job.invoice_id ? (async () => {
      const [invResult, lineItemsResult, paymentsResult] = await Promise.all([
        adminClient
          .from("invoices")
          .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
          .eq("id", job.invoice_id)
          .single(),
        adminClient
          .from("invoice_line_items")
          .select("*")
          .eq("invoice_id", job.invoice_id),
        adminClient
          .from("payments")
          .select("*")
          .eq("invoice_id", job.invoice_id)
          .order("created_at", { ascending: true }),
      ]);
      if (invResult.data) {
        return {
          ...invResult.data,
          lineItems: lineItemsResult.data ?? [],
          payments: paymentsResult.data ?? [],
        };
      }
      return null;
    })() : Promise.resolve(null),
    // Customer ↔ staff thread for this bespoke job.
    adminClient
      .from("order_messages")
      .select("*")
      .eq("order_type", "bespoke")
      .eq("order_id", id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  const customer = Array.isArray(job.customers) ? job.customers[0] ?? null : job.customers;
  const depositPaid = job.deposit_received ?? false;

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
        deposit_received: depositPaid,
        due_date: job.due_date ?? null,
        invoice_id: job.invoice_id ?? null,
        internal_notes: job.internal_notes ?? null,
        workshop_notes: job.workshop_notes ?? null,
        approval_status: job.approval_status ?? null,
        approval_token: job.approval_token ?? null,
        approval_requested_at: job.approval_requested_at ?? null,
        approved_at: job.approved_at ?? null,
        approval_notes: job.approval_notes ?? null,
        milestones: Array.isArray(job.bespoke_milestones) ? job.bespoke_milestones : [],
      }}
      customer={customer}
      invoice={invoiceData}
      inventory={inventory}
      tenantId={tenantId}
      currency={tenantCurrency}
      readOnly={isReviewMode}
      attachments={attachmentsResult.data ?? []}
      events={eventsResult.data ?? []}
      messages={(messagesResult.data ?? []) as OrderMessage[]}
    />
  );
}
