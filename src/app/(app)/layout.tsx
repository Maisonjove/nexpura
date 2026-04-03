import TopNav from "@/components/TopNav";
import { SkipToContent } from "@/components/SkipToContent";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { canonicalPlan } from '@/lib/features';
import { LocationProvider } from '@/contexts/LocationContext';
import logger from "@/lib/logger";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LazyOverlays } from "@/components/LazyOverlays";

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

  // --- All non-critical data in a single parallel fetch (reduces DB round-trips) ---
  let locations: { id: string; name: string; type: string; is_active: boolean }[] = [];
  let currentLocationId: string | null = null;

  if (profile?.tenant_id) {
    try {
      const [locRes, tmRes] = await Promise.all([
        admin.from('locations').select('id, name, type, is_active').eq('tenant_id', profile.tenant_id as string).eq('is_active', true).order('name'),
        admin.from('team_members').select('current_location_id, default_location_id').eq('user_id', user.id).maybeSingle(),
      ]);

      locations = locRes.data ?? [];
      currentLocationId =
        tmRes.data?.current_location_id ||
        tmRes.data?.default_location_id ||
        (locations.length === 1 ? locations[0].id : null);
    } catch (err) {
      logger.error('[AppLayout] Failed to fetch layout data:', err);
    }
  }

  return (
    <LocationProvider initialLocations={locations} initialCurrentLocationId={currentLocationId}>
      <SkipToContent />
      <div className="min-h-screen bg-stone-50 font-sans">
        <TopNav
          user={userData}
          tenantName={tenant?.name as string}
        />
        <ErrorBoundary section="main-content">
          <main
            id="main-content"
            role="main"
            aria-label="Main content"
            tabIndex={-1}
            className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-8 lg:py-12 focus:outline-none"
          >
            {children}
          </main>
        </ErrorBoundary>
        <LazyOverlays />
      </div>
    </LocationProvider>
  );
}
