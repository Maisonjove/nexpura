import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-context";
import { isAllowlistedAdmin } from "@/lib/admin-allowlist";
import { Skeleton } from "@/components/ui/skeleton";
import PilotIssuesClient from "./PilotIssuesClient";
import type { PilotIssue } from "./types";
import logger from "@/lib/logger";

/**
 * /admin/pilot-issues — CC-ready page-route.
 *
 * Owner-only internal tool. Sync top-level + Suspense-wrapped async body
 * that resolves auth (getAuthContext reads request headers from
 * middleware-set AUTH_HEADERS) and loads the issues + tenant list.
 *
 * Unlike the (admin) group pages, this lives under (app) — auth is NOT
 * handled by a parent layout, so the body must do its own redirect when
 * unauthenticated. `redirect("/login")` inside a Suspense-wrapped async
 * component throws a NEXT_REDIRECT that Next.js handles server-side
 * before any admin content streams.
 *
 * TODO(cacheComponents-flag): when the flag is flipped, the issues/
 * tenants fetch inside `loadPilotIssuesData()` can be marked with
 *   'use cache'; cacheLife('minutes'); cacheTag('pilot-issues');
 * Note: the auth check stays request-time (reads headers), so it does
 * NOT get `'use cache'` — it's the dynamic part of the body.
 */

export const metadata = { title: "Pilot Issues — Nexpura Internal" };

export default function PilotIssuesPage() {
  return (
    <Suspense fallback={<PilotIssuesSkeleton />}>
      <PilotIssuesBody />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. Resolves auth from middleware headers, then either:
//   1. Redirects to /login if unauthenticated
//   2. Renders access-denied if authenticated but not owner
//   3. Loads issues + tenants and renders the client
// ─────────────────────────────────────────────────────────────────────────
async function PilotIssuesBody() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  // Joey 2026-05-03 P2-H audit: pre-fix the gate was `!auth.isOwner`,
  // which let ANY tenant owner (not just Joey) load this page — and
  // because `loadPilotIssuesData()` queries pilot_issues + tenants
  // without any tenant filter, every tenant owner could read every
  // other tenant's pilot feedback + the full tenant list. This is a
  // platform-wide internal tool, not a tenant-internal one. Fixed by
  // gating on the platform-admin allowlist (germanijoey@yahoo.com
  // only — same belt as src/app/(admin)/layout.tsx).
  if (!isAllowlistedAdmin(auth.email)) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Access Denied</h1>
        <p className="text-stone-500">This internal tool is only accessible to platform admins.</p>
      </div>
    );
  }

  const { issues, tenants } = await loadPilotIssuesData();

  return (
    <PilotIssuesClient
      issues={issues}
      tenants={tenants}
      currentUserId={auth.userId}
      currentUserEmail={auth.email}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable data loader. No inputs; admin-wide view of all pilot issues.
// ─────────────────────────────────────────────────────────────────────────
async function loadPilotIssuesData(): Promise<{
  issues: PilotIssue[];
  tenants: { id: string; name: string }[];
}> {
  try {
    const admin = createAdminClient();

    const [{ data: issues }, { data: tenants }] = await Promise.all([
      admin.from("pilot_issues").select("*").order("created_at", { ascending: false }),
      admin.from("tenants").select("id, name").order("name"),
    ]);

    return {
      issues: (issues ?? []) as PilotIssue[],
      tenants: tenants ?? [],
    };
  } catch (error) {
    logger.error("[admin/pilot-issues] loadPilotIssuesData failed", error);
    return { issues: [], tenants: [] };
  }
}

function PilotIssuesSkeleton() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm space-y-2">
            <Skeleton className="h-5 w-80" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
