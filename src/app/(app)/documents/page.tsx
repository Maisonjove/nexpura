import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import DocumentCenterClient from "./DocumentCenterClient";

export const metadata = { title: "Document Center — Nexpura" };

export default async function DocumentCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) redirect("/login");
  const tenantId = userData.tenant_id;

  // Per Brief 2 perf #2 — wrap the six parallel doc queries in
  // unstable_cache. Each render previously paid for six round-trips
  // even when nothing had changed; now they're cached for 60s and
  // invalidated by the relevant CACHE_TAGS on writes.
  const fetchDocs = unstable_cache(
    async () => {
      // Use admin client inside the cached function — no per-request
      // session needed once we've authenticated above.
      const admin = createAdminClient();
      return Promise.all([
        admin
          .from("invoices")
          .select("id, invoice_number, total, status, created_at, customers(full_name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("quotes")
          .select("id, quote_number, total, status, created_at, customers(full_name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("repairs")
          .select("id, repair_number, status, created_at, customers(full_name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("bespoke_jobs")
          .select("id, job_number, title, status, created_at, customers(full_name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("passports")
          .select("id, passport_uid, title, status, created_at")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("refunds")
          .select("id, refund_number, amount, status, created_at, customers(full_name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
    },
    ["documents-center", tenantId],
    {
      tags: [
        // Tag with the existing CACHE_TAGS we have — invoices + workshop
        // cover the two write paths most likely to add a doc the user
        // expects to see immediately. Quotes / passports / refunds have
        // no dedicated tag yet; the 60s revalidate floor keeps them
        // close to live.
        CACHE_TAGS.invoices(tenantId),
        CACHE_TAGS.workshop(tenantId),
      ],
      revalidate: 60,
    }
  );

  const [
    { data: invoices },
    { data: quotes },
    { data: repairs },
    { data: bespoke },
    { data: passports },
    { data: refunds },
  ] = await fetchDocs();

  // Normalize Supabase join results (customers comes back as array)
  function normalizeDoc(items: unknown[]): DocumentItem[] {
    return (items as Array<Record<string, unknown>>).map((item) => ({
      ...item,
      customers: Array.isArray(item.customers)
        ? (item.customers[0] ?? null)
        : (item.customers as { full_name: string } | null),
    })) as DocumentItem[];
  }

  return (
    <DocumentCenterClient
      invoices={normalizeDoc(invoices ?? [])}
      quotes={normalizeDoc(quotes ?? [])}
      repairs={normalizeDoc(repairs ?? [])}
      bespoke={normalizeDoc(bespoke ?? [])}
      passports={(passports ?? []) as PassportDoc[]}
      refunds={normalizeDoc(refunds ?? [])}
    />
  );
}

export interface DocumentItem {
  id: string;
  invoice_number?: string | null;
  quote_number?: string | null;
  repair_number?: string | null;
  job_number?: string | null;
  refund_number?: string | null;
  title?: string | null;
  total?: number | null;
  amount?: number | null;
  status: string;
  created_at: string;
  customers?: { full_name: string } | null;
}

export interface PassportDoc {
  id: string;
  passport_uid: string;
  title: string;
  status: string;
  created_at: string;
}
