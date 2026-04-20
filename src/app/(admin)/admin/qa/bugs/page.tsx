import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import BugListClient from "./BugListClient";
import logger from "@/lib/logger";

/**
 * /admin/qa/bugs — CC-ready page-route (admin cluster, second of four).
 *
 * Same shape as /admin/qa: sync top-level → Suspense → async body →
 * pure loader. Admin auth is handled by the (admin) layout; this page
 * does no cookie/header access.
 *
 * TODO(cacheComponents-flag): When `cacheComponents: true` is enabled,
 * delete the `force-dynamic` + `revalidate` exports below and add
 *   'use cache';
 *   cacheLife('minutes');
 *   cacheTag('qa-bugs');
 * to `loadBugsData()` (import from 'next/cache'). Call
 * `revalidateTag('qa-bugs')` when qa_test_results fail-state changes.
 */

// TODO(cacheComponents-flag): DELETE these when the flag is flipped.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BugListPage() {
  return (
    <Suspense fallback={<BugListSkeleton />}>
      <BugListBody />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dynamic body. DB reads only; no request-scoped access.
// ─────────────────────────────────────────────────────────────────────────
async function BugListBody() {
  const bugs = await loadBugsData();

  const byPriority = {
    critical: bugs.filter((b) => b.priority === "critical"),
    high: bugs.filter((b) => b.priority === "high"),
    medium: bugs.filter((b) => b.priority === "medium"),
    low: bugs.filter((b) => b.priority === "low"),
  };

  return <BugListClient bugs={bugs} byPriority={byPriority} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Cacheable data loader. Takes no inputs; admin-wide view.
// ─────────────────────────────────────────────────────────────────────────
type BugPriority = "critical" | "high" | "medium" | "low";

interface Bug {
  id: string;
  title: string;
  description: string | null;
  category: string;
  categoryIcon: string | null;
  priority: BugPriority;
  route: string | null;
  testingGuidance: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  testerName: string | null;
  testedAt: string | null;
}

async function loadBugsData(): Promise<Bug[]> {
  try {
    const adminClient = createAdminClient();

    const { data: items } = await adminClient
      .from("qa_checklist_items")
      .select(`
        *,
        qa_categories (name, icon),
        qa_test_results (*)
      `)
      .order("priority")
      .order("sort_order");

    const validPriorities: ReadonlySet<BugPriority> = new Set([
      "critical",
      "high",
      "medium",
      "low",
    ]);

    return (items || [])
      .filter((item) => item.qa_test_results?.[0]?.status === "fail")
      .map<Bug>((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.qa_categories?.name || "Unknown",
        categoryIcon: item.qa_categories?.icon,
        priority: validPriorities.has(item.priority as BugPriority)
          ? (item.priority as BugPriority)
          : "medium",
        route: item.route,
        testingGuidance: item.testing_guidance,
        notes: item.qa_test_results?.[0]?.notes,
        screenshotUrl: item.qa_test_results?.[0]?.screenshot_url,
        testerName: item.qa_test_results?.[0]?.tester_name,
        testedAt: item.qa_test_results?.[0]?.tested_at,
      }));
  } catch (error) {
    logger.error("[admin/qa/bugs] loadBugsData failed", error);
    return [];
  }
}

function BugListSkeleton() {
  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-5 w-64" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
