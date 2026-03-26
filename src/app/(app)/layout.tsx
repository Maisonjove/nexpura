import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingTour } from "@/components/onboarding/tour";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { canonicalPlan } from '@/lib/features';
import { LocationProvider } from '@/contexts/LocationContext';
import logger from "@/lib/logger";

// Prevent caching so plan changes take effect immediately
export const dynamic = 'force-dynamic';

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
    logger.error('[AppLayout] Failed to fetch user profile:', err);
    // No user record = needs onboarding
    return redirect('/onboarding');
  }

  // If user exists but has no tenant, redirect to onboarding
  if (!profile?.tenant_id) {
    return redirect('/onboarding');
  }

  const userData = { ...user, ...profile };
  const tenant = profile?.tenants as Record<string, unknown> | null;
  const businessMode = (tenant?.business_mode as string) || 'full';
  const isSuperAdmin = profile?.role === 'super_admin';

  // --- All non-critical data in a single parallel fetch (reduces DB round-trips) ---
  let websiteConfig = null;
  let tenantPlan = "boutique";
  let readyRepairsCount = 0;
  let readyBespokeCount = 0;
  let locations: { id: string; name: string; type: string; is_active: boolean }[] = [];
  let currentLocationId: string | null = null;

  if (profile?.tenant_id) {
    try {
      const [wcRes, subRes, repairsRes, bespokeRes, locRes, tmRes] = await Promise.all([
        admin.from('website_config').select('website_type, external_url, subdomain, published').eq('tenant_id', profile.tenant_id as string).maybeSingle(),
        admin.from('subscriptions').select('plan').eq('tenant_id', profile.tenant_id as string).maybeSingle(),
        admin.from('repairs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id as string).eq('stage', 'ready').is('deleted_at', null),
        admin.from('bespoke_jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id as string).eq('stage', 'ready'),
        admin.from('locations').select('id, name, type, is_active').eq('tenant_id', profile.tenant_id as string).eq('is_active', true).order('name'),
        admin.from('team_members').select('current_location_id, default_location_id').eq('user_id', user.id).maybeSingle(),
      ]);

      websiteConfig = wcRes.data ?? null;
      tenantPlan = canonicalPlan(subRes.data?.plan ?? 'boutique');
      readyRepairsCount = repairsRes.count ?? 0;
      readyBespokeCount = bespokeRes.count ?? 0;
      locations = locRes.data ?? [];
      currentLocationId =
        tmRes.data?.current_location_id ||
        tmRes.data?.default_location_id ||
        (locations.length === 1 ? locations[0].id : null);
    } catch (err) {
      logger.error('[AppLayout] Failed to fetch layout data:', err);
      // Keep all defaults on error
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
          tenantName={tenant?.name as string}
        />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <Header user={userData} />
          <main className="flex-1 overflow-auto p-8">
            {children}
          </main>
          <CommandPalette />
          <OnboardingTour />
        </div>
      </div>
    </LocationProvider>
  );
}
