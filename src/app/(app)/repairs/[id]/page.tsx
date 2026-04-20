import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import RepairCommandCenter from "./RepairCommandCenter";
import type { OrderMessage } from "@/lib/messaging";

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
    .from("repairs")
    .select("repair_number")
    .eq("id", id)
    .maybeSingle();
  const num = (data?.repair_number as string | null) ?? null;
  return { title: num ? `Repair ${num} — Nexpura` : "Repair — Nexpura" };
}

export default async function RepairDetailPage({
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
  let tenantCurrency = "AUD";
  const isReviewMode = !!(sp.rt && REVIEW_TOKENS.includes(sp.rt));

  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
    tenantCurrency = auth.currency;
  }

  // Phase 1: Fetch core repair + cached reference data in parallel
  const [repairResult, inventory, tenantSettings] = await Promise.all([
    adminClient
      .from("repairs")
      .select("*, customers(id, full_name, email, mobile)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single(),
    
    // Inventory for upsell - cache for 2 minutes
    getCached(
      tenantCacheKey(tenantId, "repair-inventory"),
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
      tenantCacheKey(tenantId, "tenant-settings"),
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

  const { data: repair } = repairResult;
  if (!repair) notFound();

  // Phase 2: Fetch repair-specific data in parallel
  const [attachmentsResult, eventsResult, invoiceData, messagesResult] = await Promise.all([
    adminClient
      .from("job_attachments")
      .select("*")
      .eq("job_type", "repair")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("job_events")
      .select("*")
      .eq("job_type", "repair")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
    // Invoice + line items + payments if exists
    repair.invoice_id ? (async () => {
      const [invResult, lineItemsResult, paymentsResult] = await Promise.all([
        adminClient
          .from("invoices")
          .select("id, invoice_number, status, subtotal, tax_amount, tax_rate, total, amount_paid")
          .eq("id", repair.invoice_id)
          .single(),
        adminClient
          .from("invoice_line_items")
          .select("*")
          .eq("invoice_id", repair.invoice_id),
        adminClient
          .from("payments")
          .select("*")
          .eq("invoice_id", repair.invoice_id)
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
    // Customer ↔ staff thread for this repair, scoped by tenant_id to
    // prevent cross-tenant leakage even if an attacker supplies a UUID
    // from another tenant.
    adminClient
      .from("order_messages")
      .select("*")
      .eq("order_type", "repair")
      .eq("order_id", id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  const customer = Array.isArray(repair.customers) ? repair.customers[0] ?? null : repair.customers;
  const defaultSmsTemplate = tenantSettings.smsTemplates.job_ready || 
    "Hi {{customer_name}}, great news! Your {{job_type}} is ready for pickup at {{business_name}}. See you soon!";

  return (
    <RepairCommandCenter
      repair={{
        id: repair.id,
        repair_number: repair.repair_number,
        item_type: repair.item_type,
        item_description: repair.item_description,
        repair_type: repair.repair_type,
        work_description: repair.work_description ?? null,
        intake_notes: repair.intake_notes ?? null,
        internal_notes: repair.internal_notes ?? null,
        workshop_notes: repair.workshop_notes ?? null,
        stage: repair.stage,
        priority: repair.priority ?? "normal",
        quoted_price: repair.quoted_price ?? null,
        final_price: repair.final_price ?? null,
        deposit_amount: repair.deposit_amount ?? null,
        deposit_paid: repair.deposit_paid ?? false,
        due_date: repair.due_date ?? null,
        invoice_id: repair.invoice_id ?? null,
        tracking_id: repair.tracking_id ?? null,
        created_at: (repair.created_at as string | null) ?? undefined,
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
      twilioConnected={tenantSettings.twilioConnected}
      businessName={tenantSettings.businessName}
      defaultSmsTemplate={defaultSmsTemplate}
      storeSubdomain={tenantSettings.storeSubdomain}
    />
  );
}
