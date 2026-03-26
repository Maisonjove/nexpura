"use client";

import Image from "next/image";
import type { InventoryItem } from "./types";
import { CATEGORIES, CATEGORY_LABELS } from "./constants";

interface ProductGridProps {
  items: InventoryItem[];
  search: string;
  setSearch: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  onAddToCart: (item: InventoryItem) => void;
  onOpenCameraScanner: () => void;
  onOpenRefund?: () => void;
}

export default function ProductGrid({
  items,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  onAddToCart,
  onOpenCameraScanner,
  onOpenRefund,
}: ProductGridProps) {
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      categoryFilter === "All" || item.jewellery_type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-w-0">
      {/* Search */}
      <div className="p-4 bg-white border-b border-stone-200 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search inventory by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          {onOpenRefund && (
            <button
              onClick={onOpenRefund}
              title="Process Refund"
              className="px-3 py-2 border border-stone-200 rounded-xl text-stone-500 hover:border-red-400 hover:text-red-600 transition-colors text-sm font-medium"
            >
              Refund
            </button>
          )}
          <button
            onClick={onOpenCameraScanner}
            className="px-3 py-2 border border-stone-200 rounded-xl text-stone-500 hover:border-amber-600 hover:text-amber-700 transition-colors text-lg"
            title="Scan barcode with camera"
          >
            📷
          </button>
        </div>
        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-amber-700 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">No items found</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onAddToCart(item)}
                className="bg-white border border-stone-200 rounded-xl p-3 text-left hover:border-amber-600 hover:shadow-sm transition-all group"
              >
                <div className="aspect-square w-full mb-2 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
                  {item.primary_image ? (
                    <Image
                      src={item.primary_image}
                      alt={item.name}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <svg className="w-8 h-8 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  )}
                </div>
                <p className="text-xs font-semibold text-stone-900 truncate">{item.name}</p>
                {item.sku && <p className="text-[10px] text-stone-400 font-mono">{item.sku}</p>}
                <p className="text-sm font-bold text-amber-700 mt-1">${item.retail_price.toFixed(2)}</p>
                <p className="text-[10px] text-stone-400">Qty: {item.quantity}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
