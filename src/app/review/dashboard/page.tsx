import { createAdminClient } from "@/lib/supabase/admin";
import DashboardClient from "@/app/(app)/dashboard/DashboardClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
const DEMO_USER_ID = "bd7d2c20-5727-4f80-a449-818429abecc9";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ReviewDashboardPage() {
  const admin = createAdminClient();
  const tenantId = TENANT_ID;

  const today = new Date().toISOString().split("T")[0];
  const monthStartStr = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  // Sales this month
  let salesThisMonthRevenue = 0;
  let salesThisMonthCount = 0;
  try {
    const { data: salesData } = await admin
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStartStr);
    salesThisMonthRevenue = (salesData ?? []).reduce((s, r) => s + (r.total || 0), 0);
    salesThisMonthCount = (salesData ?? []).length;
  } catch {
    // table may not exist
  }

  const { data: outstandingData } = await admin
    .from("invoices")
    .select("id, invoice_number, total, amount_paid, due_date, customers(full_name)")
    .eq("tenant_id", tenantId)
    .in("status", ["partial", "unpaid", "overdue"])
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
    .eq("tenant_id", tenantId)
    .not("status", "in", '("paid","voided","draft","cancelled")')
    .lt("due_date", today)
    .is("deleted_at", null);

  const { count: activeJobsCount } = await admin
    .from("bespoke_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("stage", "in", '("completed","cancelled")');

  const { count: activeRepairsCount } = await admin
    .from("repairs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .not("stage", "in", '("collected","cancelled")');

  const { data: overdueRepairsData } = await admin
    .from("repairs")
    .select("id, repair_number, item_description, due_date, customers(full_name)")
    .eq("tenant_id", tenantId)
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

  const { data: lowStockRaw } = await admin
    .from("inventory")
    .select("id, name, sku, quantity, low_stock_threshold, track_quantity")
    .eq("tenant_id", tenantId)
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

  const { data: readyRepairsData } = await admin
    .from("repairs")
    .select("id, repair_number, item_description, customers(full_name)")
    .eq("tenant_id", tenantId)
    .eq("stage", "ready")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(5);

  const readyRepairs = (readyRepairsData ?? []).map((r) => ({
    id: r.id,
    number: r.repair_number ?? r.id.slice(-4).toUpperCase(),
    label: r.item_description || "Repair",
    customer: Array.isArray(r.customers)
      ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
    type: "repair" as const,
  }));

  const { data: readyBespokeData } = await admin
    .from("bespoke_jobs")
    .select("id, job_number, title, customers(full_name)")
    .eq("tenant_id", tenantId)
    .eq("stage", "ready")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(5);

  const readyBespokeJobs = (readyBespokeData ?? []).map((j) => ({
    id: j.id,
    number: j.job_number ?? j.id.slice(-4).toUpperCase(),
    label: j.title || "Bespoke Job",
    customer: Array.isArray(j.customers)
      ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
    type: "bespoke" as const,
  }));

  const readyForPickup = [...readyRepairs, ...readyBespokeJobs];

  const { data: activeRepairsData } = await admin
    .from("repairs")
    .select("id, item_description, stage, due_date, customers(full_name)")
    .eq("tenant_id", tenantId)
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

  const { data: activeBespokeData } = await admin
    .from("bespoke_jobs")
    .select("id, title, stage, due_date, customers(full_name)")
    .eq("tenant_id", tenantId)
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

  const { data: recentJobs } = await admin
    .from("bespoke_jobs")
    .select("id, title, stage, updated_at, customers(full_name)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  const { data: recentRepairs } = await admin
    .from("repairs")
    .select("id, item_description, stage, updated_at, customers(full_name)")
    .eq("tenant_id", tenantId)
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
      href: `/review/bespoke/${j.id}`,
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
      href: `/review/repairs/${r.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const { data: allTasksData } = await admin
    .from("tasks")
    .select("id, title, priority, status, due_date, assigned_to")
    .eq("tenant_id", tenantId)
    .neq("status", "completed")
    .eq("due_date", today)
    .order("priority", { ascending: false })
    .limit(50);

  const myTasks = (allTasksData ?? [])
    .filter((t) => t.assigned_to === DEMO_USER_ID || t.assigned_to === null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
    }));

  type TeamTaskSummary = { assigneeId: string; assigneeName: string; taskCount: number; overdueCount: number };
  const teamTaskSummary: TeamTaskSummary[] = [];

  return (
    <DashboardClient
      basePath="/review"
      readOnly={true}
      firstName="Marcus"
      tenantName="Marcus & Co. Fine Jewellery"
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
      isManager={true}
      activeRepairs={activeRepairs}
      activeBespokeJobs={activeBespokeJobs}
      currency="AUD"
    />
  );
}
