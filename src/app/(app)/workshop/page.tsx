import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import {
  Hammer,
  Wrench,
  Sparkles,
  ClipboardCheck,
  FilePlus,
  LayoutGrid,
  Gem,
  ShieldCheck,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth-context";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HubHeader,
  KpiCard,
  KpiStrip,
  QuickActionGroup,
  SectionPanel,
  HubEmptyState,
} from "@/components/hub/HubPrimitives";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Workshop — Nexpura" };

/**
 * Workshop Hub — Section 4.1 of Kaitlyn's 2026-05-02 redesign brief.
 *
 *   1. HubHeader (H1 + subtitle + "New repair" / "Bespoke job" CTAs)
 *   2. Status pill chips → /workshop/jobs?status=...
 *   3. KPI strip (active / overdue / due-this-week / ready-for-pickup /
 *      bespoke-in-production / appraisals-pending)
 *   4. Quick actions (CREATE / MANAGE / DOCUMENTATION)
 *   5. Recent activity panel (last 6 repairs/bespoke updates)
 *
 * All counts are tenant-scoped via getAuthContext + createAdminClient.
 */
export default function WorkshopPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <WorkshopBody />
    </Suspense>
  );
}

async function WorkshopBody() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  const tenantId = auth.tenantId;

  return (
    <div className="space-y-7 max-w-[1400px]">
      <HubHeader
        title="Workshop"
        subtitle="Manage repairs, bespoke commissions, appraisals and item passports."
        ctas={[
          { label: "New repair", href: "/repairs/new", variant: "primary", icon: Wrench },
          { label: "Bespoke job", href: "/bespoke/new", variant: "bronze", icon: Sparkles },
        ]}
      />

      <Suspense key={`status:${tenantId}`} fallback={<StatusPillsSkeleton />}>
        <WorkshopStatusPills tenantId={tenantId} />
      </Suspense>

      <Suspense key={`kpis:${tenantId}`} fallback={<KpiStripSkeleton />}>
        <WorkshopKpis tenantId={tenantId} />
      </Suspense>

      <div className="space-y-6">
        <QuickActionGroup
          label="Create"
          actions={[
            {
              label: "New repair",
              description: "Log a repair with intake details, customer and due date.",
              href: "/repairs/new",
              icon: Wrench,
            },
            {
              label: "Bespoke job",
              description: "Start a custom commission with deposit, design notes and stages.",
              href: "/bespoke/new",
              icon: Sparkles,
            },
            {
              label: "New appraisal",
              description: "Open an appraisal record for valuation or insurance.",
              href: "/appraisals/new",
              icon: ClipboardCheck,
            },
          ]}
        />

        <QuickActionGroup
          label="Manage"
          actions={[
            {
              label: "All repairs",
              description: "Every repair with stage, customer and due date.",
              href: "/repairs",
              icon: Wrench,
            },
            {
              label: "All bespoke jobs",
              description: "Custom commissions in production or completed.",
              href: "/bespoke",
              icon: Sparkles,
            },
            {
              label: "Workshop jobs",
              description: "Unified view across repairs, bespoke and appraisals with filters.",
              href: "/workshop/jobs",
              icon: LayoutGrid,
            },
          ]}
        />

        <QuickActionGroup
          label="Documentation"
          actions={[
            {
              label: "Passports",
              description: "Issue and manage digital passports for finished pieces.",
              href: "/passports",
              icon: Gem,
            },
            {
              label: "Appraisals",
              description: "Valuations and insurance documents for clients.",
              href: "/appraisals",
              icon: ShieldCheck,
            },
          ]}
        />
      </div>

      <Suspense key={`activity:${tenantId}`} fallback={<ActivitySkeleton />}>
        <WorkshopActivity tenantId={tenantId} />
      </Suspense>
    </div>
  );
}

// ─── Status pills ──────────────────────────────────────────────────────────

async function WorkshopStatusPills({ tenantId }: { tenantId: string }) {
  const admin = createAdminClient();
  const todayIso = new Date().toISOString().split("T")[0]!;

  // Count overdue repairs + bespoke for the badge on the "Overdue" pill.
  const [odr, odj] = await Promise.all([
    admin
      .from("repairs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","picked_up","completed","cancelled","ready")')
      .lt("due_date", todayIso),
    admin
      .from("bespoke_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("stage", "in", '("collected","delivered","completed","cancelled","ready")')
      .lt("due_date", todayIso),
  ]);
  const overdueCount = (odr.count ?? 0) + (odj.count ?? 0);

  const pills: Array<{ label: string; href: string; badge?: number; badgeTone?: "oxblood" }> = [
    { label: "All Jobs", href: "/workshop/jobs" },
    { label: "Active", href: "/workshop/jobs?status=active" },
    {
      label: "Overdue",
      href: "/workshop/jobs?status=overdue",
      badge: overdueCount,
      badgeTone: "oxblood",
    },
    { label: "Ready for Pickup", href: "/workshop/jobs?status=ready-for-pickup" },
    { label: "Completed", href: "/workshop/jobs?status=completed" },
  ];

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Workshop status filters">
      {pills.map((p) => (
        <Link
          key={p.label}
          href={p.href}
          className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-nexpura-ivory-elevated border border-nexpura-taupe-100 text-[13px] font-medium text-nexpura-charcoal-700 hover:border-nexpura-bronze hover:text-nexpura-charcoal transition-colors"
        >
          <span>{p.label}</span>
          {p.badge !== undefined && p.badge > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums ${
                p.badgeTone === "oxblood"
                  ? "bg-nexpura-oxblood-bg text-nexpura-oxblood"
                  : "bg-nexpura-warm text-nexpura-charcoal-500"
              }`}
            >
              {p.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────

async function WorkshopKpis({ tenantId }: { tenantId: string }) {
  const admin = createAdminClient();
  const today = new Date();
  const todayIso = today.toISOString().split("T")[0]!;
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const weekIso = weekFromNow.toISOString().split("T")[0]!;

  const fetchKpis = unstable_cache(
    async () => {
      // Stage groupings — must mirror /workshop/jobs predicates.
      const REPAIR_TERMINAL_OR_READY = ["collected", "picked_up", "completed", "cancelled", "ready"];
      const BESPOKE_TERMINAL_OR_READY = ["collected", "delivered", "completed", "cancelled", "ready"];

      const [
        // Active = not terminal, not ready
        activeRepairs,
        activeBespoke,
        // Overdue = active AND due_date < today
        overdueRepairs,
        overdueBespoke,
        // Due this week = active AND due_date BETWEEN today AND today+7d
        dueWeekRepairs,
        dueWeekBespoke,
        // Ready for pickup = stage='ready'
        readyRepairs,
        readyBespoke,
        // Bespoke in production specifically (active bespoke)
        bespokeProduction,
        // Appraisals pending = status in (draft, in_progress)
        appraisalsPending,
      ] = await Promise.all([
        admin
          .from("repairs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .not("stage", "in", `(${REPAIR_TERMINAL_OR_READY.join(",")})`),
        admin
          .from("bespoke_jobs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .not("stage", "in", `(${BESPOKE_TERMINAL_OR_READY.join(",")})`),
        admin
          .from("repairs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .not("stage", "in", `(${REPAIR_TERMINAL_OR_READY.join(",")})`)
          .lt("due_date", todayIso),
        admin
          .from("bespoke_jobs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .not("stage", "in", `(${BESPOKE_TERMINAL_OR_READY.join(",")})`)
          .lt("due_date", todayIso),
        admin
          .from("repairs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .not("stage", "in", `(${REPAIR_TERMINAL_OR_READY.join(",")})`)
          .gte("due_date", todayIso)
          .lte("due_date", weekIso),
        admin
          .from("bespoke_jobs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .not("stage", "in", `(${BESPOKE_TERMINAL_OR_READY.join(",")})`)
          .gte("due_date", todayIso)
          .lte("due_date", weekIso),
        admin
          .from("repairs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .eq("stage", "ready"),
        admin
          .from("bespoke_jobs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .eq("stage", "ready"),
        admin
          .from("bespoke_jobs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .not("stage", "in", `(${BESPOKE_TERMINAL_OR_READY.join(",")})`),
        admin
          .from("appraisals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["draft", "in_progress"]),
      ]);

      return {
        active: (activeRepairs.count ?? 0) + (activeBespoke.count ?? 0),
        overdue: (overdueRepairs.count ?? 0) + (overdueBespoke.count ?? 0),
        dueThisWeek: (dueWeekRepairs.count ?? 0) + (dueWeekBespoke.count ?? 0),
        readyForPickup: (readyRepairs.count ?? 0) + (readyBespoke.count ?? 0),
        bespokeInProduction: bespokeProduction.count ?? 0,
        appraisalsPending: appraisalsPending.error ? 0 : appraisalsPending.count ?? 0,
      };
    },
    ["workshop-hub-kpis", tenantId, todayIso],
    { tags: [CACHE_TAGS.workshop(tenantId)], revalidate: 300 }
  );

  const kpis = await fetchKpis();

  return (
    <KpiStrip>
      <KpiCard
        label="Active jobs"
        value={kpis.active}
        href="/workshop/jobs?status=active"
        tone="neutral"
      />
      <KpiCard
        label="Overdue"
        value={kpis.overdue}
        href="/workshop/jobs?status=overdue"
        tone={kpis.overdue > 0 ? "danger" : "neutral"}
      />
      <KpiCard
        label="Due this week"
        value={kpis.dueThisWeek}
        href="/workshop/jobs?status=active"
        tone={kpis.dueThisWeek > 0 ? "warn" : "neutral"}
      />
      <KpiCard
        label="Ready for pickup"
        value={kpis.readyForPickup}
        href="/workshop/jobs?status=ready-for-pickup"
        tone={kpis.readyForPickup > 0 ? "success" : "neutral"}
      />
      <KpiCard
        label="Bespoke in production"
        value={kpis.bespokeInProduction}
        href="/bespoke"
        tone="neutral"
      />
      <KpiCard
        label="Appraisals pending"
        value={kpis.appraisalsPending}
        href="/appraisals"
        tone="neutral"
      />
    </KpiStrip>
  );
}

// ─── Recent activity ──────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  kind: "repair" | "bespoke";
  title: string;
  customer: string;
  stage: string;
  updatedAt: string;
  href: string;
}

async function WorkshopActivity({ tenantId }: { tenantId: string }) {
  const admin = createAdminClient();

  // No unified activity feed exists yet — fetch the 6 most-recently-updated
  // rows across repairs + bespoke and merge.
  // TODO: workshop_events / activity_feed table — when present, replace
  // this with a single query that includes photo uploads and stage changes
  // with a `kind` discriminator.
  const fetchActivity = unstable_cache(
    async () => {
      const [repairsRes, bespokeRes] = await Promise.all([
        admin
          .from("repairs")
          .select(
            "id, item_description, item_type, stage, updated_at, customers(full_name)"
          )
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(6),
        admin
          .from("bespoke_jobs")
          .select("id, title, stage, updated_at, customers(full_name)")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(6),
      ]);

      type CustField =
        | { full_name: string | null }
        | { full_name: string | null }[]
        | null;
      const flatCust = (c: CustField): string => {
        if (!c) return "—";
        if (Array.isArray(c)) return c[0]?.full_name ?? "—";
        return c.full_name ?? "—";
      };

      const repairs: ActivityItem[] = (repairsRes.data ?? []).map((r) => ({
        id: r.id as string,
        kind: "repair",
        title:
          (r.item_type as string | null)
            ? `${r.item_type}${r.item_description ? ` — ${r.item_description}` : ""}`
            : (r.item_description as string | null) ?? "Repair",
        customer: flatCust(r.customers as CustField),
        stage: (r.stage as string | null) ?? "—",
        updatedAt: (r.updated_at as string | null) ?? "",
        href: `/repairs/${r.id}`,
      }));

      const bespoke: ActivityItem[] = (bespokeRes.data ?? []).map((b) => ({
        id: b.id as string,
        kind: "bespoke",
        title: (b.title as string | null) ?? "Bespoke job",
        customer: flatCust(b.customers as CustField),
        stage: (b.stage as string | null) ?? "—",
        updatedAt: (b.updated_at as string | null) ?? "",
        href: `/bespoke/${b.id}`,
      }));

      return [...repairs, ...bespoke]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6);
    },
    ["workshop-hub-activity", tenantId],
    { tags: [CACHE_TAGS.workshop(tenantId)], revalidate: 60 }
  );

  const items = await fetchActivity();

  if (items.length === 0) {
    return (
      <SectionPanel title="Recent activity">
        <HubEmptyState
          icon={Hammer}
          title="No workshop activity yet"
          description="Repairs, bespoke commissions and updates will appear here as your team works on jobs."
          ctas={[
            { label: "Create job", href: "/repairs/new", variant: "primary", icon: FilePlus },
            { label: "Bespoke job", href: "/bespoke/new", variant: "bronze", icon: Sparkles },
          ]}
        />
      </SectionPanel>
    );
  }

  return (
    <SectionPanel
      title="Recent activity"
      description="Latest updates across repairs and bespoke commissions."
      action={{ label: "View all jobs", href: "/workshop/jobs" }}
    >
      <ul className="divide-y divide-nexpura-taupe-100">
        {items.map((item) => {
          const Icon = item.kind === "repair" ? Wrench : Sparkles;
          return (
            <li key={`${item.kind}:${item.id}`}>
              <Link
                href={item.href}
                className="flex items-start gap-3 px-5 py-4 hover:bg-nexpura-warm-tint transition-colors"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-nexpura-warm border border-nexpura-taupe-100 flex items-center justify-center text-nexpura-charcoal-700">
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-[14px] font-semibold text-nexpura-charcoal truncate">
                    {item.title}
                  </p>
                  <p className="font-sans text-[12px] text-nexpura-charcoal-500 mt-0.5 truncate">
                    {item.customer} · {relativeTime(item.updatedAt)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <StatusBadge status={item.stage} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionPanel>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ─── Skeletons ────────────────────────────────────────────────────────────

function StatusPillsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-28 rounded-full" />
      ))}
    </div>
  );
}

function KpiStripSkeleton() {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-nexpura-ivory-elevated rounded-xl px-4 py-3.5 border border-nexpura-taupe-100"
        >
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </section>
  );
}

function ActivitySkeleton() {
  return (
    <section className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl">
      <div className="px-5 py-4 border-b border-nexpura-taupe-100">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-nexpura-taupe-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-4">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}

