import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import CustomerDetailClient from "./CustomerDetailClient";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id ?? "";

  // Main customer record — scoped to tenant
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!customer) notFound();

  const admin = createAdminClient();

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
    supabase
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

  // Fetch communication history (graceful fallback if table doesn't exist yet)
  let communications: Array<{ id: string; type: string; subject: string | null; sent_at: string; sent_by: string | null; reference_type: string | null; reference_id: string | null }> = [];
  try {
    const { data: commsData } = await admin
      .from("customer_communications")
      .select("id, type, subject, sent_at, sent_by, reference_type, reference_id")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .order("sent_at", { ascending: false })
      .limit(50);
    communications = commsData ?? [];
  } catch {
    // table may not exist yet — silently ignore
  }

  // Lifetime spend = sum of paid invoices
  const lifetimeSpend = (invoices ?? [])
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Last visit = most recent paid_at or invoice created_at
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
    />
  );
}
