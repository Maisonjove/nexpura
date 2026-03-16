import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import CustomerDetailClient from "./CustomerDetailClient";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const REVIEW_TOKENS = ["nexpura-review-2026", "nexpura-staff-2026"];

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rt?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const admin = createAdminClient();
  const isReviewMode = !!(sp.rt && REVIEW_TOKENS.includes(sp.rt));

  let tenantId: string | null = null;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ud } = await admin.from("users").select("tenant_id").eq("id", user.id).single();
        tenantId = ud?.tenant_id ?? null;
      }
    } catch { /* no session */ }
    if (!tenantId) redirect("/login");
  }

  // Main customer record — scoped to tenant
  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!customer) notFound();

  // Fetch all related data in parallel — all scoped to tenant
  const [
    { data: creditHistory },
    { data: repairs },
    { data: bespokeJobs },
    { data: quotes },
    { data: invoices },
    { data: passports },
    { data: sales },
  ] = await Promise.all([
    admin
      .from("customer_store_credit_history")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("repairs")
      .select("id, repair_number, item_description, stage, due_date, quoted_price, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("bespoke_jobs")
      .select("id, job_number, title, stage, due_date, quoted_price, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("quotes")
      .select("id, quote_number, status, total_amount, expires_at, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, due_date, paid_at, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("passports")
      .select("id, passport_uid, title, jewellery_type, status, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("sales")
      .select("id, sale_number, status, payment_method, total, amount_paid, sale_date, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  let communications: any[] = [];
  try {
    const { data: commsData } = await admin
      .from("customer_communications")
      .select("id, type, subject, sent_at, sent_by, reference_type, reference_id")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .order("sent_at", { ascending: false })
      .limit(50);
    communications = commsData ?? [];
  } catch { }

  const lifetimeSpend = (invoices ?? [])
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const lastVisitDates = (invoices ?? [])
    .map((inv) => inv.paid_at || inv.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());
  const lastVisit = lastVisitDates[0] ?? null;

  return (
    <CustomerDetailClient
      customer={customer}
      creditHistory={creditHistory || []}
      repairs={repairs || []}
      bespokeJobs={bespokeJobs || []}
      quotes={quotes || []}
      invoices={invoices || []}
      passports={passports || []}
      sales={sales || []}
      communications={communications}
      lifetimeSpend={lifetimeSpend}
      lastVisit={lastVisit}
      readOnly={isReviewMode}
    />
  );
}
