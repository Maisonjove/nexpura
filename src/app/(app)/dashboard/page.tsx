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
    .select("full_name, tenant_id, role, tenants(name, currency, tax_rate, tax_name)")
    .eq("id", user?.id ?? "")
    .single();

  const firstName = userData?.full_name?.split(" ")[0] || "there";
  const tenantData = userData?.tenants as { name?: string; currency?: string; tax_rate?: number; tax_name?: string } | null;
  const tenantName = tenantData?.name ?? null;
  const tenantId = userData?.tenant_id;
  const currency = tenantData?.currency || "AUD";
  const userRole = (userData as { role?: string } | null)?.role ?? "staff";
  const isManager = userRole === "owner" || userRole === "manager";

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

  // Outstanding invoices — statuses cover both legacy and current DB values
  const { data: outstandingData } = await admin
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, due_date, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .in("status", ["partial", "unpaid", "sent", "partially_paid", "overdue"])
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
    .limit(5);

  const totalOutstanding = (outstandingData ?? []).reduce(
    (sum, inv) => sum + Math.max(0, (inv.total || 0) - (inv.amount_paid || 0)),
    0
  );

  const { count: overdueInvoiceCount } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId ?? "")
    .not("status", "in", '("paid","voided","draft","cancelled")')
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

  // Overdue repairs — detailed (for dashboard alert)
  const { data: overdueRepairsData } = await admin
    .from("repairs")
    .select("id, repair_number, item_description, due_date, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")')
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(5);

  const overdueRepairs = (overdueRepairsData ?? []).map((r) => {
    const dueDate = r.due_date ? new Date(r.due_date) : null;
    const daysOverdue = dueDate
      ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const customer = Array.isArray(r.customers)
      ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (r.customers as { full_name: string | null } | null)?.full_name ?? null;
    return {
      id: r.id,
      repairNumber: r.repair_number ?? r.id.slice(-4).toUpperCase(),
      item: r.item_description || "Repair",
      customer,
      daysOverdue,
    };
  });

  // Low stock — with item names; deduplicate by SKU to guard against duplicate seed rows
  const { data: lowStockRaw } = await admin
    .from("inventory")
    .select("id, name, sku, quantity, low_stock_threshold, track_quantity")
    .eq("tenant_id", tenantId ?? "")
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("track_quantity", true);

  const _seenSkus = new Map<string, (typeof lowStockRaw extends (infer T)[] | null ? T : never)>();
  for (const item of lowStockRaw ?? []) {
    const key = item.sku ?? item.id;
    if (!_seenSkus.has(key)) _seenSkus.set(key, item);
  }
  const dedupedInventory = Array.from(_seenSkus.values());

  const lowStockItems = dedupedInventory
    .filter((i) => i.quantity <= (i.low_stock_threshold ?? 1))
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 10)
    .map((i) => ({ id: i.id, name: i.name, sku: i.sku ?? null, quantity: i.quantity }));

  // Ready for pickup — repairs in 'ready' stage
  const { data: readyRepairsData } = await admin
    .from("repairs")
    .select("id, repair_number, item_description, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .eq("stage", "ready")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(5);

  const readyRepairs = (readyRepairsData ?? []).map((r) => ({
    id: r.id,
    number: r.repair_number ?? r.id.slice(-4).toUpperCase(),
    label: r.item_description || "Repair",
    customer:
      Array.isArray(r.customers)
        ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
    type: "repair" as const,
  }));

  // Ready for pickup — bespoke jobs in 'ready' stage
  const { data: readyBespokeData } = await admin
    .from("bespoke_jobs")
    .select("id, job_number, title, customers(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .eq("stage", "ready")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(5);

  const readyBespokeJobs = (readyBespokeData ?? []).map((j) => ({
    id: j.id,
    number: j.job_number ?? j.id.slice(-4).toUpperCase(),
    label: j.title || "Bespoke Job",
    customer:
      Array.isArray(j.customers)
        ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
    type: "bespoke" as const,
  }));

  const readyForPickup = [...readyRepairs, ...readyBespokeJobs];

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

  // Tasks due TODAY — tenant-scoped (table is `tasks`, not `staff_tasks`)
  // Managers/owners see ALL team tasks; staff see only their own
  let myTasksQuery = admin
    .from("tasks")
    .select("id, title, priority, status, due_date, assigned_to, users(full_name)")
    .eq("tenant_id", tenantId ?? "")
    .neq("status", "completed")
    .eq("due_date", today)
    .order("priority", { ascending: false })
    .limit(50);

  if (!isManager) {
    myTasksQuery = myTasksQuery.eq("assigned_to", user?.id ?? "");
  }

  const { data: allTasks } = await myTasksQuery;

  // Split into own tasks and team tasks
  // Include unassigned tasks (assigned_to=null) in myTasks — they are visible to all managers
  const myTasks = (allTasks ?? []).filter((t) => t.assigned_to === user?.id || t.assigned_to === null).map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    status: t.status,
    due_date: t.due_date,
  }));

  // For managers: build team summary grouped by assignee (excludes null/self — those are in myTasks)
  type TeamTaskSummary = { assigneeId: string; assigneeName: string; taskCount: number; overdueCount: number };
  const teamTaskSummary: TeamTaskSummary[] = [];
  if (isManager) {
    const byAssignee = new Map<string, { name: string; count: number; overdue: number }>();
    for (const t of allTasks ?? []) {
      if (!t.assigned_to || t.assigned_to === user?.id) continue;
      const existing = byAssignee.get(t.assigned_to);
      const assigneeName = (Array.isArray(t.users) ? t.users[0]?.full_name : (t.users as { full_name: string | null } | null)?.full_name) ?? "Unknown";
      if (existing) {
        existing.count++;
      } else {
        byAssignee.set(t.assigned_to, { name: assigneeName, count: 1, overdue: 0 });
      }
    }
    for (const [id, data] of byAssignee) {
      teamTaskSummary.push({ assigneeId: id, assigneeName: data.name, taskCount: data.count, overdueCount: data.overdue });
    }
  }

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
      lowStockItems={lowStockItems}
      overdueRepairs={overdueRepairs}
      readyForPickup={readyForPickup}
      recentActivity={recentActivity}
      myTasks={myTasks}
      teamTaskSummary={teamTaskSummary}
      isManager={isManager}
      activeRepairs={activeRepairs}
      activeBespokeJobs={activeBespokeJobs}
      currency={currency}
    />
  );
}
