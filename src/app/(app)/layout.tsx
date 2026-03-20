import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { canonicalPlan } from '@/lib/features';
import { LocationProvider } from '@/contexts/LocationContext';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  // Use admin client for users table to bypass RLS recursion.
  // The anon-key client with RLS causes infinite policy recursion on users table,
  // adding 1–2s latency per request and causing timeouts on complex pages.
  const admin = createAdminClient();

  // --- Profile fetch (hard dependency: needed for sidebar & tenant data) ---
  let profile: Record<string, unknown> | null = null;
  try {
    const { data } = await admin
      .from('users')
      .select('*, tenants(*)')
      .eq('id', user.id)
      .single();
    profile = data;
  } catch (err) {
    console.error('[AppLayout] Failed to fetch user profile:', err);
    // Profile is required — redirect to login so the user can re-authenticate
    return redirect('/login');
  }

  const userData = { ...user, ...profile };
  const tenant = profile?.tenants as Record<string, unknown> | null;
  const businessMode = (tenant?.business_mode as string) || 'full';
  const isSuperAdmin = profile?.role === 'super_admin';

  // --- Website config + subscription plan (non-critical: safe defaults used) ---
  let websiteConfig = null;
  let tenantPlan = "boutique";
  if (profile?.tenant_id) {
    try {
      const [wcRes, subRes] = await Promise.all([
        admin.from('website_config').select('website_type, external_url, subdomain, published').eq('tenant_id', profile.tenant_id as string).maybeSingle(),
        admin.from('subscriptions').select('plan').eq('tenant_id', profile.tenant_id as string).maybeSingle(),
      ]);
      websiteConfig = wcRes.data ?? null;
      tenantPlan = canonicalPlan(subRes.data?.plan ?? 'boutique');
    } catch (err) {
      console.error('[AppLayout] Failed to fetch website config / subscription:', err);
      // Keep defaults: websiteConfig = null, tenantPlan = "boutique"
    }
  }

  // --- Ready-pickup counts (non-critical: default to 0) ---
  let readyRepairsCount = 0;
  let readyBespokeCount = 0;
  if (profile?.tenant_id) {
    try {
      const [repairsRes, bespokeRes] = await Promise.all([
        admin.from('repairs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id as string).eq('stage', 'ready').is('deleted_at', null),
        admin.from('bespoke_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id as string).eq('stage', 'ready'),
      ]);
      readyRepairsCount = repairsRes.count ?? 0;
      readyBespokeCount = bespokeRes.count ?? 0;
    } catch (err) {
      console.error('[AppLayout] Failed to fetch ready-pickup counts:', err);
      // Keep defaults: 0 / 0
    }
  }

  // --- Locations + current location (non-critical: defaults to empty array) ---
  let locations: { id: string; name: string; type: string; is_active: boolean }[] = [];
  let currentLocationId: string | null = null;
  if (profile?.tenant_id) {
    try {
      const locRes = await admin
        .from('locations')
        .select('id, name, type, is_active')
        .eq('tenant_id', profile.tenant_id as string)
        .eq('is_active', true)
        .order('name');
      locations = locRes.data ?? [];

      // Get user's current location from team_members
      const tmRes = await admin
        .from('team_members')
        .select('current_location_id, default_location_id')
        .eq('user_id', user.id)
        .maybeSingle();
      currentLocationId =
        tmRes.data?.current_location_id ||
        tmRes.data?.default_location_id ||
        (locations.length === 1 ? locations[0].id : null);
    } catch (err) {
      console.error('[AppLayout] Failed to fetch locations:', err);
      // Keep defaults: [] / null — LocationContext handles empty state gracefully
    }
  }

  return (
    <LocationProvider initialLocations={locations} initialCurrentLocationId={currentLocationId}>
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
    </LocationProvider>
  );
}
