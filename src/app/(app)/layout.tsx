import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { createServerClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

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
    <div className="min-h-screen bg-soft-gray-light">
      <div className="flex">
        <Sidebar user={userData} isSuperAdmin={isSuperAdmin} />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
