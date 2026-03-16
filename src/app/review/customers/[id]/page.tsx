import { createAdminClient } from "@/lib/supabase/admin";
import CustomerDetailClient from "@/app/(app)/customers/[id]/CustomerDetailClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEFAULT_ID = "fdc45e28-9c50-4c0c-8d5b-796a39ec0f0a";

export default async function ReviewCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = rawId || DEFAULT_ID;
  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .single();

  if (!customer) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Customer Not Found</h1>
        <p className="text-stone-500">This customer doesn&apos;t exist in the demo data.</p>
      </div>
    );
  }

  const [
    { data: repairs },
    { data: bespokeJobs },
    { data: invoices },
    { data: passports },
    { data: sales },
    { data: creditHistory },
  ] = await Promise.all([
    admin
      .from("repairs")
      .select("id, repair_number, item_description, stage, due_date, quoted_price, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("bespoke_jobs")
      .select("id, job_number, title, stage, due_date, quoted_price, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, due_date, paid_at, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("passports")
      .select("id, passport_uid, title, jewellery_type, status, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("sales")
      .select("id, sale_number, status, payment_method, total, amount_paid, sale_date, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", TENANT_ID)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("customer_store_credit_history")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // Quotes (graceful fallback if table doesn't exist)
  let quotes: Array<{ id: string; quote_number: string; status: string; total_amount: number; expires_at: string | null; created_at: string }> = [];
  try {
    const { data: quotesData } = await admin
      .from("quotes")
      .select("id, quote_number, status, total_amount, expires_at, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    quotes = quotesData ?? [];
  } catch {
    // table may not exist
  }

  // Communications (graceful fallback)
  let communications: Array<{ id: string; type: string; subject: string | null; sent_at: string; sent_by: string | null; reference_type: string | null; reference_id: string | null }> = [];
  try {
    const { data: commsData } = await admin
      .from("customer_communications")
      .select("id, type, subject, sent_at, sent_by, reference_type, reference_id")
      .eq("customer_id", id)
      .eq("tenant_id", TENANT_ID)
      .order("sent_at", { ascending: false })
      .limit(50);
    communications = commsData ?? [];
  } catch {
    // table may not exist
  }

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
      quotes={quotes}
      invoices={invoices || []}
      passports={passports || []}
      sales={sales || []}
      communications={communications}
      lifetimeSpend={lifetimeSpend}
      lastVisit={lastVisit}
      readOnly={true}
    />
  );
}
