import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

  // Fetch recent printable documents in parallel
  const [
    { data: invoices },
    { data: quotes },
    { data: repairs },
    { data: bespoke },
    { data: passports },
    { data: refunds },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, total, status, created_at, customers(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("quotes")
      .select("id, quote_number, total, status, created_at, customers(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("repairs")
      .select("id, repair_number, status, created_at, customers(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("bespoke_jobs")
      .select("id, job_number, title, status, created_at, customers(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("passports")
      .select("id, passport_uid, title, status, created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("refunds")
      .select("id, refund_number, amount, status, created_at, customers(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

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
