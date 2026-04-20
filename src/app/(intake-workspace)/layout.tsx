import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import logger from "@/lib/logger";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionExpiryModal } from "@/components/SessionExpiryModal";
import { SkipToContent } from "@/components/SkipToContent";
import { AUTH_HEADERS, getCachedUserProfile } from "@/lib/cached-auth";

// Same revalidate as (app) — user/tenant data is cached via Redis.
// TODO(cacheComponents-flag): DELETE when the flag is flipped (stripped
// as part of the 105-export cleanup pass).
export const revalidate = 60;

/**
 * Focused-workspace layout for /intake. Same CC-compliance shape as the
 * (admin) + /print layouts: sync outer wrapper + Suspense-wrapped async
 * auth guard. redirect() still fires server-side before any intake
 * chrome streams.
 */
export default function IntakeWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <Suspense fallback={null}>
              <IntakeAuthGuard>{children}</IntakeAuthGuard>
            </Suspense>
          </main>
        </ErrorBoundary>
        <SessionExpiryModal />
      </div>
    </>
  );
}

async function IntakeAuthGuard({ children }: { children: React.ReactNode }) {
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

  return <>{children}</>;
}
