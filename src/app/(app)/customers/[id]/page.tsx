import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth-context";
import { matchesReviewOrStaffToken } from "@/lib/auth/review";
import CustomerDetailClient from "./CustomerDetailClient";
import { decryptCustomerPii } from "@/lib/customer-pii";

const DEMO_TENANT = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const admin = createAdminClient();
  // Filter deleted_at IS NULL so a soft-deleted customer's name doesn't
  // leak into the browser tab via <title>. The page body already
  // notFound()s on deleted_at != null (line 53 below), but the metadata
  // callback runs independently and didn't share that filter.
  const { data } = await admin
    .from("customers")
    .select("full_name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const name = (data?.full_name as string | null) ?? null;
  return { title: name ? `${name} — Nexpura` : "Customer — Nexpura" };
}

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
  // W7-HIGH-04: env-backed constant-time check.
  const isReviewMode = matchesReviewOrStaffToken(sp.rt);

  let tenantId: string | null = null;
  if (isReviewMode) {
    tenantId = DEMO_TENANT;
  } else {
    const auth = await getAuthContext();
    if (!auth) redirect("/login");
    tenantId = auth.tenantId;
  }

  // Phase 1: Core customer record — scoped to tenant
  const { data: customerRaw } = await admin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!customerRaw) notFound();

  // W6-HIGH-14: decrypt PII bundle before any downstream code reads
  // address / notes / preferences off the row.
  const customer = await decryptCustomerPii(customerRaw);

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
      // `quotes` has no `deleted_at` column — filtering on it returned a
      // PG error and crashed the customer detail page. Hard-deletion is
      // the current behaviour; revisit if a soft-delete column is added.
      .select("id, quote_number, status, total_amount, expires_at, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
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
    // passports has no customer_id FK — link via email instead. Skips the
    // query entirely if the customer has no email so we don't pull every
    // null-email passport in the tenant. (Was 500ing on every detail load
    // because of the customer_id+deleted_at miss; the filter on customer.email
    // also skips soft-deleted passports as a side effect.)
    customer?.email
      ? admin
          .from("passports")
          .select("id, passport_uid, title, jewellery_type, status, created_at")
          .eq("current_owner_email", customer.email)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    admin
      .from("sales")
      .select("id, sale_number, status, payment_method, total, amount_paid, sale_date, created_at")
      .eq("customer_id", id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    (async () => {
      try {
        // customer_communications has no reference_type / reference_id
        // columns — selecting them returned a PG error so this whole block
        // returned [] and the Communications tab was permanently empty.
        const { data } = await admin
          .from("customer_communications")
          .select("id, type, subject, sent_at, sent_by, status, body")
          .eq("customer_id", id)
          .eq("tenant_id", tenantId)
          .order("sent_at", { ascending: false })
          .limit(50);
        return data ?? [];
      } catch { return []; }
    })(),
    (async () => {
      try {
        // The embedded inventory join previously had no `deleted_at`
        // filter, so soft-deleted inventory rows kept appearing in the
        // wishlist with their full retail price — confusing for staff
        // and dangerous to quote. Filter the join.
        const { data } = await admin
          .from("wishlists")
          .select("id, inventory_id, added_at, inventory!inner(name, sku, retail_price, deleted_at)")
          .eq("customer_id", id)
          .eq("tenant_id", tenantId)
          .is("inventory.deleted_at", null)
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
