import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import WorkshopJobsClient, { type UnifiedJob } from "./WorkshopJobsClient";
import {
  type StatusFilter,
  type TypeFilter,
  STATUS_FILTERS,
  TYPE_FILTERS,
} from "./constants";

// W4-WORKSHOP-JOBS: unified status-filtered view across repairs +
// bespoke_jobs + appraisals. Replaces the broken `?status=...` routes
// referenced in Kaitlyn's redesign brief (Section 4 + 4.2-4.5 + 13.1).
// `/repairs` and `/bespoke` and `/workshop` keep their own pages — this
// page is additive.

export const metadata = { title: "Workshop Jobs — Nexpura" };

// Stage groupings used to translate status filters into per-table predicates.
// Keep in sync with the CHECK constraints in
// supabase/migrations/20260421_stage_check_constraints.sql.
const REPAIR_TERMINAL = ["collected", "picked_up", "completed", "cancelled"];
const BESPOKE_TERMINAL = ["collected", "delivered", "completed", "cancelled"];
// Format string values for PostgREST `.not("col","in", "(...)")` calls.
// Without the surrounding quotes the values get interpreted as
// identifiers, which throws on the Supabase side. Mirrors the pattern
// used in /invoices/page.tsx.
const quoteForIn = (vals: readonly string[]) =>
  `(${vals.map((v) => `"${v}"`).join(",")})`;
// "ready" is the pickup-ready stage for both tables.
const READY_REPAIR = ["ready"];
const READY_BESPOKE = ["ready"];

function isStatusFilter(v: string | undefined): v is StatusFilter {
  return !!v && (STATUS_FILTERS as readonly string[]).includes(v);
}
function isTypeFilter(v: string | undefined): v is TypeFilter {
  return !!v && (TYPE_FILTERS as readonly string[]).includes(v);
}

export default function WorkshopJobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    filter?: string;
  }>;
}) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Static shell — streamed in the first HTML chunk so the title and
          primary action are visible before the body resolves. Same pattern
          as /repairs/page.tsx. */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-[11px] tracking-[0.12em] uppercase text-nexpura-taupe-400">
            Workshop
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 mt-1">
            Jobs
          </h1>
        </div>
        <Link
          href="/repairs/new"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700 h-10 px-4 py-2"
        >
          <Plus className="w-4 h-4 mr-2" /> New Job
        </Link>
      </div>

      <Suspense fallback={<WorkshopJobsSkeleton />}>
        <WorkshopJobsBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WorkshopJobsBody({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const status: StatusFilter = isStatusFilter(params.status)
    ? params.status
    : "active";
  const typeFilter: TypeFilter = isTypeFilter(params.type) ? params.type : "all";
  const subFilter = params.filter ?? "all";

  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  const tenantId = auth.tenantId;

  // Permission: only show what the caller can already see on the
  // single-source pages. If they have NONE of view_repairs / view_bespoke
  // / view_appraisals, treat it as access denied.
  const canRepairs = auth.permissions.view_repairs ?? false;
  const canBespoke = auth.permissions.view_bespoke ?? false;
  // Appraisals don't have a dedicated permission key in
  // src/lib/permissions.ts yet; gate them behind the workshop-side
  // permissions (view_repairs OR view_bespoke) so anyone allowed to see
  // workshop work can also see appraisals. Owners always see everything.
  const canAppraisals = auth.isOwner || canRepairs || canBespoke;

  if (!canRepairs && !canBespoke && !canAppraisals) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">
          You don&apos;t have permission to view workshop jobs.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const today = new Date();
  const todayIso = today.toISOString().split("T")[0]!;

  // Apply table-level status predicates so we don't pull terminal rows we
  // don't need. Final filtering (including overdue) happens in JS to keep
  // the predicate logic readable and to share between repair/bespoke/
  // appraisal sources whose schemas differ.

  const wantRepairs =
    canRepairs && (typeFilter === "all" || typeFilter === "repair");
  const wantBespoke =
    canBespoke && (typeFilter === "all" || typeFilter === "bespoke");
  const wantAppraisals =
    canAppraisals && (typeFilter === "all" || typeFilter === "appraisal");

  const repairsPromise = wantRepairs
    ? (() => {
        let q = admin
          .from("repairs")
          .select(
            `id, repair_number, item_type, item_description, repair_type, stage, priority, due_date, created_at, updated_at, deposit_amount, quoted_price, final_price,
             customers(id, full_name)`,
          )
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);
        if (status === "active" || status === "overdue") {
          q = q.not("stage", "in", quoteForIn(REPAIR_TERMINAL.concat(READY_REPAIR)));
        } else if (status === "ready-for-pickup") {
          q = q.in("stage", READY_REPAIR);
        } else if (status === "completed") {
          q = q.in("stage", REPAIR_TERMINAL);
        }
        return q.order("due_date", { ascending: true, nullsFirst: false }).limit(500);
      })()
    : Promise.resolve({ data: [] as unknown[] });

  const bespokePromise = wantBespoke
    ? (() => {
        let q = admin
          .from("bespoke_jobs")
          .select(
            `id, job_number, title, stage, priority, due_date, created_at, updated_at, deposit_amount, quoted_price, final_price,
             customers(id, full_name)`,
          )
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);
        if (status === "active" || status === "overdue") {
          q = q.not("stage", "in", quoteForIn(BESPOKE_TERMINAL.concat(READY_BESPOKE)));
        } else if (status === "ready-for-pickup") {
          q = q.in("stage", READY_BESPOKE);
        } else if (status === "completed") {
          q = q.in("stage", BESPOKE_TERMINAL);
        }
        return q.order("due_date", { ascending: true, nullsFirst: false }).limit(500);
      })()
    : Promise.resolve({ data: [] as unknown[] });

  const appraisalsPromise = wantAppraisals
    ? (() => {
        let q = admin
          .from("appraisals")
          .select(
            `id, appraisal_number, item_name, status, customer_id, customer_name, fee, appraisal_date, valid_until, created_at, updated_at, appraisal_type,
             customers(id, full_name)`,
          )
          .eq("tenant_id", tenantId);
        if (status === "active" || status === "overdue") {
          q = q.in("status", ["draft", "in_progress"]);
        } else if (status === "ready-for-pickup") {
          q = q.eq("status", "completed");
        } else if (status === "completed") {
          q = q.eq("status", "issued");
        }
        return q.order("created_at", { ascending: false }).limit(500);
      })()
    : Promise.resolve({ data: [] as unknown[] });

  // Resilient — degrade per-source on error so one failing query
  // (RLS/policy/schema drift) doesn't take down the whole page.
  const settled = await Promise.allSettled([
    repairsPromise,
    bespokePromise,
    appraisalsPromise,
  ]);
  const safeRes = (i: number): { data: unknown[] | null; error?: unknown } => {
    const r = settled[i];
    if (r.status === "fulfilled") return r.value as { data: unknown[] | null };
    console.error(
      `[/workshop/jobs] query ${["repairs", "bespoke", "appraisals"][i]} failed:`,
      r.reason,
    );
    return { data: [], error: r.reason };
  };
  const repairsRes = safeRes(0);
  const bespokeRes = safeRes(1);
  const appraisalsRes = safeRes(2);

  type RawRepair = {
    id: string;
    repair_number: string | null;
    item_type: string | null;
    item_description: string | null;
    repair_type: string | null;
    stage: string;
    priority: string | null;
    due_date: string | null;
    created_at: string;
    updated_at: string | null;
    deposit_amount: number | null;
    quoted_price: number | null;
    final_price: number | null;
    customers:
      | { id: string; full_name: string | null }
      | { id: string; full_name: string | null }[]
      | null;
  };
  type RawBespoke = {
    id: string;
    job_number: string | null;
    title: string | null;
    stage: string;
    priority: string | null;
    due_date: string | null;
    created_at: string;
    updated_at: string | null;
    deposit_amount: number | null;
    quoted_price: number | null;
    final_price: number | null;
    customers:
      | { id: string; full_name: string | null }
      | { id: string; full_name: string | null }[]
      | null;
  };
  type RawAppraisal = {
    id: string;
    appraisal_number: string | null;
    item_name: string | null;
    status: string;
    customer_id: string | null;
    customer_name: string | null;
    fee: number | null;
    appraisal_date: string | null;
    valid_until: string | null;
    created_at: string;
    updated_at: string | null;
    appraisal_type: string | null;
    customers:
      | { id: string; full_name: string | null }
      | { id: string; full_name: string | null }[]
      | null;
  };

  // Assignee resolution removed — repairs/bespoke_jobs/appraisals don't
  // have an `assigned_to` column today. UnifiedJob.assignedName stays
  // `null` until that column lands, at which point reintroduce the
  // batch user-name lookup here.

  const flatCustomer = (
    c:
      | { id: string; full_name: string | null }
      | { id: string; full_name: string | null }[]
      | null,
  ) => (Array.isArray(c) ? c[0] ?? null : c);

  const repairsRaw = (repairsRes.data ?? []) as RawRepair[];
  const bespokeRaw = (bespokeRes.data ?? []) as RawBespoke[];
  const appraisalsRaw = (appraisalsRes.data ?? []) as RawAppraisal[];

  const repairJobs: UnifiedJob[] = repairsRaw.map((r) => {
    const cust = flatCustomer(r.customers);
    const balance =
      r.quoted_price != null && r.deposit_amount != null
        ? Math.max(r.quoted_price - r.deposit_amount, 0)
        : null;
    return {
      id: r.id,
      type: "repair",
      jobNumber: r.repair_number ?? r.id.slice(0, 8),
      customerName: cust?.full_name ?? "—",
      itemSummary: r.item_type
        ? `${r.item_type}${r.item_description ? ` — ${r.item_description}` : ""}`
        : r.item_description ?? "—",
      stage: r.stage,
      priority: r.priority ?? "normal",
      dueDate: r.due_date,
      assignedName: null,
      depositAmount: r.deposit_amount,
      balanceDue: balance,
      lastUpdate: r.updated_at ?? r.created_at,
      href: `/repairs/${r.id}`,
    };
  });

  const bespokeJobs: UnifiedJob[] = bespokeRaw.map((b) => {
    const cust = flatCustomer(b.customers);
    const balance =
      b.quoted_price != null && b.deposit_amount != null
        ? Math.max(b.quoted_price - b.deposit_amount, 0)
        : null;
    return {
      id: b.id,
      type: "bespoke",
      jobNumber: b.job_number ?? b.id.slice(0, 8),
      customerName: cust?.full_name ?? "—",
      itemSummary: b.title ?? "—",
      stage: b.stage,
      priority: b.priority ?? "normal",
      dueDate: b.due_date,
      assignedName: null,
      depositAmount: b.deposit_amount,
      balanceDue: balance,
      lastUpdate: b.updated_at ?? b.created_at,
      href: `/bespoke/${b.id}`,
    };
  });

  const appraisalJobs: UnifiedJob[] = appraisalsRaw.map((a) => {
    const cust = flatCustomer(a.customers);
    return {
      id: a.id,
      type: "appraisal",
      jobNumber: a.appraisal_number ?? a.id.slice(0, 8),
      customerName: cust?.full_name ?? a.customer_name ?? "—",
      itemSummary: a.item_name ?? "—",
      // Appraisals use `status` (draft/in_progress/completed/issued).
      // Surface it as the unified `stage` so the table renders one
      // status pill regardless of source.
      stage: a.status,
      priority: "normal",
      // Appraisals don't have a due_date column. `valid_until` is a
      // post-issue expiry, not a workshop SLA, so leaving null avoids
      // marking every appraisal "no due date" overdue. Empty cell is
      // honest about the schema.
      dueDate: null,
      assignedName: null,
      depositAmount: null,
      balanceDue: a.fee ?? null,
      lastUpdate: a.updated_at ?? a.created_at,
      href: `/appraisals`,
    };
  });

  // For the overdue filter: post-process once we have the merged stream
  // because appraisals have no due_date. Active stays as-is (the table
  // predicate already excluded terminal+ready stages).
  let combined = [...repairJobs, ...bespokeJobs, ...appraisalJobs];
  if (status === "overdue") {
    combined = combined.filter(
      (j) => j.dueDate != null && j.dueDate < todayIso,
    );
  }

  // Sort: overdue/active by due_date ascending (most overdue first),
  // ready/completed by lastUpdate descending.
  combined.sort((a, b) => {
    if (status === "active" || status === "overdue") {
      // Nulls last for active (a job without a due date isn't urgent),
      // nulls first for overdue (impossible — already filtered).
      const ad = a.dueDate ?? "9999-12-31";
      const bd = b.dueDate ?? "9999-12-31";
      return ad.localeCompare(bd);
    }
    return (b.lastUpdate ?? "").localeCompare(a.lastUpdate ?? "");
  });

  return (
    <WorkshopJobsClient
      jobs={combined}
      status={status}
      typeFilter={typeFilter}
      subFilter={subFilter}
      todayIso={todayIso}
    />
  );
}

function WorkshopJobsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI strip skeleton — 5 cells. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm p-4"
          >
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      {/* Filter chips skeleton. */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>
      {/* Table skeleton. */}
      <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-nexpura-taupe-100 text-[11px] font-medium uppercase tracking-[0.12em] text-nexpura-taupe-400">
          <Skeleton className="h-3 col-span-1" />
          <Skeleton className="h-3 col-span-2" />
          <Skeleton className="h-3 col-span-2" />
          <Skeleton className="h-3 col-span-1" />
          <Skeleton className="h-3 col-span-1" />
          <Skeleton className="h-3 col-span-1" />
          <Skeleton className="h-3 col-span-1" />
          <Skeleton className="h-3 col-span-1" />
          <Skeleton className="h-3 col-span-1" />
          <Skeleton className="h-3 col-span-1" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-3 px-6 py-3 border-b border-nexpura-taupe-100/60"
          >
            {Array.from({ length: 10 }).map((__, j) => (
              <Skeleton
                key={j}
                className={`h-4 ${j === 1 || j === 2 ? "col-span-2" : "col-span-1"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
