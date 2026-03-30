import { DiamondLoader } from "@/components/ui/DiamondLoader";

export default function AppLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <DiamondLoader size="md" />
    </div>
  );
}
