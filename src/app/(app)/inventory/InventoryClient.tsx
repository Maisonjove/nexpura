"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BatchPrintModal from "./BatchPrintModal";

interface Category {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  item_type: string;
  jewellery_type: string | null;
  category_id: string | null;
  quantity: number;
  low_stock_threshold: number | null;
  retail_price: number;
  cost_price: number | null;
  status: string;
  is_featured: boolean;
  primary_image?: string | null;
  metal_type?: string | null;
  stone_type?: string | null;
  metal_weight_grams?: number | null;
  barcode_value?: string | null;
  stock_categories: { name: string } | null;
}

interface InventoryClientProps {
  items: InventoryItem[];
  categories: Category[];
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
  tenantName?: string;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  finished_piece: "Finished Piece",
  loose_stone: "Loose Stone",
  finding: "Finding",
  raw_material: "Raw Material",
  packaging: "Packaging",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700 border border-green-200",
  inactive: "bg-gray-50 text-gray-600 border border-gray-200",
  sold: "bg-blue-50 text-blue-700 border border-blue-200",
  consignment: "bg-amber-50 text-amber-700 border border-amber-200",
};

export default function InventoryClient({
  items,
  categories,
  totalItems,
  lowStockCount,
  totalValue,
  tenantName = "Nexpura",
}: InventoryClientProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchPrint, setShowBatchPrint] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      if (q) {
        const match =
          item.name.toLowerCase().includes(q) ||
          (item.sku?.toLowerCase() ?? "").includes(q);
        if (!match) return false;
      }
      if (filterCategory && item.category_id !== filterCategory) return false;
      if (filterType && item.item_type !== filterType) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      if (lowStockOnly) {
        const threshold = item.low_stock_threshold ?? 1;
        if (item.quantity > threshold) return false;
      }
      return true;
    });
  }, [items, search, filterCategory, filterType, filterStatus, lowStockOnly]);

  const isLowStock = (item: InventoryItem) =>
    item.quantity <= (item.low_stock_threshold ?? 1);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedItems = filtered.filter((i) => selectedIds.has(i.id)).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    retail_price: i.retail_price,
    metal_type: i.metal_type ?? null,
    stone_type: i.stone_type ?? null,
    metal_weight_grams: i.metal_weight_grams ?? null,
    barcode_value: i.barcode_value ?? null,
  }));

  return (
    <div className="space-y-6">
      {showBatchPrint && selectedItems.length > 0 && (
        <BatchPrintModal
          items={selectedItems}
          tenantName={tenantName}
          onClose={() => setShowBatchPrint(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Inventory</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBatchPrint(true)}
              className="flex items-center gap-2 bg-forest text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-forest/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Tags ({selectedIds.size})
            </button>
          )}
          <Link
            href="/inventory/new"
            className="flex items-center gap-2 bg-sage text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-sage/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-platinum p-5">
          <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-1">Total Items</p>
          <p className="font-fraunces text-2xl font-semibold text-forest">{totalItems}</p>
        </div>
        <div className="bg-white rounded-xl border border-platinum p-5">
          <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-1">Low Stock</p>
          <p className={`font-fraunces text-2xl font-semibold ${lowStockCount > 0 ? "text-red-500" : "text-forest"}`}>
            {lowStockCount}
          </p>
          {lowStockCount > 0 && (
            <p className="text-xs text-red-400 mt-0.5">Needs restocking</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-platinum p-5">
          <p className="text-xs font-medium text-forest/50 uppercase tracking-wider mb-1">Total Value</p>
          <p className="font-fraunces text-2xl font-semibold text-forest">
            £{totalValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-forest/40 mt-0.5">Retail value</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-platinum p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-platinum rounded-lg bg-ivory focus:outline-none focus:border-sage transition-colors text-forest placeholder:text-forest/30"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-platinum rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2 transition-colors ${viewMode === "grid" ? "bg-sage text-white" : "text-forest/50 hover:text-forest"}`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 transition-colors ${viewMode === "list" ? "bg-sage text-white" : "text-forest/50 hover:text-forest"}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-platinum rounded-lg px-3 py-2 bg-ivory text-forest focus:outline-none focus:border-sage"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-platinum rounded-lg px-3 py-2 bg-ivory text-forest focus:outline-none focus:border-sage"
          >
            <option value="">All Types</option>
            {Object.entries(ITEM_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-platinum rounded-lg px-3 py-2 bg-ivory text-forest focus:outline-none focus:border-sage"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="sold">Sold</option>
            <option value="consignment">Consignment</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-forest cursor-pointer select-none">
            <div
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${lowStockOnly ? "bg-sage" : "bg-platinum"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${lowStockOnly ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            Low stock only
          </label>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-platinum p-12 text-center">
          <div className="w-16 h-16 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="font-fraunces text-lg text-forest">No items found</p>
          <p className="text-forest/50 text-sm mt-1">
            {search || filterCategory || filterType || filterStatus || lowStockOnly
              ? "Try adjusting your filters"
              : "Add your first inventory item to get started"}
          </p>
          {!search && !filterCategory && !filterType && !filterStatus && !lowStockOnly && (
            <Link href="/inventory/new" className="inline-flex items-center gap-2 mt-4 bg-sage text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage/90 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </Link>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const lowStock = isLowStock(item);
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-all group relative ${
                  isSelected ? "border-sage ring-1 ring-sage" : "border-platinum hover:border-sage/40"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(item.id)}
                  className={`absolute top-3 left-3 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected ? "bg-sage border-sage" : "bg-white border-platinum hover:border-sage"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                {/* Image */}
                <Link href={`/inventory/${item.id}`}>
                <div className="w-full aspect-square rounded-lg bg-ivory border border-platinum/50 flex items-center justify-center mb-3 overflow-hidden">
                  {item.primary_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.primary_image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-forest/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium text-forest group-hover:text-sage transition-colors line-clamp-2 flex-1">{item.name}</p>
                    <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                      lowStock ? "bg-red-50 text-red-600 border border-red-200" : "bg-sage/10 text-sage"
                    }`}>
                      {item.quantity}
                    </span>
                  </div>
                  {item.sku && (
                    <p className="text-xs text-forest/40 font-mono">{item.sku}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-forest/40">
                      {item.stock_categories?.name || ITEM_TYPE_LABELS[item.item_type] || item.item_type}
                    </span>
                    <span className="text-sm font-semibold text-forest">
                      £{item.retail_price.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {lowStock && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Low stock
                    </p>
                  )}
                </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="bg-white rounded-xl border border-platinum overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-platinum bg-ivory/50">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">Retail</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-forest/50 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum/50">
                {filtered.map((item) => {
                  const lowStock = isLowStock(item);
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className={`hover:bg-ivory/30 transition-colors ${isSelected ? "bg-sage/5" : ""}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected ? "bg-sage border-sage" : "bg-white border-platinum hover:border-sage"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-forest/50">{item.sku || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/inventory/${item.id}`} className="font-medium text-forest hover:text-sage transition-colors">
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-forest/60">
                        {item.stock_categories?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-forest/60">
                        {ITEM_TYPE_LABELS[item.item_type] || item.item_type}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-medium ${
                          lowStock ? "bg-red-50 text-red-600 border border-red-200" : "text-forest"
                        }`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-forest/60">
                        {item.cost_price != null ? `£${item.cost_price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-forest">
                        £{item.retail_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[item.status] || ""}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/inventory/${item.id}`} className="text-forest/40 hover:text-sage transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
