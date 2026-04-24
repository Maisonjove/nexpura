/**
 * Shared hydrator: turns a row from `tenant_dashboard_stats` + the per-user
 * live slices (tasks_today for non-managers, recent activity when the
 * column isn't populated yet) into the typed `DashboardStatsData` shape
 * the client component consumes.
 *
 * Two callers:
 *   - dashboard/actions.ts readPrecomputedStats  (RSC / server action path)
 *   - api/dashboard/stats/route.ts               (Route Handler fast path)
 *
 * Keeping the mapping in one place prevents drift — historically the route
 * had a broken `...row.stats` spread that silently returned empty aggregates
 * because the real schema is typed columns, not a nested jsonb bag.
 *
 * The hydrator is pure: no I/O, no auth, no DB. The caller is responsible
 * for doing the DB reads and passing them in.
 */

import type { DashboardStatsData } from "./actions";

// ---- Row shape we read out of the precomputed table --------------------
// `select("*")` from supabase-js gives us a loosely typed object; narrow
// here so callers don't have to.
export interface PrecomputedRow {
  sales_this_month_revenue: number | string;
  sales_this_month_count: number;
  total_outstanding: number | string;
  overdue_invoice_count: number;
  active_jobs_count: number;
  active_repairs_count: number;
  overdue_repairs: unknown;
  low_stock_items: unknown;
  ready_for_pickup: unknown;
  active_repairs_list: unknown;
  active_bespoke_list: unknown;
  recent_sales: unknown;
  recent_repairs_list: unknown;
  recent_activity?: unknown;
  revenue_sparkline: unknown;
  sales_count_sparkline: unknown;
  repairs_sparkline: unknown;
  customers_sparkline: unknown;
  sales_bar_data: unknown;
  repair_stage_data: unknown;
  computed_at: string;
}

// ---- Live slice inputs the caller supplies -----------------------------
export interface LiveTaskRow {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
}

/**
 * Per-call inputs. `tasks` comes from the per-user task query.
 *
 * `recentActivityFallback` is optional — only used when the precomputed
 * row's `recent_activity` column is absent (pre-migration) or empty. Post
 * migration you can omit it entirely.
 */
export interface HydrateInputs {
  userId: string;
  isManager: boolean;
  tasks: LiveTaskRow[];
  recentActivityFallback?: ActivityItem[];
}

// ---- Internal row shapes (shared with readPrecomputedStats originally) -
type LowStockRow = { id: string; name: string; sku: string | null; quantity: number };
type OverdueRepairRow = {
  id: string;
  repair_number: string | null;
  item_description: string | null;
  customer_name: string | null;
  days_overdue: number;
};
type ReadyForPickupRow = {
  id: string;
  number: string | null;
  label: string;
  customer_name: string | null;
  type: "repair" | "bespoke";
};
type ActiveRepairRow = {
  id: string;
  customer_name: string | null;
  item: string;
  stage: string;
  due_date: string | null;
};
type ActiveBespokeRow = {
  id: string;
  customer_name: string | null;
  title: string;
  stage: string;
  due_date: string | null;
};
type RecentSaleRow = { id: string; sale_number: string | null; customer_name: string | null };
type RecentRepairRow = { id: string; repair_number: string | null; customer_name: string | null };
type PrecomputedActivityRow = {
  id: string;
  title: string;
  stage: string;
  customer_name: string | null;
  updated_at: string;
  type: "job" | "repair";
  href: string;
};
type ActivityItem = {
  id: string;
  title: string;
  stage: string;
  customerName: string | null;
  updatedAt: string;
  type: "job" | "repair";
  href: string;
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function hydrateDashboardStats(
  row: PrecomputedRow,
  inputs: HydrateInputs,
): DashboardStatsData {
  const { userId, isManager, tasks } = inputs;

  // Tasks: managers see everyone's; staff see only theirs (caller's query
  // already filtered for staff via .eq("assigned_to", userId), but we keep
  // the filter here for defensive consistency + to cleanly compute the
  // manager team summary).
  const myTasks = tasks
    .filter((t) => t.assigned_to === userId || t.assigned_to === null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
    }));

  const teamTaskSummary: Array<{
    assigneeId: string;
    assigneeName: string;
    taskCount: number;
    overdueCount: number;
  }> = [];
  if (isManager) {
    const byAssignee = new Map<string, number>();
    for (const t of tasks) {
      if (!t.assigned_to || t.assigned_to === userId) continue;
      byAssignee.set(t.assigned_to, (byAssignee.get(t.assigned_to) ?? 0) + 1);
    }
    for (const [id, count] of byAssignee) {
      teamTaskSummary.push({
        assigneeId: id,
        assigneeName: "Unknown",
        taskCount: count,
        overdueCount: 0,
      });
    }
  }

  // Recent activity: prefer precomputed column; fall back to what the
  // caller passed in (they may have done two live joins themselves when
  // the column wasn't populated yet).
  const precomputedActivity = asArray<PrecomputedActivityRow>(row.recent_activity);
  const recentActivity: ActivityItem[] =
    precomputedActivity.length > 0
      ? precomputedActivity.map((a) => ({
          id: a.id,
          title: a.title || (a.type === "job" ? "Untitled Job" : "Repair"),
          stage: a.stage,
          customerName: a.customer_name ?? null,
          updatedAt: a.updated_at,
          type: a.type,
          href: a.href,
        }))
      : (inputs.recentActivityFallback ?? []);

  const lowStockItems = asArray<LowStockRow>(row.low_stock_items).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    quantity: i.quantity,
  }));
  const overdueRepairs = asArray<OverdueRepairRow>(row.overdue_repairs).map((r) => ({
    id: r.id,
    repairNumber: r.repair_number ?? r.id.slice(-4).toUpperCase(),
    item: r.item_description || "Repair",
    customer: r.customer_name ?? null,
    daysOverdue: r.days_overdue,
  }));
  const readyForPickup = asArray<ReadyForPickupRow>(row.ready_for_pickup).map((r) => ({
    id: r.id,
    number: r.number ?? r.id.slice(-4).toUpperCase(),
    label: r.label,
    customer: r.customer_name ?? null,
    type: r.type,
  }));
  const activeRepairs = asArray<ActiveRepairRow>(row.active_repairs_list).map((r) => ({
    id: r.id,
    customer: r.customer_name ?? null,
    item: r.item || "Repair",
    stage: r.stage,
    due_date: r.due_date,
  }));
  const activeBespokeJobs = asArray<ActiveBespokeRow>(row.active_bespoke_list).map((j) => ({
    id: j.id,
    customer: j.customer_name ?? null,
    title: j.title || "Untitled Job",
    stage: j.stage,
    due_date: j.due_date,
  }));
  const recentSales = asArray<RecentSaleRow>(row.recent_sales).map((s) => ({
    id: s.id,
    saleNumber: s.sale_number ?? s.id.slice(-4).toUpperCase(),
    customer: s.customer_name ?? null,
  }));
  const recentRepairsList = asArray<RecentRepairRow>(row.recent_repairs_list).map((r) => ({
    id: r.id,
    repairNumber: r.repair_number ?? r.id.slice(-4).toUpperCase(),
    customer: r.customer_name ?? null,
  }));

  return {
    salesThisMonthRevenue: Number(row.sales_this_month_revenue) || 0,
    salesThisMonthCount: row.sales_this_month_count,
    activeRepairsCount: row.active_repairs_count,
    activeJobsCount: row.active_jobs_count,
    totalOutstanding: Number(row.total_outstanding) || 0,
    overdueInvoiceCount: row.overdue_invoice_count,
    lowStockItems,
    overdueRepairs,
    readyForPickup,
    recentActivity,
    myTasks,
    teamTaskSummary,
    activeRepairs,
    activeBespokeJobs,
    recentSales,
    recentRepairsList,
    revenueSparkline: asArray<{ value: number }>(row.revenue_sparkline),
    salesCountSparkline: asArray<{ value: number }>(row.sales_count_sparkline),
    repairsSparkline: asArray<{ value: number }>(row.repairs_sparkline),
    customersSparkline: asArray<{ value: number }>(row.customers_sparkline),
    salesBarData: asArray<{ day: string; sales: number; revenue: number }>(row.sales_bar_data),
    repairStageData: asArray<{ name: string; value: number }>(row.repair_stage_data),
  };
}

/**
 * When the precomputed `recent_activity` column is empty or absent, the
 * caller can call this helper with the output of its two live joins
 * (bespoke_jobs + customers, repairs + customers) to build the fallback
 * slice. Shape of the arrays matches the Supabase-js .select() output for
 * those two queries.
 */
export function mergeRecentActivityFallback(
  jobs: Array<{
    id: string;
    title: string | null;
    stage: string | null;
    updated_at: string;
    customers: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  }>,
  repairs: Array<{
    id: string;
    item_description: string | null;
    stage: string | null;
    updated_at: string;
    customers: { full_name: string | null } | Array<{ full_name: string | null }> | null;
  }>,
): ActivityItem[] {
  const customerName = (
    c: { full_name: string | null } | Array<{ full_name: string | null }> | null,
  ): string | null => {
    if (!c) return null;
    if (Array.isArray(c)) return c[0]?.full_name ?? null;
    return c.full_name ?? null;
  };
  const jobsMapped: ActivityItem[] = jobs.map((j) => ({
    id: j.id,
    title: j.title || "Untitled Job",
    stage: j.stage || "enquiry",
    customerName: customerName(j.customers),
    updatedAt: j.updated_at,
    type: "job" as const,
    href: `/bespoke/${j.id}`,
  }));
  const repairsMapped: ActivityItem[] = repairs.map((r) => ({
    id: r.id,
    title: r.item_description || "Repair",
    stage: r.stage || "intake",
    customerName: customerName(r.customers),
    updatedAt: r.updated_at,
    type: "repair" as const,
    href: `/repairs/${r.id}`,
  }));
  return [...jobsMapped, ...repairsMapped]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
}
