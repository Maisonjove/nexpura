import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import InventoryForm from "../InventoryForm";

export default async function NewInventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const { data: categories } = await supabase
    .from("stock_categories")
    .select("id, name")
    .eq("tenant_id", userData?.tenant_id ?? "")
    .order("name");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-forest/50">
        <Link href="/inventory" className="hover:text-sage transition-colors">Inventory</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-forest">New Item</span>
      </div>

      <h1 className="font-fraunces text-2xl font-semibold text-forest">Add New Item</h1>

      <InventoryForm
        categories={categories ?? []}
        mode="create"
      />
    </div>
  );
}
