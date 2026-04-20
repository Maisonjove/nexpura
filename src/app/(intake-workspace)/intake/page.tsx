import { Suspense } from "react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth-context";
import { getCached, tenantCacheKey } from "@/lib/cache";
import IntakeClient from "./IntakeClient";

export const metadata = {
  title: "New Intake | Nexpura",
  description: "Create repairs, bespoke jobs, and stock item sales",
};

async function getPageData() {
  const auth = await requireAuth();
  const { tenantId, taxRate, taxName, taxInclusive, currency } = auth;
  const admin = createAdminClient();

  // Customers change more often - cache for 30 seconds
  const customers = await getCached(
    tenantCacheKey(tenantId, "intake-customers"),
    async () => {
      const { data } = await admin
        .from("customers")
        .select("id, full_name, email, mobile, phone")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("full_name")
        .limit(100);
      return data ?? [];
    },
    30
  );

  return {
    customers,
    taxConfig: {
      tax_rate: taxRate,
      tax_name: taxName,
      tax_inclusive: taxInclusive,
      currency,
    },
  };
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex gap-8">
        <div className="flex-1">
          {/* Tabs skeleton */}
          <div className="bg-white border border-stone-200 rounded-2xl p-2 mb-6">
            <div className="grid grid-cols-3 gap-2">
              <div className="h-24 bg-stone-100 rounded-xl" />
              <div className="h-24 bg-stone-100 rounded-xl" />
              <div className="h-24 bg-stone-100 rounded-xl" />
            </div>
          </div>

          {/* Customer section skeleton */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
            <div className="h-5 bg-stone-100 rounded w-24 mb-4" />
            <div className="h-11 bg-stone-100 rounded-lg" />
          </div>

          {/* Form sections skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
              <div className="h-5 bg-stone-100 rounded w-32 mb-5" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-11 bg-stone-100 rounded-lg" />
                <div className="h-11 bg-stone-100 rounded-lg" />
              </div>
              <div className="h-24 bg-stone-100 rounded-lg mt-4" />
            </div>
          ))}
        </div>

        {/* Summary rail skeleton */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
                <div className="h-5 bg-stone-100 rounded w-24" />
              </div>
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex justify-between">
                    <div className="h-4 bg-stone-100 rounded w-16" />
                    <div className="h-4 bg-stone-100 rounded w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function IntakePageWrapper() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <IntakePage />
    </Suspense>
  );
}

async function IntakePage() {
  const data = await getPageData();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Local workspace header — replaces the standard TopNav for this route.
          Middleware rewrites /dashboard → /{slug}/dashboard, so a plain
          "/dashboard" href stays tenant-correct without threading the slug. */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors group"
          aria-label="Exit intake workspace and return to dashboard"
        >
          <svg
            className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Exit Intake
        </Link>
        <span className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-stone-400">
          Workspace
        </span>
      </div>

      {/* Page Header — Premium Style */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl flex items-center justify-center shadow-sm">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">New Intake</h1>
            <p className="text-sm text-stone-500">
              Create a repair, bespoke job, or stock item sale
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Suspense fallback={<LoadingSkeleton />}>
        <IntakeClient
          initialCustomers={data.customers}
          taxConfig={data.taxConfig}
        />
      </Suspense>
    </div>
  );
}
