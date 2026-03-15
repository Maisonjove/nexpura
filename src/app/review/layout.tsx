import ReviewSidebar from "@/components/ReviewSidebar";
import Header from "@/components/Header";

const DEMO_USER = {
  id: "demo",
  full_name: "Demo Owner",
  email: "demo@nexpura.com",
  role: "owner",
  tenant_id: "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a",
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-stone-50">
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-xs font-semibold py-1.5">
        🔍 REVIEW MODE — Read-only · Marcus &amp; Co. Fine Jewellery · Demo data only
      </div>
      <div className="pt-7 flex w-full">
        <ReviewSidebar
          user={DEMO_USER}
          isSuperAdmin={false}
          websiteConfig={null}
          businessMode="full"
          readyRepairsCount={1}
          readyBespokeCount={0}
        />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <Header user={DEMO_USER} />
          <main className="flex-1 overflow-auto p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
