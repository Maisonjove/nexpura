"use server";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth-context";
import { getCached, tenantCacheKey, invalidateCachePattern } from "@/lib/cache";
import { coalesceRequest } from "@/lib/high-scale";
import logger from "@/lib/logger";

// ────────────────────────────────────────────────────────────────
// Cache Invalidation (call after sales, repairs, invoices change)
// ────────────────────────────────────────────────────────────────

export async function invalidateDashboardCache(tenantId: string): Promise<void> {
  // Invalidate all dashboard caches for this tenant (any location filter)
  await invalidateCachePattern(`tenant:${tenantId}:dashboard:*`);
}

// ────────────────────────────────────────────────────────────────
// Dashboard Data Types
// ────────────────────────────────────────────────────────────────

// Critical data - minimal data needed to render the shell immediately
export interface DashboardCriticalData {
  firstName: string;
  tenantName: string | null;
  businessType: string | null;
  currency: string;
  isManager: boolean;
  userId: string;
  tenantId: string;
  timezone: string;
}

// Stats data - fetched client-side after initial render
export interface DashboardStatsData {
  salesThisMonthRevenue: number;
  salesThisMonthCount: number;
  activeRepairsCount: number;
  activeJobsCount: number;
  totalOutstanding: number;
  overdueInvoiceCount: number;
  lowStockItems: Array<{ id: string; name: string; sku: string | null; quantity: number }>;
  overdueRepairs: Array<{ id: string; repairNumber: string; item: string; customer: string | null; daysOverdue: number; locationName?: string }>;
  readyForPickup: Array<{ id: string; number: string; label: string; customer: string | null; type: "repair" | "bespoke"; locationName?: string }>;
  recentActivity: Array<{ id: string; title: string; stage: string; customerName: string | null; updatedAt: string; type: "job" | "repair"; href: string; locationName?: string }>;
  myTasks: Array<{ id: string; title: string; priority: string; status: string; due_date: string | null }>;
  teamTaskSummary: Array<{ assigneeId: string; assigneeName: string; taskCount: number; overdueCount: number }>;
  activeRepairs: Array<{ id: string; customer: string | null; item: string; stage: string; due_date: string | null; locationName?: string }>;
  activeBespokeJobs: Array<{ id: string; customer: string | null; title: string; stage: string; due_date: string | null; locationName?: string }>;
  recentSales: Array<{ id: string; saleNumber: string; customer: string | null }>;
  recentRepairsList: Array<{ id: string; repairNumber: string; customer: string | null }>;
  revenueSparkline: Array<{ value: number }>;
  salesCountSparkline: Array<{ value: number }>;
  repairsSparkline: Array<{ value: number }>;
  customersSparkline: Array<{ value: number }>;
  salesBarData: Array<{ day: string; sales: number; revenue: number }>;
  repairStageData: Array<{ name: string; value: number }>;
}

// Combined type for backward compatibility
export interface DashboardData extends DashboardCriticalData, DashboardStatsData {}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

// Shared tenant-meta fetch — used by both the critical data path and the
// stats path. Cached per tenant (not per user) with a long TTL since these
// fields rarely change. Previously both paths re-queried `tenants` for
// timezone / business_type, adding ~50-100ms each on cold caches.
async function getTenantMeta(tenantId: string): Promise<{ businessType: string | null; timezone: string }> {
  return getCached(
    tenantCacheKey(tenantId, "tenant-meta"),
    async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("tenants")
        .select("business_type, timezone")
        .eq("id", tenantId)
        .maybeSingle();
      return {
        businessType: data?.business_type ?? null,
        timezone: data?.timezone ?? "Australia/Sydney",
      };
    },
    900 // 15 min — tenant meta is effectively static
  );
}

function getLast7Days(tz: string = "Australia/Sydney"): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Format in tenant's timezone
    days.push(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d));
  }
  return days;
}

// ────────────────────────────────────────────────────────────────
// Critical Data Fetcher (minimal, fast)
// ────────────────────────────────────────────────────────────────

export async function getDashboardCriticalData(): Promise<DashboardCriticalData> {
  const auth = await requireAuth();
  const { userId, tenantId, tenantName, currency, isManager } = auth;

  const cacheKey = tenantCacheKey(tenantId, "dashboard-critical", userId);

  return coalesceRequest(cacheKey, () => getCached(
    cacheKey,
    async () => {
      const meta = await getTenantMeta(tenantId);
      return {
        firstName: tenantName || "there",
        tenantName,
        businessType: meta.businessType,
        currency,
        isManager,
        userId,
        tenantId,
        timezone: meta.timezone,
      };
    },
    900 // 15 min — tenant info rarely changes (aligned with getTenantMeta)
  ));
}

// ────────────────────────────────────────────────────────────────
// Stats Data Fetcher (heavy, loaded client-side)
// ────────────────────────────────────────────────────────────────

export async function getDashboardStats(locationIds: string[] | null): Promise<DashboardStatsData> {
  const auth = await requireAuth();
  const { userId, tenantId, isManager } = auth;

  // Fast path: use the precomputed `tenant_dashboard_stats` row when
  //   (a) we're not filtering by a specific subset of locations (the
  //       precomputed row is tenant-wide), and
  //   (b) the row is fresh (< 60 s old).
  // Falls back to the live-query path otherwise.
  if (!locationIds || locationIds.length === 0) {
    const precomputed = await readPrecomputedStats(userId, tenantId, isManager);
    if (precomputed) return precomputed;
  }

  const locationKey = locationIds?.sort().join(",") || "all";
  const cacheKey = tenantCacheKey(tenantId, "dashboard-stats", `${locationKey}:${userId}`);

  return coalesceRequest(cacheKey, () => getCached(
    cacheKey,
    async () => fetchDashboardStats(userId, tenantId, isManager, locationIds),
    300 // 5 minute cache — stats are a snapshot; absolute freshness not required
  ));
}

// Max staleness tolerated when serving from the precomputed table. If the
// row is older than this, we fall back to live compute AND kick off an
// async refresh via `after()` so the next caller gets fresh data.
const PRECOMPUTED_MAX_STALE_MS = 60_000;

/**
 * Fast-path reader. Returns DashboardStatsData built from one row read
 * out of `tenant_dashboard_stats`, layered with per-user pieces (myTasks,
 * teamTaskSummary, recentActivity) that can't be precomputed per tenant.
 *
 * Returns null on miss / stale / error so the caller falls through to
 * the live-query path. In either path a background refresh is scheduled.
 */
async function readPrecomputedStats(
  userId: string,
  tenantId: string,
  isManager: boolean
): Promise<DashboardStatsData | null> {
  const admin = createAdminClient();

  // 1. Single-row read of the precomputed aggregate.
  const { data: row, error } = await admin
    .from("tenant_dashboard_stats")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    logger.warn("[dashboard] precomputed read failed, falling back", { err: error.message });
    return null;
  }
  if (!row) {
    // First-ever read for this tenant — compute now, schedule refresh.
    after(() => refreshDashboardStatsAsync(tenantId));
    return null;
  }

  const ageMs = Date.now() - new Date(row.computed_at as string).getTime();
  if (ageMs > PRECOMPUTED_MAX_STALE_MS) {
    // Too old — fall back to live + schedule refresh.
    after(() => refreshDashboardStatsAsync(tenantId));
    return null;
  }

  // 2. Per-user pieces that aren't (and shouldn't be) precomputed tenant-wide.
  const tz = "Australia/Sydney";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  let tasksQ = admin
    .from("tasks")
    .select("id, title, priority, status, due_date, assigned_to")
    .eq("tenant_id", tenantId)
    .neq("status", "completed")
    .eq("due_date", today)
    .order("priority", { ascending: false })
    .limit(50);
  if (!isManager) tasksQ = tasksQ.eq("assigned_to", userId);

  // Recent activity is still live — cheap 5-row ordered reads.
  const [allTasksResult, recentJobsResult, recentRepairsResult] = await Promise.all([
    tasksQ,
    admin
      .from("bespoke_jobs")
      .select("id, title, stage, updated_at, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    admin
      .from("repairs")
      .select("id, item_description, stage, updated_at, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const allTasks = allTasksResult.data ?? [];
  const myTasks = allTasks
    .filter((t) => t.assigned_to === userId || t.assigned_to === null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
    }));

  type TeamTaskSummary = { assigneeId: string; assigneeName: string; taskCount: number; overdueCount: number };
  const teamTaskSummary: TeamTaskSummary[] = [];
  if (isManager) {
    const byAssignee = new Map<string, number>();
    for (const t of allTasks) {
      if (!t.assigned_to || t.assigned_to === userId) continue;
      byAssignee.set(t.assigned_to, (byAssignee.get(t.assigned_to) ?? 0) + 1);
    }
    for (const [id, count] of byAssignee) {
      teamTaskSummary.push({ assigneeId: id, assigneeName: "Unknown", taskCount: count, overdueCount: 0 });
    }
  }

  type ActivityItem = { id: string; title: string; stage: string; customerName: string | null; updatedAt: string; type: "job" | "repair"; href: string; locationName?: string };
  const recentActivity: ActivityItem[] = [
    ...(recentJobsResult.data ?? []).map((j) => ({
      id: j.id as string,
      title: (j.title as string) || "Untitled Job",
      stage: (j.stage as string) || "enquiry",
      customerName: Array.isArray(j.customers)
        ? ((j.customers[0] as { full_name: string | null } | null)?.full_name ?? null)
        : ((j.customers as { full_name: string | null } | null)?.full_name ?? null),
      updatedAt: j.updated_at as string,
      type: "job" as const,
      href: `/bespoke/${j.id}`,
    })),
    ...(recentRepairsResult.data ?? []).map((r) => ({
      id: r.id as string,
      title: (r.item_description as string) || "Repair",
      stage: (r.stage as string) || "intake",
      customerName: Array.isArray(r.customers)
        ? ((r.customers[0] as { full_name: string | null } | null)?.full_name ?? null)
        : ((r.customers as { full_name: string | null } | null)?.full_name ?? null),
      updatedAt: r.updated_at as string,
      type: "repair" as const,
      href: `/repairs/${r.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // 3. Re-hydrate row lists from jsonb into the typed shapes the client
  //    component expects. Jsonb columns came out as plain JS objects.
  type LS = { id: string; name: string; sku: string | null; quantity: number };
  type OR = { id: string; repair_number: string | null; item_description: string | null; customer_name: string | null; days_overdue: number };
  type RF = { id: string; number: string | null; label: string; customer_name: string | null; type: "repair" | "bespoke" };
  type AR = { id: string; customer_name: string | null; item: string; stage: string; due_date: string | null };
  type AB = { id: string; customer_name: string | null; title: string; stage: string; due_date: string | null };
  type RS = { id: string; sale_number: string | null; customer_name: string | null };
  type RR = { id: string; repair_number: string | null; customer_name: string | null };

  const lowStockItems = ((row.low_stock_items as LS[]) ?? []).map((i) => ({
    id: i.id, name: i.name, sku: i.sku, quantity: i.quantity,
  }));
  const overdueRepairs = ((row.overdue_repairs as OR[]) ?? []).map((r) => ({
    id: r.id,
    repairNumber: r.repair_number ?? r.id.slice(-4).toUpperCase(),
    item: r.item_description || "Repair",
    customer: r.customer_name ?? null,
    daysOverdue: r.days_overdue,
  }));
  const readyForPickup = ((row.ready_for_pickup as RF[]) ?? []).map((r) => ({
    id: r.id,
    number: r.number ?? r.id.slice(-4).toUpperCase(),
    label: r.label,
    customer: r.customer_name ?? null,
    type: r.type,
  }));
  const activeRepairs = ((row.active_repairs_list as AR[]) ?? []).map((r) => ({
    id: r.id,
    customer: r.customer_name ?? null,
    item: r.item || "Repair",
    stage: r.stage,
    due_date: r.due_date,
  }));
  const activeBespokeJobs = ((row.active_bespoke_list as AB[]) ?? []).map((j) => ({
    id: j.id,
    customer: j.customer_name ?? null,
    title: j.title || "Untitled Job",
    stage: j.stage,
    due_date: j.due_date,
  }));
  const recentSales = ((row.recent_sales as RS[]) ?? []).map((s) => ({
    id: s.id,
    saleNumber: s.sale_number ?? s.id.slice(-4).toUpperCase(),
    customer: s.customer_name ?? null,
  }));
  const recentRepairsList = ((row.recent_repairs_list as RR[]) ?? []).map((r) => ({
    id: r.id,
    repairNumber: r.repair_number ?? r.id.slice(-4).toUpperCase(),
    customer: r.customer_name ?? null,
  }));

  return {
    salesThisMonthRevenue: Number(row.sales_this_month_revenue) || 0,
    salesThisMonthCount: row.sales_this_month_count as number,
    activeRepairsCount: row.active_repairs_count as number,
    activeJobsCount: row.active_jobs_count as number,
    totalOutstanding: Number(row.total_outstanding) || 0,
    overdueInvoiceCount: row.overdue_invoice_count as number,
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
    revenueSparkline: (row.revenue_sparkline as { value: number }[]) ?? [],
    salesCountSparkline: (row.sales_count_sparkline as { value: number }[]) ?? [],
    repairsSparkline: (row.repairs_sparkline as { value: number }[]) ?? [],
    customersSparkline: (row.customers_sparkline as { value: number }[]) ?? [],
    salesBarData: (row.sales_bar_data as { day: string; sales: number; revenue: number }[]) ?? [],
    repairStageData: (row.repair_stage_data as { name: string; value: number }[]) ?? [],
  };
}

/**
 * Fire-and-forget async refresh of the precomputed stats row. Called via
 * `after()` post-response so it doesn't block the user, and from write
 * paths (sales/invoices/repairs/bespoke actions) that want fresh reads
 * for the next dashboard visit.
 */
export async function refreshDashboardStatsAsync(tenantId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("refresh_tenant_dashboard_stats", { p_tenant_id: tenantId });
  } catch (err) {
    logger.warn("[dashboard] refresh_tenant_dashboard_stats failed (non-fatal)", {
      tenantId,
      err: (err as Error).message,
    });
  }
}

async function fetchDashboardStats(
  userId: string,
  tenantId: string,
  isManager: boolean,
  locationIds: string[] | null
): Promise<DashboardStatsData> {
  const admin = createAdminClient();

  // Use the shared tenant-meta cache instead of a fresh query every call
  const { timezone: tz } = await getTenantMeta(tenantId);

  // Calculate dates in tenant's local timezone
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  
  const localDateParts = new Intl.DateTimeFormat("en-CA", { 
    timeZone: tz, 
    year: "numeric", 
    month: "2-digit" 
  }).formatToParts(now);
  const year = localDateParts.find(p => p.type === "year")?.value ?? now.getFullYear().toString();
  const month = localDateParts.find(p => p.type === "month")?.value ?? "01";
  const monthStartStr = `${year}-${month}-01T00:00:00.000Z`;
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch locations for name lookup
  const showLocationNames = !locationIds || locationIds.length > 1;
  let locationMap = new Map<string, string>();
  if (showLocationNames) {
    const locations = await getCached(
      tenantCacheKey(tenantId, "locations"),
      async () => {
        const { data } = await admin
          .from("locations")
          .select("id, name")
          .eq("tenant_id", tenantId);
        return data ?? [];
      },
      300 // 5 minute cache for location names
    );
    for (const loc of locations) {
      locationMap.set(loc.id, loc.name);
    }
  }

  // Helper to add location filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addLocFilter = <T extends any>(q: T): T => {
    if (!locationIds || locationIds.length === 0) return q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = q as any;
    return locationIds.length === 1 
      ? query.eq("location_id", locationIds[0]) 
      : query.in("location_id", locationIds);
  };

  // ── Parallel fetch — all queries at once ─────────────────────
  const [
    salesResult,
    outstandingResult,
    overdueCountResult,
    activeJobsResult,
    activeRepairsResult,
    overdueRepairsResult,
    lowStockResult,
    readyRepairsResult,
    readyBespokeResult,
    activeRepairsListResult,
    activeBespokeListResult,
    recentJobsResult,
    recentRepairsResult,
    allTasksResult,
    recentSalesResult,
    recentRepairsListResult,
    sales7dResult,
    repairs7dResult,
    customers7dResult,
    repairStagesResult,
  ] = await Promise.all([
    // 1. Sales this month
    addLocFilter(admin
      .from("sales")
      .select("total")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStartStr)),

    // 2. Outstanding invoices
    addLocFilter(admin
      .from("invoices")
      .select("id, amount_due")
      .eq("tenant_id", tenantId)
      .in("status", ["partial", "unpaid", "overdue"])
      .is("deleted_at", null)
      .limit(100)),

    // 3. Overdue invoice count
    addLocFilter(admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("status", "in", '("paid","voided","draft","cancelled")')
      .lt("due_date", today)
      .is("deleted_at", null)),

    // 4. Active bespoke count
    addLocFilter(admin
      .from("bespoke_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("completed","cancelled")')),

    // 5. Active repair count
    addLocFilter(admin
      .from("repairs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","cancelled")')),

    // 6. Overdue repairs
    addLocFilter(admin
      .from("repairs")
      .select("id, repair_number, item_description, due_date, location_id, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","cancelled")')
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5)),

    // 7. Low stock
    addLocFilter(admin
      .from("inventory")
      .select("id, name, sku, quantity, low_stock_threshold")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .eq("track_quantity", true)
      .order("quantity", { ascending: true })
      .limit(50)),

    // 8. Ready repairs
    addLocFilter(admin
      .from("repairs")
      .select("id, repair_number, item_description, location_id, customers(full_name)")
      .eq("tenant_id", tenantId)
      .eq("stage", "ready")
      .is("deleted_at", null)
      .limit(5)),

    // 9. Ready bespoke
    addLocFilter(admin
      .from("bespoke_jobs")
      .select("id, job_number, title, location_id, customers(full_name)")
      .eq("tenant_id", tenantId)
      .eq("stage", "ready")
      .is("deleted_at", null)
      .limit(5)),

    // 10. Active repairs list
    addLocFilter(admin
      .from("repairs")
      .select("id, item_description, stage, due_date, location_id, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","cancelled")')
      .order("due_date", { ascending: true })
      .limit(5)),

    // 11. Active bespoke list
    addLocFilter(admin
      .from("bespoke_jobs")
      .select("id, title, stage, due_date, location_id, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("completed","cancelled")')
      .order("due_date", { ascending: true })
      .limit(5)),

    // 12. Recent bespoke jobs
    addLocFilter(admin
      .from("bespoke_jobs")
      .select("id, title, stage, updated_at, location_id, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5)),

    // 13. Recent repairs
    addLocFilter(admin
      .from("repairs")
      .select("id, item_description, stage, updated_at, location_id, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5)),

    // 14. Tasks due today
    (async () => {
      let q = admin
        .from("tasks")
        .select("id, title, priority, status, due_date, assigned_to")
        .eq("tenant_id", tenantId)
        .neq("status", "completed")
        .eq("due_date", today)
        .order("priority", { ascending: false })
        .limit(50);
      if (!isManager) q = q.eq("assigned_to", userId);
      return q;
    })(),
    
    // 15. Recent sales
    addLocFilter(admin
      .from("sales")
      .select("id, sale_number, customers(full_name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5)),

    // 16. Recent repairs list
    addLocFilter(admin
      .from("repairs")
      .select("id, repair_number, customers(full_name)")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5)),

    // 17. Sales last 7 days
    addLocFilter(admin
      .from("sales")
      .select("created_at, total")
      .eq("tenant_id", tenantId)
      .gte("created_at", sevenDaysAgo)),

    // 18. Repairs created last 7 days
    addLocFilter(admin
      .from("repairs")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", sevenDaysAgo)),

    // 19. Customers created last 7 days
    admin
      .from("customers")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", sevenDaysAgo),

    // 20. Repair stage breakdown
    addLocFilter(admin
      .from("repairs")
      .select("stage")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","cancelled")')),
  ]);

  // ── Derive values ─────────────────────────────────────────────────────────────

  const salesThisMonthRevenue = (salesResult.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
  const salesThisMonthCount = (salesResult.data ?? []).length;

  const totalOutstanding = (outstandingResult.data ?? []).reduce(
    (sum, inv) => sum + Math.max(0, Number(inv.amount_due) || 0),
    0
  );

  const overdueInvoiceCount = overdueCountResult.count ?? 0;
  const activeJobsCount = activeJobsResult.count ?? 0;
  const activeRepairsCount = activeRepairsResult.count ?? 0;

  const overdueRepairs = (overdueRepairsResult.data ?? []).map((r) => {
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
      locationName: showLocationNames && r.location_id ? locationMap.get(r.location_id) : undefined,
    };
  });

  // Dedupe low stock by SKU
  const seenSkus = new Set<string>();
  const lowStockItems = (lowStockResult.data ?? [])
    .filter((i) => {
      const qty = i.quantity ?? 0;
      const threshold = i.low_stock_threshold ?? 1;
      if (qty > threshold) return false;
      const key = i.sku ?? i.id;
      if (seenSkus.has(key)) return false;
      seenSkus.add(key);
      return true;
    })
    .slice(0, 10)
    .map((i) => ({ id: i.id, name: i.name, sku: i.sku ?? null, quantity: i.quantity }));

  const readyRepairs = (readyRepairsResult.data ?? []).map((r) => ({
    id: r.id,
    number: r.repair_number ?? r.id.slice(-4).toUpperCase(),
    label: r.item_description || "Repair",
    customer: Array.isArray(r.customers)
      ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
    type: "repair" as const,
    locationName: showLocationNames && r.location_id ? locationMap.get(r.location_id) : undefined,
  }));

  const readyBespokeJobs = (readyBespokeResult.data ?? []).map((j) => ({
    id: j.id,
    number: j.job_number ?? j.id.slice(-4).toUpperCase(),
    label: j.title || "Bespoke Job",
    customer: Array.isArray(j.customers)
      ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
    type: "bespoke" as const,
    locationName: showLocationNames && j.location_id ? locationMap.get(j.location_id) : undefined,
  }));

  const readyForPickup = [...readyRepairs, ...readyBespokeJobs];

  const activeRepairs = (activeRepairsListResult.data ?? []).map((r) => ({
    id: r.id,
    customer: Array.isArray(r.customers)
      ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
    item: r.item_description || "Repair",
    stage: r.stage || "intake",
    due_date: r.due_date,
    locationName: showLocationNames && r.location_id ? locationMap.get(r.location_id) : undefined,
  }));

  const activeBespokeJobs = (activeBespokeListResult.data ?? []).map((j) => ({
    id: j.id,
    customer: Array.isArray(j.customers)
      ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
    title: j.title || "Untitled Job",
    stage: j.stage || "enquiry",
    due_date: j.due_date,
    locationName: showLocationNames && j.location_id ? locationMap.get(j.location_id) : undefined,
  }));

  type ActivityItem = {
    id: string;
    title: string;
    stage: string;
    customerName: string | null;
    updatedAt: string;
    type: "job" | "repair";
    href: string;
    locationName?: string;
  };

  const recentActivity: ActivityItem[] = [
    ...(recentJobsResult.data ?? []).map((j) => ({
      id: j.id,
      title: j.title || "Untitled Job",
      stage: j.stage || "enquiry",
      customerName: Array.isArray(j.customers)
        ? (j.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (j.customers as { full_name: string | null } | null)?.full_name ?? null,
      updatedAt: j.updated_at,
      type: "job" as const,
      href: `/bespoke/${j.id}`,
      locationName: showLocationNames && j.location_id ? locationMap.get(j.location_id) : undefined,
    })),
    ...(recentRepairsResult.data ?? []).map((r) => ({
      id: r.id,
      title: r.item_description || "Repair",
      stage: r.stage || "intake",
      customerName: Array.isArray(r.customers)
        ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
        : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
      updatedAt: r.updated_at,
      type: "repair" as const,
      href: `/repairs/${r.id}`,
      locationName: showLocationNames && r.location_id ? locationMap.get(r.location_id) : undefined,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const allTasks = allTasksResult.data ?? [];
  const myTasks = allTasks
    .filter((t) => t.assigned_to === userId || t.assigned_to === null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      due_date: t.due_date,
    }));

  type TeamTaskSummary = { assigneeId: string; assigneeName: string; taskCount: number; overdueCount: number };
  const teamTaskSummary: TeamTaskSummary[] = [];
  if (isManager) {
    const byAssignee = new Map<string, { count: number }>();
    for (const t of allTasks) {
      if (!t.assigned_to || t.assigned_to === userId) continue;
      const existing = byAssignee.get(t.assigned_to);
      if (existing) {
        existing.count++;
      } else {
        byAssignee.set(t.assigned_to, { count: 1 });
      }
    }
    for (const [id, data] of byAssignee) {
      teamTaskSummary.push({ assigneeId: id, assigneeName: "Unknown", taskCount: data.count, overdueCount: 0 });
    }
  }

  // ── Sparkline data processing ─────────────────────────────────────────────
  const last7Days = getLast7Days(tz);

  // Revenue sparkline
  const revByDay = new Map<string, number>();
  for (const d of last7Days) revByDay.set(d, 0);
  for (const s of sales7dResult.data ?? []) {
    const day = s.created_at.split("T")[0];
    if (revByDay.has(day)) revByDay.set(day, (revByDay.get(day) ?? 0) + (s.total ?? 0));
  }
  const revenueSparkline = last7Days.map((d) => ({ value: revByDay.get(d) ?? 0 }));

  // Sales count sparkline
  const salesByDay = new Map<string, number>();
  for (const d of last7Days) salesByDay.set(d, 0);
  for (const s of sales7dResult.data ?? []) {
    const day = s.created_at.split("T")[0];
    if (salesByDay.has(day)) salesByDay.set(day, (salesByDay.get(day) ?? 0) + 1);
  }
  const salesCountSparkline = last7Days.map((d) => ({ value: salesByDay.get(d) ?? 0 }));

  // Repairs sparkline
  const repairsByDay = new Map<string, number>();
  for (const d of last7Days) repairsByDay.set(d, 0);
  for (const r of repairs7dResult.data ?? []) {
    const day = r.created_at.split("T")[0];
    if (repairsByDay.has(day)) repairsByDay.set(day, (repairsByDay.get(day) ?? 0) + 1);
  }
  const repairsSparkline = last7Days.map((d) => ({ value: repairsByDay.get(d) ?? 0 }));

  // Customers sparkline
  const customersByDay = new Map<string, number>();
  for (const d of last7Days) customersByDay.set(d, 0);
  for (const c of customers7dResult.data ?? []) {
    const day = c.created_at.split("T")[0];
    if (customersByDay.has(day)) customersByDay.set(day, (customersByDay.get(day) ?? 0) + 1);
  }
  const customersSparkline = last7Days.map((d) => ({ value: customersByDay.get(d) ?? 0 }));

  // Bar chart: Sales by day (last 7 days)
  const salesBarData = last7Days.map((d) => ({
    day: new Date(d + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" }),
    sales: salesByDay.get(d) ?? 0,
    revenue: Math.round(revByDay.get(d) ?? 0),
  }));

  // Repair stage pie data
  const stageMap = new Map<string, number>();
  for (const r of repairStagesResult.data ?? []) {
    stageMap.set(r.stage, (stageMap.get(r.stage) ?? 0) + 1);
  }
  const repairStageData = Array.from(stageMap.entries()).map(([stage, count]) => ({
    name: stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: count,
  }));

  const recentSales = (recentSalesResult.data ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    saleNumber: (s.sale_number as string) ?? (s.id as string).slice(-4).toUpperCase(),
    customer: Array.isArray(s.customers)
      ? (s.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (s.customers as { full_name: string | null } | null)?.full_name ?? null,
  }));

  const recentRepairsList = (recentRepairsListResult.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    repairNumber: (r.repair_number as string) ?? (r.id as string).slice(-4).toUpperCase(),
    customer: Array.isArray(r.customers)
      ? (r.customers[0] as { full_name: string | null } | null)?.full_name ?? null
      : (r.customers as { full_name: string | null } | null)?.full_name ?? null,
  }));

  return {
    salesThisMonthRevenue,
    salesThisMonthCount,
    activeRepairsCount,
    activeJobsCount,
    totalOutstanding,
    overdueInvoiceCount,
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
    revenueSparkline,
    salesCountSparkline,
    repairsSparkline,
    customersSparkline,
    salesBarData,
    repairStageData,
  };
}

// ────────────────────────────────────────────────────────────────
// Legacy Combined Fetcher (for backward compatibility)
// ────────────────────────────────────────────────────────────────

export async function getDashboardData(locationIds: string[] | null): Promise<DashboardData> {
  const [critical, stats] = await Promise.all([
    getDashboardCriticalData(),
    getDashboardStats(locationIds),
  ]);

  return { ...critical, ...stats };
}
