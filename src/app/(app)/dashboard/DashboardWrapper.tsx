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
  const locationIds = locationPart === "all" ? undefined : locationPart.split(",");
  return getDashboardStats(locationIds);
};

interface DashboardWrapperProps {
  criticalData: DashboardCriticalData;
}

export default function DashboardWrapper({ criticalData }: DashboardWrapperProps) {
  const { getFilterLocationIds } = useLocation();
  
  // Get location IDs for the cache key
  const locationIds = getFilterLocationIds();
  const locationKey = locationIds?.sort().join(",") || "all";
  
  // SWR for client-side stats fetching with deduplication and caching
  // The fetcher extracts locationIds from the key to avoid stale closure issues
  const { data: stats, isLoading } = useSWR<DashboardStatsData>(
    `dashboard-stats:${locationKey}`,
    fetcher,
    {
      // Keep stale data while revalidating (instant feel)
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 seconds deduplication
      focusThrottleInterval: 60000, // 1 minute between focus revalidations
    }
  );

  // Use stats if available, otherwise empty (skeleton shown in sidebar)
  const currentStats = stats ?? emptyStats;
  const showStatsLoading = isLoading && !stats;

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
