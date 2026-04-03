"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocation } from "@/contexts/LocationContext";
import { getDashboardData, DashboardData } from "./actions";
import DashboardClient from "./DashboardClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardWrapper({ initialData }: { initialData: DashboardData }) {
  const { getFilterLocationIds, viewMode, currentLocationId } = useLocation();
  const [data, setData] = useState<DashboardData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Refetch when location changes
  useEffect(() => {
    // Skip initial load since we have initialData
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const locationIds = getFilterLocationIds();
    
    startTransition(async () => {
      try {
        const newData = await getDashboardData(locationIds);
        setData(newData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    });
  }, [viewMode, currentLocationId, getFilterLocationIds, isInitialLoad]);

  if (isPending) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-xl p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardClient
      firstName={data.firstName}
      tenantName={data.tenantName}
      businessType={data.businessType}
      salesThisMonthRevenue={data.salesThisMonthRevenue}
      salesThisMonthCount={data.salesThisMonthCount}
      activeRepairsCount={data.activeRepairsCount}
      activeJobsCount={data.activeJobsCount}
      totalOutstanding={data.totalOutstanding}
      overdueInvoiceCount={data.overdueInvoiceCount}
      lowStockItems={data.lowStockItems}
      overdueRepairs={data.overdueRepairs}
      readyForPickup={data.readyForPickup}
      recentActivity={data.recentActivity}
      myTasks={data.myTasks}
      teamTaskSummary={data.teamTaskSummary}
      isManager={data.isManager}
      activeRepairs={data.activeRepairs}
      activeBespokeJobs={data.activeBespokeJobs}
      currency={data.currency}
      recentSales={data.recentSales}
      recentRepairsList={data.recentRepairsList}
      revenueSparkline={data.revenueSparkline}
      salesCountSparkline={data.salesCountSparkline}
      repairsSparkline={data.repairsSparkline}
      customersSparkline={data.customersSparkline}
      salesBarData={data.salesBarData}
      repairStageData={data.repairStageData}
    />
  );
}
