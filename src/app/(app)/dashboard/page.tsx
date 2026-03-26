import { getDashboardData } from "./actions";
import DashboardWrapper from "./DashboardWrapper";

export default async function DashboardPage() {
  // Initial load with no location filter (all locations)
  const initialData = await getDashboardData(null);

  return <DashboardWrapper initialData={initialData} />;
}
