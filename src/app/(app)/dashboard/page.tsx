import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("full_name, tenant_id, tenants(name, currency, tax_rate, tax_name)")
    .eq("id", user?.id ?? "")
    .single();

  const firstName = userData?.full_name?.split(" ")[0] || "there";
  const tenantData = userData?.tenants as { name?: string; currency?: string; tax_rate?: number; tax_name?: string } | null;
  const tenantName = tenantData?.name ?? null;
  const tenantId = userData?.tenant_id;
  const currency = tenantData?.currency || "AUD";

  const admin = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Sales this month
  let salesThisMonthRevenue = 0;
  let salesThisMonthCount = 0;
  try {
    const { data: salesData } = await admin
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId ?? "")
      .gte("created_at", monthStartStr);
    salesThisMonthRevenue = (salesData ?? []).reduce((s, r) => s + (r.total || 0), 0);
    salesThisMonthCount = (salesData ?? []).length;
  } catch {
    // sales table may not exist yet
  }

  // Outstanding invoices
  const { data: outstandingData } = await admin
    .from("invoices")
    .select("amount_due")
    .eq("tenant_id", tenantId ?? "")
    .in("status", ["sent", "partially_paid", "overdue"])
    .is("deleted_at", null);

  const totalOutstanding = (outstandingData ?? []).reduce(
    (sum, inv) => sum + (inv.amount_due || 0),
    0
  );

  const { count: overdueInvoiceCount } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .not("status", "in", '("paid","voided","draft")')
    .lt("due_date", today)
    .is("deleted_at", null);

  // Active jobs count
  const { count: activeJobsCount } = await admin
    .from("bespoke_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("completed","cancelled")');

  // Active repairs count
  const { count: activeRepairsCount } = await admin
    .from("repairs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")');

  // Overdue repairs count
  const { count: overdueRepairsCount } = await admin
    .from("repairs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")')
    .lt("due_date", today);

  // Low stock
  const { data: lowStockItems } = await admin
    .from("inventory")
    .select("quantity, low_stock_threshold, track_quantity")
    .eq("tenant_id", tenantId ?? "")
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("track_quantity", true);

  const lowStockCount = (lowStockItems ?? []).filter(
    (i) => i.quantity <= (i.low_stock_threshold ?? 1)
  ).length;

  // Active repairs for display (limit 5, ordered by due date)
  const { data: activeRepairsData } = await admin
    .from("repairs")
    .select("id, item_description, stage, due_date, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")')
    .order("due_date", { ascending: true })
    .limit(5);

  const activeRepairs = (activeRepairsData ?? []).map((r) => ({
    id: r.id,
    customer: Array.isArray(r.customers)
      ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
    item: r.item_description || "Repair",
    stage: r.stage || "intake",
    due_date: r.due_date,
  }));

  // Active bespoke jobs for display (limit 5, ordered by due date)
  const { data: activeBespokeData } = await admin
    .from("bespoke_jobs")
    .select("id, title, stage, due_date, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("completed","cancelled")')
    .order("due_date", { ascending: true })
    .limit(5);

  const activeBespokeJobs = (activeBespokeData ?? []).map((j) => ({
    id: j.id,
    customer: Array.isArray(j.customers)
      ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
    title: j.title || "Untitled Job",
    stage: j.stage || "enquiry",
    due_date: j.due_date,
  }));

  // Recent activity
  const { data: recentJobs } = await admin
    .from("bespoke_jobs")
    .select("id, title, stage, updated_at, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: recentRepairs } = await admin
    .from("repairs")
    .select("id, item_description, stage, updated_at, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  type ActivityItem = {
    id: string;
    title: string;
    stage: string;
    customerName: string | null;
    updatedAt: string;
    type: "job" | "repair";
    href: string;
  };

  const recentActivity: ActivityItem[] = [
    ...(recentJobs ?? []).map((j) => ({
      id: j.id,
      title: j.title || "Untitled Job",
      stage: j.stage || "enquiry",
      customerName: Array.isArray(j.customers)
        ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
      updatedAt: j.updated_at,
      type: "job" as const,
      href: `/bespoke/${j.id}`,
    })),
    ...(recentRepairs ?? []).map((r) => ({
      id: r.id,
      title: r.item_description || "Repair",
      stage: r.stage || "intake",
      customerName: Array.isArray(r.customers)
        ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
      updatedAt: r.updated_at,
      type: "repair" as const,
      href: `/repairs/${r.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // My Tasks for today
  const { data: myTasks } = await admin
    .from("staff_tasks")
    .select("id, title, priority, status, due_date")
    .eq("tenant_id", tenantId ?? "")
    .eq("assigned_to", user?.id ?? "")
    .neq("status", "completed")
    .order("due_date", { ascending: true })
    .limit(5);

  return (
    <DashboardClient
      firstName={firstName}
      tenantName={tenantName}
      salesThisMonthRevenue={salesThisMonthRevenue}
      salesThisMonthCount={salesThisMonthCount}
      activeRepairsCount={activeRepairsCount ?? 0}
      activeJobsCount={activeJobsCount ?? 0}
      totalOutstanding={totalOutstanding}
      overdueInvoiceCount={overdueInvoiceCount ?? 0}
      lowStockCount={lowStockCount}
      overdueRepairsCount={overdueRepairsCount ?? 0}
      recentActivity={recentActivity}
      myTasks={myTasks ?? []}
      activeRepairs={activeRepairs}
      activeBespokeJobs={activeBespokeJobs}
      currency={currency}
    />
  );
}
