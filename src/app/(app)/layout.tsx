import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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
    .from('users')
    .select('*, tenants(*)')
    .eq('id', user.id)
    .single();

  const userData = {
    ...user,
    ...profile,
  };

  const tenant = profile?.tenants;
  const businessMode = tenant?.business_mode || 'full';

  const isSuperAdmin = profile?.role === 'super_admin';

  // Fetch website config for sidebar
  let websiteConfig = null;
  if (profile?.tenant_id) {
    const { data: wc } = await supabase
      .from('website_config')
      .select('website_type, external_url, subdomain, published')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();
    websiteConfig = wc;
  }

  // Count items ready for pickup (repairs + bespoke)
  let readyRepairsCount = 0;
  let readyBespokeCount = 0;
  if (profile?.tenant_id) {
    const [repairsRes, bespokeRes] = await Promise.all([
      supabase.from('repairs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id).eq('stage', 'ready').is('deleted_at', null),
      supabase.from('bespoke_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id).eq('stage', 'ready'),
    ]);
    readyRepairsCount = repairsRes.count ?? 0;
    readyBespokeCount = bespokeRes.count ?? 0;
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <Sidebar 
        user={userData} 
        isSuperAdmin={isSuperAdmin} 
        websiteConfig={websiteConfig} 
        businessMode={businessMode}
        readyRepairsCount={readyRepairsCount}
        readyBespokeCount={readyBespokeCount}
      />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <Header user={userData} />
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
