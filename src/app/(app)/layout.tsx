import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user + tenant data (include subscriptions for feature gating in sidebar)
  const { data: userData } = await supabase
    .from("users")
    .select("*, tenants(*, subscriptions(plan, status))")
    .eq("id", user.id)
    .single();

  // Check if user is a super admin
  const adminClient = createAdminClient();
  const { data: superAdmin } = await adminClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const isSuperAdmin = !!superAdmin;

  return (
    <div className="flex h-screen overflow-hidden bg-ivory">
      {/* Sidebar */}
      <Sidebar user={userData} isSuperAdmin={isSuperAdmin} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={userData} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
