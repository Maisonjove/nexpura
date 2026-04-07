import { getDashboardCriticalData } from "./actions";
import DashboardWrapper from "./DashboardWrapper";

export default async function DashboardPage() {
  // Only fetch critical data server-side (minimal, fast)
  // Stats are loaded client-side for progressive loading
  const criticalData = await getDashboardCriticalData();

  return <DashboardWrapper criticalData={criticalData} />;
}
