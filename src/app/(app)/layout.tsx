import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { canonicalPlan } from '@/lib/features';

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

  // Use admin client for users table to bypass RLS recursion.
  // The anon-key client with RLS causes infinite policy recursion on users table,
  // adding 1–2s latency per request and causing timeouts on complex pages.
  const admin = createAdminClient();
  const { data: profile } = await admin
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

  // Fetch website config + subscription plan for sidebar
  let websiteConfig = null;
  let tenantPlan = "boutique";
  if (profile?.tenant_id) {
    const [wcRes, subRes] = await Promise.all([
      admin.from('website_config').select('website_type, external_url, subdomain, published').eq('tenant_id', profile.tenant_id).maybeSingle(),
      admin.from('subscriptions').select('plan').eq('tenant_id', profile.tenant_id).maybeSingle(),
    ]);
    websiteConfig = wcRes.data;
    tenantPlan = canonicalPlan(subRes.data?.plan ?? 'boutique');
  }

  // Count items ready for pickup (repairs + bespoke)
  let readyRepairsCount = 0;
  let readyBespokeCount = 0;
  if (profile?.tenant_id) {
    const [repairsRes, bespokeRes] = await Promise.all([
      admin.from('repairs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id).eq('stage', 'ready').is('deleted_at', null),
      admin.from('bespoke_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id).eq('stage', 'ready'),
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
        plan={tenantPlan}
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
