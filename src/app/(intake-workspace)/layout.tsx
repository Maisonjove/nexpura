import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import logger from "@/lib/logger";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionExpiryModal } from "@/components/SessionExpiryModal";
import { SkipToContent } from "@/components/SkipToContent";
import { AUTH_HEADERS, getCachedUserProfile } from "@/lib/cached-auth";

// Same revalidate as (app) — user/tenant data is cached via Redis.
export const revalidate = 60;

/**
 * Focused-workspace layout for /intake.
 *
 * /intake deserves a full-screen task workspace feel — no TopNav, no standard
 * app chrome, just the intake form and a local header with a safe exit. The
 * rest of the app stays on the normal (app) layout; only routes under this
 * route group get the focused treatment.
 *
 * Auth + tenant resolution mirrors (app)/layout.tsx exactly, so protected
 * routing and tenant scoping are unchanged. SessionExpiryModal is kept so
 * token expiry is still surfaced mid-intake. TopNav, LazyOverlays, and
 * RoutePrefetcher are intentionally omitted — they are the chrome that
 * makes /intake feel like a normal page instead of a dedicated workspace.
 */
export default async function IntakeWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const headerUserId = headersList.get(AUTH_HEADERS.USER_ID);

  let userId: string | null = headerUserId;
  if (!userId) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect("/login");
    userId = user.id;
  }

  const profile = await getCachedUserProfile(userId).catch((err) => {
    logger.error("[IntakeWorkspaceLayout] profile fetch failed:", err);
    return null;
  });

  if (!profile) return redirect("/onboarding");
  if (!profile.tenant_id) return redirect("/onboarding");

  return (
    <>
      <SkipToContent />
      <div className="min-h-screen bg-stone-50 font-sans">
        <ErrorBoundary section="intake-workspace">
          <main
            id="main-content"
            role="main"
            aria-label="New Intake workspace"
            tabIndex={-1}
            className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-6 lg:py-8 focus:outline-none"
          >
            {children}
          </main>
        </ErrorBoundary>
        <SessionExpiryModal />
      </div>
    </>
  );
}
