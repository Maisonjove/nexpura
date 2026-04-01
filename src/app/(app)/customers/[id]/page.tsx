import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
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
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
  }

  // Phase 1: Core customer record — scoped to tenant
  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!customer) notFound();

  // Phase 2: Fetch ALL related data in parallel — 10 queries at once
  const [
    creditHistoryResult,
    repairsResult,
    bespokeJobsResult,
    quotesResult,
    invoicesResult,
    passportsResult,
    salesResult,
    communicationsResult,
    wishlistResult,
    loyaltyResult,
  ] = await Promise.all([
    admin
      .from("customer_store_credit_history")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
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
    (async () => {
      try {
        const { data } = await admin
          .from("customer_communications")
          .select("id, type, subject, sent_at, sent_by, reference_type, reference_id")
          .eq("customer_id", id)
          .eq("tenant_id", tenantId)
          .order("sent_at", { ascending: false })
          .limit(50);
        return data ?? [];
      } catch { return []; }
    })(),
    (async () => {
      try {
        const { data } = await admin
          .from("wishlists")
          .select("id, inventory_id, added_at, inventory(name, sku, retail_price)")
          .eq("customer_id", id)
          .eq("tenant_id", tenantId)
          .order("added_at", { ascending: false });
        return (data ?? []).map(item => ({
          ...item,
          inventory: Array.isArray(item.inventory) ? item.inventory[0] : item.inventory,
        }));
      } catch { return []; }
    })(),
    (async () => {
      try {
        const { data } = await admin
          .from("loyalty_transactions")
          .select("id, points, type, description, created_at")
          .eq("customer_id", id)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20);
        return data ?? [];
      } catch { return []; }
    })(),
  ]);

  const invoices = invoicesResult.data ?? [];
  const lifetimeSpend = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const lastVisitDates = invoices
    .map((inv) => inv.paid_at || inv.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());
  const lastVisit = lastVisitDates[0] ?? null;

  return (
    <CustomerDetailClient
      customer={customer}
      creditHistory={creditHistoryResult.data ?? []}
      repairs={repairsResult.data ?? []}
      bespokeJobs={bespokeJobsResult.data ?? []}
      quotes={quotesResult.data ?? []}
      invoices={invoices}
      passports={passportsResult.data ?? []}
      sales={salesResult.data ?? []}
      communications={communicationsResult}
      lifetimeSpend={lifetimeSpend}
      lastVisit={lastVisit}
      readOnly={isReviewMode}
      wishlistItems={wishlistResult as { id: string; inventory_id: string; added_at: string; inventory?: { name: string; sku: string | null; retail_price: number | null } }[]}
      loyaltyTransactions={loyaltyResult as { id: string; points: number; type: string; description: string | null; created_at: string }[]}
    />
  );
}
