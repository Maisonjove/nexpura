"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";

// React cache to dedupe auth context within same render
const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role, tenants(name, currency, tax_rate, tax_name)")
    .eq("id", user.id)
    .single();
  if (!userData?.tenant_id) throw new Error("No tenant");
  const tenantData = userData?.tenants as { name?: string; currency?: string; tax_rate?: number; tax_name?: string } | null;
  const userRole = (userData as { role?: string } | null)?.role ?? "staff";
  return { 
    userId: user.id,
    tenantId: userData.tenant_id as string,
    tenantName: tenantData?.name ?? null,
    currency: tenantData?.currency || "AUD",
    userRole,
    isManager: userRole === "owner" || userRole === "manager"
  };
});

// Revalidate dashboard cache - call this after mutations
export async function revalidateDashboardCache() {
  revalidateTag("dashboard", "default");
}

// Helper to apply location filter to queries
function applyLocationFilter<T extends { eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T }>(
  query: T, 
  locationIds: string[] | null
): T {
  if (!locationIds || locationIds.length === 0) {
    // No filter - return all
    return query;
  }
  if (locationIds.length === 1) {
    return query.eq("location_id", locationIds[0]);
  }
  return query.in("location_id", locationIds);
}

export interface DashboardData {
  firstName: string;
  tenantName: string | null;
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
  isManager: boolean;
  activeRepairs: Array<{ id: string; customer: string | null; item: string; stage: string; due_date: string | null; locationName?: string }>;
  activeBespokeJobs: Array<{ id: string; customer: string | null; title: string; stage: string; due_date: string | null; locationName?: string }>;
  currency: string;
  revenueSparkline: Array<{ value: number }>;
  salesCountSparkline: Array<{ value: number }>;
  repairsSparkline: Array<{ value: number }>;
  customersSparkline: Array<{ value: number }>;
  salesBarData: Array<{ day: string; sales: number; revenue: number }>;
  repairStageData: Array<{ name: string; value: number }>;
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

// Empty dashboard data for new tenants (fast path)
function getEmptyDashboardData(
  firstName: string,
  tenantName: string | null,
  currency: string,
  isManager: boolean
): DashboardData {
  return {
    firstName,
    tenantName,
    salesThisMonthRevenue: 0,
    salesThisMonthCount: 0,
    activeRepairsCount: 0,
    activeJobsCount: 0,
    totalOutstanding: 0,
    overdueInvoiceCount: 0,
    lowStockItems: [],
    overdueRepairs: [],
    readyForPickup: [],
    recentActivity: [],
    myTasks: [],
    teamTaskSummary: [],
    isManager,
    activeRepairs: [],
    activeBespokeJobs: [],
    currency,
    revenueSparkline: Array(7).fill({ value: 0 }),
    salesCountSparkline: Array(7).fill({ value: 0 }),
    repairsSparkline: Array(7).fill({ value: 0 }),
    customersSparkline: Array(7).fill({ value: 0 }),
    salesBarData: [],
    repairStageData: [],
  };
}

// Internal function that does the actual data fetching - this gets cached
async function getDashboardDataInternal(
  userId: string,
  tenantId: string,
  tenantName: string | null,
  currency: string,
  isManager: boolean,
  locationIds: string[] | null
): Promise<DashboardData> {
  const admin = createAdminClient();

  const firstName = tenantName || "there";
  const today = new Date().toISOString().split("T")[0];
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Quick parallel check: does this tenant have any data at all?
  // These run in parallel to minimize latency
  const [salesCheck, repairsCheck] = await Promise.all([
    admin.from("sales").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).limit(1),
    admin.from("repairs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).limit(1),
  ]);

  const salesCount = salesCheck.count ?? 0;
  const repairsCount = repairsCheck.count ?? 0;

  // If tenant has no sales AND no repairs, return empty dashboard fast
  if (salesCount === 0 && repairsCount === 0) {
    return getEmptyDashboardData(firstName, tenantName, currency, isManager);
  }

  // Fetch locations for name lookup if we're showing all locations
  const showLocationNames = !locationIds || locationIds.length > 1;
  const locationMap: Map<string, string> = new Map();
  if (showLocationNames) {
    const { data: locations } = await admin
      .from("locations")
      .select("id, name")
      .eq("tenant_id", tenantId);
    for (const loc of locations ?? []) {
      locationMap.set(loc.id, loc.name);
    }
  }

  // Build base queries with location filtering
  // Helper to build filtered query
  const buildQuery = (table: string, locationColumn = "location_id") => {
    const q = admin.from(table);
    return q;
  };

  // ── Parallel fetch — all 18 independent queries at once ─────────────────────
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
    sales7dResult,
    repairs7dResult,
    customers7dResult,
    repairStagesResult,
  ] = await Promise.all([
    // 1. Sales this month
    (async () => {
      let q = admin
        .from("sales")
        .select("total, location_id")
        .eq("tenant_id", tenantId)
        .gte("created_at", monthStartStr);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 2. Outstanding invoices
    (async () => {
      let q = admin
        .from("invoices")
        .select("id, invoice_number, total, amount_paid, due_date, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .in("status", ["partial", "unpaid", "overdue"])
        .is("deleted_at", null)
        .order("due_date", { ascending: true })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 3. Overdue invoice count
    (async () => {
      let q = admin
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("status", "in", '("paid","voided","draft","cancelled")')
        .lt("due_date", today)
        .is("deleted_at", null);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 4. Active bespoke count
    (async () => {
      let q = admin
        .from("bespoke_jobs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("completed","cancelled")');
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 5. Active repair count
    (async () => {
      let q = admin
        .from("repairs")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("collected","cancelled")');
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 6. Overdue repairs detail
    (async () => {
      let q = admin
        .from("repairs")
        .select("id, repair_number, item_description, due_date, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("collected","cancelled")')
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 7. Low stock — fetch only items with quantity under threshold (max 50)
    (async () => {
      let q = admin
        .from("inventory")
        .select("id, name, sku, quantity, low_stock_threshold, track_quantity, location_id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .is("deleted_at", null)
        .eq("track_quantity", true)
        .order("quantity", { ascending: true })
        .limit(50);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 8. Ready repairs
    (async () => {
      let q = admin
        .from("repairs")
        .select("id, repair_number, item_description, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .eq("stage", "ready")
        .is("deleted_at", null)
        .order("updated_at", { ascending: true })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 9. Ready bespoke
    (async () => {
      let q = admin
        .from("bespoke_jobs")
        .select("id, job_number, title, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .eq("stage", "ready")
        .is("deleted_at", null)
        .order("updated_at", { ascending: true })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 10. Active repairs list
    (async () => {
      let q = admin
        .from("repairs")
        .select("id, item_description, stage, due_date, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("collected","cancelled")')
        .order("due_date", { ascending: true })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 11. Active bespoke list
    (async () => {
      let q = admin
        .from("bespoke_jobs")
        .select("id, title, stage, due_date, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("completed","cancelled")')
        .order("due_date", { ascending: true })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 12. Recent bespoke jobs
    (async () => {
      let q = admin
        .from("bespoke_jobs")
        .select("id, title, stage, updated_at, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 13. Recent repairs
    (async () => {
      let q = admin
        .from("repairs")
        .select("id, item_description, stage, updated_at, location_id, customers(full_name)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

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
    
    // 15. Sales last 7 days (for sparklines)
    (async () => {
      let q = admin
        .from("sales")
        .select("created_at, total, location_id")
        .eq("tenant_id", tenantId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 16. Repairs created last 7 days (for sparklines)
    (async () => {
      let q = admin
        .from("repairs")
        .select("created_at, location_id")
        .eq("tenant_id", tenantId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),

    // 17. Customers created last 7 days (for sparklines)
    admin
      .from("customers")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

    // 18. Repair stage breakdown (for pie chart)
    (async () => {
      let q = admin
        .from("repairs")
        .select("stage, location_id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .not("stage", "in", '("collected","cancelled")');
      if (locationIds && locationIds.length > 0) {
        q = locationIds.length === 1 
          ? q.eq("location_id", locationIds[0])
          : q.in("location_id", locationIds);
      }
      return q;
    })(),
  ]);

  // ── Derive values ─────────────────────────────────────────────────────────────

  const salesThisMonthRevenue = (salesResult.data ?? []).reduce((s, r) => s + (r.total || 0), 0);
  const salesThisMonthCount = (salesResult.data ?? []).length;

  const outstandingData = outstandingResult.data ?? [];
  const totalOutstanding = outstandingData.reduce(
    (sum, inv) => sum + Math.max(0, (inv.total || 0) - (inv.amount_paid || 0)),
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

  const _seenSkus = new Map<string, (typeof lowStockResult.data extends (infer T)[] | null ? T : never)>();
  for (const item of lowStockResult.data ?? []) {
    const key = item.sku ?? item.id;
    if (!_seenSkus.has(key)) _seenSkus.set(key, item);
  }
  const lowStockItems = Array.from(_seenSkus.values())
    .filter((i) => i.quantity <= (i.low_stock_threshold ?? 1))
    .sort((a, b) => a.quantity - b.quantity)
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
    const byAssignee = new Map<string, { name: string; count: number; overdue: number }>();
    for (const t of allTasks) {
      if (!t.assigned_to || t.assigned_to === userId) continue;
      const existing = byAssignee.get(t.assigned_to);
      if (existing) {
        existing.count++;
      } else {
        byAssignee.set(t.assigned_to, { name: "Unknown", count: 1, overdue: 0 });
      }
    }
    for (const [id, data] of byAssignee) {
      teamTaskSummary.push({ assigneeId: id, assigneeName: data.name, taskCount: data.count, overdueCount: data.overdue });
    }
  }

  // ── Sparkline data processing ─────────────────────────────────────────────
  const last7Days = getLast7Days();

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

  return {
    firstName,
    tenantName,
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
    isManager,
    activeRepairs,
    activeBespokeJobs,
    currency,
    revenueSparkline,
    salesCountSparkline,
    repairsSparkline,
    customersSparkline,
    salesBarData,
    repairStageData,
  };
}

// Create cached version of the internal function
// Cache key includes tenantId, userId, and locationIds for proper isolation
const getCachedDashboardData = (
  tenantId: string,
  userId: string,
  locationKey: string
) => {
  return unstable_cache(
    async (
      uid: string,
      tid: string,
      tName: string | null,
      curr: string,
      isMgr: boolean,
      locIds: string[] | null
    ) => getDashboardDataInternal(uid, tid, tName, curr, isMgr, locIds),
    ["dashboard-data", tenantId, userId, locationKey],
    {
      revalidate: 60, // Cache for 60 seconds
      tags: ["dashboard", `dashboard-${tenantId}`],
    }
  );
};

// Public function that handles auth and calls cached internal function
export async function getDashboardData(locationIds: string[] | null): Promise<DashboardData> {
  const { userId, tenantId, tenantName, currency, isManager } = await getAuthContext();
  
  // Create a stable location key for caching
  const locationKey = locationIds ? locationIds.sort().join(",") : "all";
  
  // Get the cached function for this tenant/user/location combination
  const cachedFn = getCachedDashboardData(tenantId, userId, locationKey);
  
  // Call the cached function
  return cachedFn(userId, tenantId, tenantName, currency, isManager, locationIds);
}
