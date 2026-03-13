import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SidebarProvider } from "@/components/ui/sidebar";

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
    return redirect('/login');
  }

  // Get user profile for sidebar
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const userData = {
    ...user,
    ...profile,
  };

  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-stone-50">
        <Sidebar user={userData} isSuperAdmin={isSuperAdmin} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header user={userData} />
          <main className="p-8 flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}