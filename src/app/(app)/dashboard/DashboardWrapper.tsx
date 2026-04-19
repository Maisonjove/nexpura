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
   * Stats fetched server-side in parallel with critical data. Used as SWR
   * fallbackData so the dashboard paints fully populated on first load
   * without a post-hydration round-trip. Fetched with null (all locations);
   * if the user's LocationContext defaults to a specific location, SWR
   * revalidates with the correct key on mount.
   */
  initialStats: DashboardStatsData | null;
}

export default function DashboardWrapper({ criticalData, initialStats }: DashboardWrapperProps) {
  const { getFilterLocationIds } = useLocation();

  // Get location IDs for the cache key
  const locationIds = getFilterLocationIds();
  const locationKey = locationIds?.sort().join(",") || "all";

  const { data: stats, isLoading } = useSWR<DashboardStatsData>(
    `dashboard-stats:${locationKey}`,
    fetcher,
    {
      // Pre-populate with server-rendered stats so the dashboard paints
      // populated instantly — SWR still revalidates in the background to keep
      // data fresh, but the first frame has real numbers.
      fallbackData: locationKey === "all" && initialStats ? initialStats : undefined,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 seconds deduplication
      focusThrottleInterval: 60000, // 1 minute between focus revalidations
    }
  );

  // Use stats if available, otherwise empty (skeleton shown in sidebar)
  const currentStats = stats ?? initialStats ?? emptyStats;
  const showStatsLoading = isLoading && !stats && !initialStats;

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
