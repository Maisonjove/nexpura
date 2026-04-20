import { Suspense } from "react";
import TopNav from "@/components/TopNav";
import { SkipToContent } from "@/components/SkipToContent";
import { LocationProvider } from "@/contexts/LocationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LazyOverlays } from "@/components/LazyOverlays";
import { SessionExpiryModal } from "@/components/SessionExpiryModal";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { NativePrefetchHints } from "@/components/NativePrefetchHints";

/**
 * Static, auth-agnostic app shell — enables Partial Prerendering.
 *
 * What this layout intentionally does NOT do:
 *   - Does not await headers(), cookies(), or supabase.auth.getUser()
 *   - Does not fetch user profile, locations, or team-member
 *   - Does not redirect to /login or /onboarding
 *
 * Why those were safe to remove:
 *   - Auth enforcement lives in middleware.ts (`isProtectedRoute` + redirects
 *     to /login, /verify-email, /onboarding, /suspended). Any request that
 *     reaches this layout has already been authenticated and had its tenant
 *     resolved — the layout-level redirects were defense-in-depth that
 *     forced the entire tree dynamic and blocked static prerendering.
 *   - TopNav derives the tenant slug from the URL (see detectTenantSlug-
 *     FromPathname in TopNav.tsx) so it renders correct prefixed hrefs
 *     without a server-resolved tenant prop.
 *   - LocationProvider's client hook fetches locations when no initial
 *     data is passed (see contexts/LocationContext.tsx).
 *   - RoutePrefetcher + NativePrefetchHints derive the slug the same way
 *     TopNav does.
 *
 * The trade:
 *   - User avatar initials fall back to 'NX' for a few frames until a
 *     future client-side hydration could populate them. Minor UX; can be
 *     layered back with an async server component wrapped in Suspense
 *     when needed.
 *   - LocationPicker is empty for ~100-300ms after hydration while the
 *     client-side locations fetch resolves. Acceptable — it's a secondary
 *     control, not primary content.
 *
 * The win:
 *   - The layout tree is fully static. With experimental.ppr enabled and
 *     `export const experimental_ppr = true` on a page, Next.js prerenders
 *     the shell at build time and streams the dynamic page body in later.
 *     Hard-nav first-shell-visible drops from ~1.7-2s TTFB to <100ms
 *     (CDN edge → shell HTML) while the page body's Suspense fallback
 *     skeleton is already visible.
 */

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocationProvider>
      <SkipToContent />
      <div className="min-h-screen bg-stone-50 font-sans">
        {/*
          Three client components in this layout use URL-reactive hooks
          (usePathname / useRouter) which CacheComponents classes as
          "uncached dynamic data". Each is wrapped in its own Suspense
          boundary (fallback={null}) so the CC prerender pipeline can
          treat them as dynamic without bailing the entire shell. Fallback
          is null because these are either navigation chrome that can
          pop in on hydration (TopNav is visually-stable anyway since it
          derives its slug from the URL at hydration time) or invisible
          effect-only components (RoutePrefetcher + NativePrefetchHints).
        */}
        <Suspense fallback={null}>
          <TopNav />
        </Suspense>
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
        <Suspense fallback={null}>
          <RoutePrefetcher />
        </Suspense>
        <Suspense fallback={null}>
          <NativePrefetchHints />
        </Suspense>
      </div>
    </LocationProvider>
  );
}
