import { Suspense } from "react";
import { getDashboardData } from "./actions";
import DashboardWrapper from "./DashboardWrapper";
import DashboardLoading from "./loading";

async function DashboardContent() {
  const initialData = await getDashboardData(null);
  return <DashboardWrapper initialData={initialData} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
