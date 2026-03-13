import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import InventoryForm from "../../InventoryForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInventoryPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user?.id ?? "")
    .single();

  const [{ data: item }, { data: categories }] = await Promise.all([
    supabase
      .from("inventory")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("stock_categories")
      .select("id, name")
      .eq("tenant_id", userData?.tenant_id ?? "")
      .order("name"),
  ]);

  if (!item) notFound();

  const typedItem = item as {
    id: string;
    sku: string | null;
    barcode: string | null;
    name: string;
    item_type: string;
    jewellery_type: string | null;
    category_id: string | null;
    description: string | null;
    metal_type: string | null;
    metal_colour: string | null;
    metal_purity: string | null;
    metal_weight_grams: number | null;
    stone_type: string | null;
    stone_carat: number | null;
    stone_colour: string | null;
    stone_clarity: string | null;
    ring_size: string | null;
    dimensions: string | null;
    cost_price: number | null;
    wholesale_price: number | null;
    retail_price: number;
    quantity: number;
    low_stock_threshold: number | null;
    track_quantity: boolean;
    supplier_name: string | null;
    supplier_sku: string | null;
    is_featured: boolean;
    status: string;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Link href="/inventory" className="hover:text-[#8B7355] transition-colors">Inventory</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/inventory/${id}`} className="hover:text-[#8B7355] transition-colors truncate max-w-[200px]">
          {typedItem.name}
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-stone-900">Edit</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl font-semibold text-stone-900">Edit Item</h1>
        {typedItem.sku && (
          <span className="text-sm font-mono text-stone-400 bg-stone-50 border border-stone-200 px-3 py-1 rounded">
            {typedItem.sku}
          </span>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        To adjust stock quantity, use the Adjust Stock button on the item page.
      </div>

      <InventoryForm
        categories={categories ?? []}
        item={typedItem}
        mode="edit"
      />
    </div>
  );
}
