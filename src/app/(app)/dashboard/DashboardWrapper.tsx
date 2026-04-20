"use client";

import useSWR from "swr";
import { useLocation } from "@/contexts/LocationContext";
import { getDashboardStats, DashboardCriticalData, DashboardStatsData } from "./actions";
import DashboardClient from "./DashboardClient";

// Default empty stats for initial render
const emptyStats: DashboardStatsData = {
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
  activeRepairs: [],
  activeBespokeJobs: [],
  recentSales: [],
  recentRepairsList: [],
  revenueSparkline: [],
  salesCountSparkline: [],
  repairsSparkline: [],
  customersSparkline: [],
  salesBarData: [],
  repairStageData: [],
};

// Fetcher that extracts locationIds from the SWR key and calls the server action
// This avoids stale closure issues by getting locationIds from the key itself
const fetcher = async (key: string): Promise<DashboardStatsData> => {
  // Key format: "dashboard-stats:id1,id2,id3" or "dashboard-stats:all"
  const locationPart = key.split(":")[1];
  const locationIds = locationPart === "all" ? null : locationPart.split(",");
  return getDashboardStats(locationIds);
};

interface DashboardWrapperProps {
  criticalData: DashboardCriticalData;
  /**
   * Stats fetched server-side in parallel with critical data, scoped to
   * `initialLocationKey`. Used as SWR fallbackData when the client's
   * current location selection still matches the server render — gives an
   * instant first paint without a post-hydration round-trip. When the
   * client selection has diverged (e.g. localStorage changed before cookie
   * caught up), SWR re-fetches and we don't show the stale server slice.
   */
  initialStats: DashboardStatsData | null;
  /**
   * The location key used by the server when computing initialStats:
   * either "all" or a comma-joined sorted list of location IDs. The client
   * compares its own derived locationKey against this to decide whether
   * initialStats is still applicable.
   */
  initialLocationKey: string;
}

export default function DashboardWrapper({ criticalData, initialStats, initialLocationKey }: DashboardWrapperProps) {
  const { getFilterLocationIds } = useLocation();

  // Get location IDs for the cache key
  const locationIds = getFilterLocationIds();
  const locationKey = locationIds?.sort().join(",") || "all";
  const initialStatsApplicable = locationKey === initialLocationKey && !!initialStats;

  const { data: stats, isLoading } = useSWR<DashboardStatsData>(
    `dashboard-stats:${locationKey}`,
    fetcher,
    {
      // Only seed SWR with the server-rendered stats when the client is
      // viewing the same location slice the server rendered. Otherwise the
      // dashboard would briefly paint with the wrong location's numbers
      // before SWR's background fetch returns.
      fallbackData: initialStatsApplicable ? (initialStats ?? undefined) : undefined,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 seconds deduplication
      focusThrottleInterval: 60000, // 1 minute between focus revalidations
    }
  );

  // Use freshly-fetched stats if available; otherwise the server-rendered
  // initialStats only when it matches the current location; otherwise the
  // empty placeholder while the loading skeleton shows.
  const currentStats = stats ?? (initialStatsApplicable ? initialStats : null) ?? emptyStats;
  const showStatsLoading = isLoading && !stats && !initialStatsApplicable;

  return (
    <DashboardClient
      firstName={criticalData.firstName}
      tenantName={criticalData.tenantName}
      businessType={criticalData.businessType}
      currency={criticalData.currency}
      isManager={criticalData.isManager}
      // Stats - show loading skeletons if not yet loaded
      salesThisMonthRevenue={currentStats.salesThisMonthRevenue}
      salesThisMonthCount={currentStats.salesThisMonthCount}
      activeRepairsCount={currentStats.activeRepairsCount}
      activeJobsCount={currentStats.activeJobsCount}
      totalOutstanding={currentStats.totalOutstanding}
      overdueInvoiceCount={currentStats.overdueInvoiceCount}
      lowStockItems={currentStats.lowStockItems}
      overdueRepairs={currentStats.overdueRepairs}
      readyForPickup={currentStats.readyForPickup}
      recentActivity={currentStats.recentActivity}
      myTasks={currentStats.myTasks}
      teamTaskSummary={currentStats.teamTaskSummary}
      activeRepairs={currentStats.activeRepairs}
      activeBespokeJobs={currentStats.activeBespokeJobs}
      recentSales={currentStats.recentSales}
      recentRepairsList={currentStats.recentRepairsList}
      revenueSparkline={currentStats.revenueSparkline}
      salesCountSparkline={currentStats.salesCountSparkline}
      repairsSparkline={currentStats.repairsSparkline}
      customersSparkline={currentStats.customersSparkline}
      salesBarData={currentStats.salesBarData}
      repairStageData={currentStats.repairStageData}
      // Pass loading state for progressive UI
      isStatsLoading={showStatsLoading}
    />
  );
}
