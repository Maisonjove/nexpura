"use client";

// Directive kept deliberately: DashboardSidebar is imported (via
// next/dynamic) from the client component DashboardClient. React's
// RSC model forbids importing a server component into a client module.
// Client directives propagate across imports.
//
// The sidebar has no hooks and no interactive state — it's structurally
// a server-like component rendering Links + Skeletons. The "use client"
// tag doesn't add hydration logic of its own (nothing to wire up beyond
// what Link already handles), but the file ships to the client bundle.
//
// The larger hydration win is in the grid split (see
// DashboardCategoryGrid.tsx).
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types (mirrors DashboardClient's) ───────────────────────────────────────

type OverdueRepair = {
  id: string;
  repairNumber: string;
  item: string;
  customer: string | null;
  daysOverdue: number;
  locationName?: string;
};

type ReadyItem = {
  id: string;
  number: string;
  label: string;
  customer: string | null;
  type: "repair" | "bespoke";
  locationName?: string;
};

type MyTask = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
};

type RecentSale = {
  id: string;
  saleNumber: string;
  customer: string | null;
};

type RecentRepair = {
  id: string;
  repairNumber: string;
  customer: string | null;
};

interface DashboardSidebarProps {
  bp: string;
  isStatsLoading: boolean;
  myTasks: MyTask[];
  readyForPickup: ReadyItem[];
  overdueRepairs: OverdueRepair[];
  recentSales: RecentSale[];
  recentRepairsList: RecentRepair[];
}

/**
 * Right sidebar of the dashboard (Tasks / Ready / Overdue / Recent activity).
 *
 * Split out of DashboardClient into its own dynamic chunk (`next/dynamic`,
 * ssr:true with a skeleton fallback) so the sidebar's ~110 lines of JSX
 * and all its sub-widget rendering logic don't weigh down the main
 * DashboardClient bundle. The main above-the-fold experience (header +
 * category grid + summary pills) becomes interactive slightly sooner.
 *
 * The sidebar is `hidden lg:flex` so on narrow viewports it's not visible
 * at all — splitting it also keeps the parse-time contribution out of the
 * critical path for mobile jewellers.
 */
export default function DashboardSidebar({
  bp,
  isStatsLoading,
  myTasks,
  readyForPickup,
  overdueRepairs,
  recentSales,
  recentRepairsList,
}: DashboardSidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col gap-4 w-[256px] flex-shrink-0">
      {/* TODAY */}
      <div className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="px-5 pt-4 pb-3 border-b border-[#E8E4DF]">
          <h3 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-stone-400">Today</h3>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* Tasks due */}
          <div>
            <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Tasks due</p>
            {isStatsLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
            ) : myTasks.length > 0 ? (
              <div className="space-y-0.5">
                {myTasks.slice(0, 3).map((task) => (
                  <Link key={task.id} href={`${bp}/tasks`}
                    className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === "urgent" ? "bg-red-400" : task.priority === "high" ? "bg-amber-400" : "bg-stone-300"}`} />
                    <span className="text-[0.8rem] text-stone-700 truncate">{task.title}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-[0.8rem] text-stone-400">No tasks due today</p>}
          </div>

          {/* Ready for pickup */}
          <div>
            <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Ready for pickup</p>
            {isStatsLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
            ) : readyForPickup.length > 0 ? (
              <div className="space-y-0.5">
                {readyForPickup.slice(0, 4).map((item) => (
                  <Link key={`${item.type}-${item.id}`}
                    href={`${bp}/${item.type === "repair" ? "repairs" : "bespoke"}/${item.id}`}
                    className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-[0.8rem] text-stone-700 truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-[0.8rem] text-stone-400">Nothing ready yet</p>}
          </div>

          {/* Overdue */}
          {overdueRepairs.length > 0 && (
            <div>
              <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Overdue jobs</p>
              <div className="space-y-0.5">
                {overdueRepairs.slice(0, 3).map((r) => (
                  <Link key={r.id} href={`${bp}/repairs/${r.id}`}
                    className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-[0.8rem] text-stone-700 truncate">{r.item}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="bg-[#FAFAF8] border border-[#E8E4DF] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="px-5 pt-4 pb-3 border-b border-[#E8E4DF]">
          <h3 className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-stone-400">Recent Activity</h3>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* Recent sales */}
          <div>
            <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Sales</p>
            {isStatsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
            ) : recentSales.length > 0 ? (
              <div className="space-y-0.5">
                {recentSales.slice(0, 4).map((sale) => (
                  <Link key={sale.id} href={`${bp}/sales/${sale.id}`}
                    className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                    <span className="text-[0.7rem] font-mono text-stone-300 tabular-nums w-6 flex-shrink-0">{sale.saleNumber}</span>
                    <span className="text-[0.8rem] text-stone-700 truncate">{sale.customer || "Walk-in"}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-[0.8rem] text-stone-400">No recent sales</p>}
          </div>

          {/* Recent repairs */}
          <div>
            <p className="text-[0.75rem] font-semibold text-stone-500 mb-2">Repairs</p>
            {isStatsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
            ) : recentRepairsList.length > 0 ? (
              <div className="space-y-0.5">
                {recentRepairsList.slice(0, 4).map((repair) => (
                  <Link key={repair.id} href={`${bp}/repairs/${repair.id}`}
                    className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-white transition-colors duration-150">
                    <span className="text-[0.7rem] font-mono text-stone-300 tabular-nums w-6 flex-shrink-0">{repair.repairNumber}</span>
                    <span className="text-[0.8rem] text-stone-700 truncate">{repair.customer || "No customer"}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-[0.8rem] text-stone-400">No recent repairs</p>}
          </div>
        </div>
      </div>
    </aside>
  );
}
