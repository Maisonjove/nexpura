import { Suspense } from "react";
import { getDashboardData, getEmptyDashboard } from "./actions";
import DashboardWrapper from "./DashboardWrapper";
import DashboardLoading from "./loading";

async function DashboardContent() {
  try {
    const initialData = await getDashboardData(null);
    return <DashboardWrapper initialData={initialData} />;
  } catch (error) {
    console.error("Dashboard load error:", error);
    // Return empty dashboard on error
    const fallback = await getEmptyDashboard();
    return <DashboardWrapper initialData={fallback} />;
  }
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
