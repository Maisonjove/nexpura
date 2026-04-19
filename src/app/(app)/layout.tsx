import TopNav from "@/components/TopNav";
import { SkipToContent } from "@/components/SkipToContent";
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LocationProvider } from '@/contexts/LocationContext';
import logger from "@/lib/logger";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LazyOverlays } from "@/components/LazyOverlays";
import { SessionExpiryModal } from "@/components/SessionExpiryModal";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { NativePrefetchHints } from "@/components/NativePrefetchHints";
import { PrehydrationPrefetch } from "@/components/PrehydrationPrefetch";
import { headers } from 'next/headers';
import {
  AUTH_HEADERS,
  getCachedUserProfile,
  getCachedLocations,
  getCachedTeamMember,
} from '@/lib/cached-auth';

// Use revalidate instead of force-dynamic for better performance
// User data is cached with 5 min TTL in Redis, so 60s revalidate is safe
export const revalidate = 60;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First, try to get auth data from headers (set by middleware)
  // This eliminates duplicate DB calls - middleware already validated the user
  const headersList = await headers();
  const headerUserId = headersList.get(AUTH_HEADERS.USER_ID);
  const headerTenantId = headersList.get(AUTH_HEADERS.TENANT_ID);

  // If headers are present, we can skip the auth call
  // Otherwise fall back to Supabase auth (for edge cases)
  let userId: string | null = headerUserId;
  let userEmail: string | null = headersList.get(AUTH_HEADERS.USER_EMAIL);

  if (!userId) {
    // Fallback: no headers from middleware, need to validate auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return redirect('/login');
    }
    userId = user.id;
    userEmail = user.email || null;
  }

  // Fetch profile + locations + team-member in parallel. Middleware already
  // resolved tenantId into AUTH_HEADERS.TENANT_ID, so getCachedLocations no
  // longer has to wait for getCachedUserProfile — eliminates ~50-100ms serial
  // round-trip on every first paint.
  const locationsTenantId = headerTenantId ?? null;
  const [profile, cachedLocationsResult, cachedTeamMemberResult] = await Promise.all([
    getCachedUserProfile(userId),
    locationsTenantId
      ? getCachedLocations(locationsTenantId).catch((err) => {
          logger.error('[AppLayout] Failed to fetch cached locations:', err);
          return [] as { id: string; name: string; type: string; is_active: boolean }[];
        })
      : Promise.resolve([] as { id: string; name: string; type: string; is_active: boolean }[]),
    getCachedTeamMember(userId).catch((err) => {
      logger.error('[AppLayout] Failed to fetch cached team member:', err);
      return null;
    }),
  ]);

  if (!profile) {
    logger.error('[AppLayout] No user profile found for:', userId);
    return redirect('/onboarding');
  }

  // If user exists but has no tenant, redirect to onboarding
  if (!profile.tenant_id) {
    return redirect('/onboarding');
  }

  // Build userData combining auth info and cached profile
  const userData = {
    ...profile,
    id: userId,
    email: userEmail ?? profile.email,
    full_name: profile.full_name ?? undefined,
  };
  const tenant = profile.tenants;

  // If the locations fetch ran against a stale tenantId (header mismatch with
  // profile), refetch with the authoritative profile tenantId. Rare edge case.
  let locations = cachedLocationsResult;
  if (locationsTenantId !== profile.tenant_id) {
    try {
      locations = await getCachedLocations(profile.tenant_id);
    } catch (err) {
      logger.error('[AppLayout] Failed to fetch cached locations (profile tenant):', err);
    }
  }
  const cachedTeamMember = cachedTeamMemberResult;
  const currentLocationId =
    cachedTeamMember?.current_location_id ||
    cachedTeamMember?.default_location_id ||
    (locations.length === 1 ? locations[0].id : null);

  return (
    <LocationProvider initialLocations={locations} initialCurrentLocationId={currentLocationId}>
      {/* Pre-hydration inline script: fires fetch() for hot routes the
          moment the browser parses this HTML (before JS bundles execute,
          before React hydrates). ~2.9 s faster than router.prefetch() in
          useEffect on a complex dashboard. */}
      <PrehydrationPrefetch tenantSlug={tenant?.slug ?? null} />
      <SkipToContent />
      <div className="min-h-screen bg-stone-50 font-sans">
        <TopNav
          user={userData}
          tenantName={tenant?.name as string}
          tenantSlug={tenant?.slug}
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
        <SessionExpiryModal />
        <RoutePrefetcher tenantSlug={tenant?.slug ?? null} />
        <NativePrefetchHints tenantSlug={tenant?.slug ?? null} />
      </div>
    </LocationProvider>
  );
}
