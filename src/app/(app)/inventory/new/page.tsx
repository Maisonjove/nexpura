import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_HEADERS } from "@/lib/cached-auth";
import Link from "next/link";
import InventoryForm from "../InventoryForm";

export default async function NewInventoryPage() {
  const [headersList, supabase] = await Promise.all([headers(), createClient()]);
  const tenantId = headersList.get(AUTH_HEADERS.TENANT_ID);
  if (!tenantId) redirect("/login");

  const { data: categories } = await supabase
    .from("stock_categories")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Link href="/inventory" className="hover:text-amber-700 transition-colors">Inventory</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-stone-900">New Item</span>
      </div>

      <h1 className="font-semibold text-2xl font-semibold text-stone-900">Add New Item</h1>

      <InventoryForm
        categories={categories ?? []}
        mode="create"
      />
    </div>
  );
}
