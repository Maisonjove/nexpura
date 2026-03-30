import { DiamondLoader } from "@/components/ui/DiamondLoader";

export default function DashboardLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <DiamondLoader size="lg" text="Loading your dashboard..." />
    </div>
  );
}
