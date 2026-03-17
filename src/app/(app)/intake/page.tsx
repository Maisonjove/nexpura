import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import IntakeClient from "./IntakeClient";

export const metadata = {
  title: "Intake | Nexpura",
  description: "Create repairs, bespoke jobs, and stock item sales",
};

async function getPageData() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userData } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) {
    redirect("/login");
  }

  const tenantId = userData.tenant_id;

  const [customersRes, taxRes] = await Promise.all([
    admin
      .from("customers")
      .select("id, full_name, email, mobile, phone")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("full_name")
      .limit(100),
    admin
      .from("tenants")
      .select("tax_rate, tax_name, tax_inclusive, currency")
      .eq("id", tenantId)
      .single(),
  ]);

  return {
    customers: customersRes.data ?? [],
    taxConfig: taxRes.data ?? {
      tax_rate: 0.1,
      tax_name: "GST",
      tax_inclusive: true,
      currency: "AUD",
    },
  };
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex gap-8">
        <div className="flex-1">
          {/* Tabs skeleton */}
          <div className="bg-white border border-stone-200 rounded-xl p-1.5 mb-6">
            <div className="flex">
              <div className="flex-1 h-12 bg-stone-100 rounded-lg" />
            </div>
          </div>

          {/* Customer section skeleton */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
            <div className="h-5 bg-stone-100 rounded w-24 mb-4" />
            <div className="h-10 bg-stone-100 rounded" />
          </div>

          {/* Form section skeleton */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 mb-6">
            <div className="h-5 bg-stone-100 rounded w-32 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-stone-100 rounded" />
              <div className="h-10 bg-stone-100 rounded" />
            </div>
            <div className="h-24 bg-stone-100 rounded mt-4" />
          </div>
        </div>

        {/* Summary rail skeleton */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
              <div className="h-5 bg-stone-100 rounded w-24" />
            </div>
            <div className="p-5 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-stone-100 rounded w-16" />
                  <div className="h-4 bg-stone-100 rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function IntakePage() {
  const data = await getPageData();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
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
