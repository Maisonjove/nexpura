import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

// Demo tenant layout — no auth required, read-only
// Scoped exclusively to the Marcus & Co. Fine Jewellery demo tenant

const DEMO_USER = {
  id: "demo",
  full_name: "Demo User",
  email: "demo@nexpura.com",
  role: "owner",
  tenant_id: "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Demo mode banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-xs font-semibold py-1.5 tracking-wide">
        🔍 DEMO MODE — Read-only preview · Marcus &amp; Co. Fine Jewellery · No real data
      </div>

      <div className="pt-7 flex w-full">
        <Sidebar
          user={DEMO_USER}
          isSuperAdmin={false}
          websiteConfig={null}
          businessMode="full"
          readyRepairsCount={0}
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
