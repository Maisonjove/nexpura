import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import InvoiceListClient from "./InvoiceListClient";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const statusFilter = params.status || "all";
  const page = parseInt(params.page || "1");
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const tenantId = userData?.tenant_id;
  const today = new Date().toISOString().split("T")[0];

  // Stats queries
  const { data: outstandingData } = await supabase
    .from("invoices")
    .select("amount_due")
    .eq("tenant_id", tenantId ?? "")
    .in("status", ["sent", "partially_paid", "overdue"])
    .is("deleted_at", null);

  const totalOutstanding = (outstandingData ?? []).reduce(
    (sum, inv) => sum + (inv.amount_due || 0),
    0
  );

  const { data: overdueData } = await supabase
    .from("invoices")
    .select("amount_due")
    .eq("tenant_id", tenantId ?? "")
    .not("status", "in", '("paid","voided","draft")')
    .lt("due_date", today)
    .is("deleted_at", null);

  const totalOverdue = (overdueData ?? []).reduce(
    (sum, inv) => sum + (inv.amount_due || 0),
    0
  );

  // Paid this month
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const { data: paidThisMonthData } = await supabase
    .from("payments")
    .select("amount")
    .eq("tenant_id", tenantId ?? "")
    .gte("payment_date", monthStartStr);

  const paidThisMonth = (paidThisMonthData ?? []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  // Main invoice query
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, invoice_date, due_date, total, amount_due, amount_paid, customers(full_name)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null);

  if (statusFilter !== "all") {
    if (statusFilter === "overdue") {
      query = query
        .not("status", "in", '("paid","voided","draft")')
        .lt("due_date", today);
    } else {
      query = query.eq("status", statusFilter);
    }
  }

  if (q) {
    query = query.ilike("invoice_number", `%${q}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data: invoices, count } = await query;

  const totalPages = Math.ceil((count || 0) / pageSize);

  const normalizedInvoices: InvoiceRow[] = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    total: inv.total,
    amount_due: inv.amount_due,
    amount_paid: inv.amount_paid,
    customers: Array.isArray(inv.customers)
      ? (inv.customers[0] ?? null)
      : inv.customers,
  }));

  return (
    <InvoiceListClient
      invoices={normalizedInvoices}
      totalCount={count || 0}
      page={page}
      totalPages={totalPages}
      q={q}
      statusFilter={statusFilter}
      stats={{
        totalOutstanding,
        totalOverdue,
        paidThisMonth,
      }}
    />
  );
}

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  amount_due: number;
  amount_paid: number;
  customers: { full_name: string | null } | null;
};
