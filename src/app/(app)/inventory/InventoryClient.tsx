"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BatchPrintModal from "./BatchPrintModal";
import StatusBadge from "@/components/StatusBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_ITEMS = [
  { id: "s1", sku: "NX-RNG-001", name: "Diamond Solitaire Ring", category: "Rings", metal: "18k White Gold", stone: "Round Diamond", carat: "1.20ct", price: "$8,500", qty: 1, status: "In Stock" },
  { id: "s2", sku: "NX-BRC-002", name: "Yellow Gold Tennis Bracelet", category: "Bracelets", metal: "18k Yellow Gold", stone: "Natural Diamond", carat: "4.50ct", price: "$12,400", qty: 1, status: "In Stock" },
  { id: "s3", sku: "NX-PND-003", name: "Sapphire Halo Pendant", category: "Pendants", metal: "Platinum", stone: "Blue Sapphire", carat: "2.10ct", price: "$6,200", qty: 2, status: "In Stock" },
  { id: "s4", sku: "NX-RNG-004", name: "Oval Lab Diamond Ring", category: "Rings", metal: "18k Rose Gold", stone: "Lab Diamond", carat: "1.80ct", price: "$5,800", qty: 0, status: "Out of Stock" },
  { id: "s5", sku: "NX-EAR-005", name: "Diamond Stud Earrings", category: "Earrings", metal: "18k White Gold", stone: "Round Diamond", carat: "0.80ct", price: "$3,200", qty: 3, status: "In Stock" },
  { id: "s6", sku: "NX-WTC-006", name: "Ladies' Diamond Watch", category: "Watches", metal: "18k White Gold", stone: "Round Diamond", carat: "0.50ct", price: "$18,000", qty: 1, status: "Low Stock" },
];

// ─── Diamond placeholder SVG ──────────────────────────────────────────────────

const DiamondPlaceholder = () => (
  <div className="w-10 h-10 rounded-lg bg-[#F8F7F5] border border-[#E8E6E1] flex items-center justify-center flex-shrink-0">
    <svg className="w-5 h-5 text-[#D0CCC7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  </div>
);

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [filterMetal, setFilterMetal] = useState("");
  const [filterStone, setFilterStone] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchPrint, setShowBatchPrint] = useState(false);

  const useSampleData = items.length === 0;

  const filtered = useMemo(() => {
    if (useSampleData) return SAMPLE_ITEMS;
    return items.filter((item) => {
      const q = search.toLowerCase();
      if (q && !item.name.toLowerCase().includes(q) && !(item.sku?.toLowerCase() ?? "").includes(q)) return false;
      if (filterCategory && item.category_id !== filterCategory) return false;
      if (filterMetal && item.metal_type !== filterMetal) return false;
      if (filterStone && item.stone_type !== filterStone) return false;
      if (filterStatus === "in_stock" && item.quantity <= 0) return false;
      if (filterStatus === "out_of_stock" && item.quantity > 0) return false;
      if (filterStatus === "low_stock") {
        const t = item.low_stock_threshold ?? 1;
        if (item.quantity > t || item.quantity <= 0) return false;
      }
      return true;
    });
  }, [items, useSampleData, search, filterCategory, filterMetal, filterStone, filterStatus]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (useSampleData) return;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  }

  const selectedItems = (useSampleData ? [] : items)
    .filter((i) => selectedIds.has(i.id))
    .map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      retail_price: i.retail_price,
      metal_type: i.metal_type ?? null,
      stone_type: i.stone_type ?? null,
      metal_weight_grams: i.metal_weight_grams ?? null,
      barcode_value: i.barcode_value ?? null,
    }));

  const displayTotal = useSampleData ? 284 : totalItems;
  const displayInStock = useSampleData ? 261 : items.filter((i) => i.quantity > 0).length;
  const displayLowStock = useSampleData ? 5 : lowStockCount;
  const displayValue = useSampleData ? "$1.2M" : fmtCurrency(totalValue);

  return (
    <div className="space-y-5">
      {showBatchPrint && selectedItems.length > 0 && (
        <BatchPrintModal
          items={selectedItems}
          tenantName={tenantName}
          onClose={() => setShowBatchPrint(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">Inventory</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-white border border-[#E8E6E1] text-[#6B6B6B] px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#F8F7F5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <button className="flex items-center gap-2 bg-white border border-[#E8E6E1] text-[#6B6B6B] px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#F8F7F5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Tags
          </button>
          <Link
            href="/inventory/new"
            className="flex items-center gap-2 bg-[#1a4731] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a4731]/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Items", value: String(displayTotal) },
          { label: "In Stock", value: String(displayInStock) },
          { label: "Low Stock", value: String(displayLowStock), warn: displayLowStock > 0 },
          { label: "Total Value", value: displayValue },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-[#E8E6E1] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">{s.label}</p>
            <p className={`text-xl font-semibold mt-1 ${s.warn ? "text-amber-600" : "text-[#1C1C1E]"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-[#F8F7F5] border border-[#E8E6E1] rounded-lg text-[#1C1C1E] placeholder-[#C0C0C0] focus:outline-none focus:border-[#1a4731]"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0C0C0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="py-2 px-3 text-sm bg-[#F8F7F5] border border-[#E8E6E1] rounded-lg text-[#6B6B6B] focus:outline-none focus:border-[#1a4731] min-w-[130px]"
        >
          <option value="">All Categories</option>
          <option value="rings">Rings</option>
          <option value="necklaces">Necklaces</option>
          <option value="bracelets">Bracelets</option>
          <option value="earrings">Earrings</option>
          <option value="pendants">Pendants</option>
          <option value="watches">Watches</option>
          <option value="loose_stones">Loose Stones</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterMetal}
          onChange={(e) => setFilterMetal(e.target.value)}
          className="py-2 px-3 text-sm bg-[#F8F7F5] border border-[#E8E6E1] rounded-lg text-[#6B6B6B] focus:outline-none focus:border-[#1a4731] min-w-[130px]"
        >
          <option value="">All Metals</option>
          <option value="18k_yellow">18k Yellow</option>
          <option value="18k_white">18k White</option>
          <option value="18k_rose">18k Rose</option>
          <option value="platinum">Platinum</option>
          <option value="silver">Silver</option>
          <option value="two_tone">Two-tone</option>
        </select>
        <select
          value={filterStone}
          onChange={(e) => setFilterStone(e.target.value)}
          className="py-2 px-3 text-sm bg-[#F8F7F5] border border-[#E8E6E1] rounded-lg text-[#6B6B6B] focus:outline-none focus:border-[#1a4731] min-w-[130px]"
        >
          <option value="">All Stones</option>
          <option value="diamond">Diamond</option>
          <option value="sapphire">Sapphire</option>
          <option value="emerald">Emerald</option>
          <option value="ruby">Ruby</option>
          <option value="pearl">Pearl</option>
          <option value="none">No Stone</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="py-2 px-3 text-sm bg-[#F8F7F5] border border-[#E8E6E1] rounded-lg text-[#6B6B6B] focus:outline-none focus:border-[#1a4731] min-w-[130px]"
        >
          <option value="">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-[#1a4731] text-white rounded-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedIds.size} items selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowBatchPrint(true)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              Print Tags
            </button>
            <button className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              Export
            </button>
            <button className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">
              Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-white/60 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E8E6E1] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F0EDE9]">
                <th className="px-4 py-3 bg-[#F8F7F5] w-8">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-[#D0CCC7] accent-[#1a4731]"
                    onChange={toggleAll}
                    checked={!useSampleData && selectedIds.size === filtered.length && filtered.length > 0}
                  />
                </th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A] w-12">Photo</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Name / SKU</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Category</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Metal</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Stone</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Carat</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-right text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Price</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-center text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Qty</th>
                <th className="px-4 py-3 bg-[#F8F7F5] text-left text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Status</th>
                <th className="px-4 py-3 bg-[#F8F7F5]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F3F0]">
              {useSampleData
                ? SAMPLE_ITEMS.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8F7F5] transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="w-3.5 h-3.5 rounded border-[#D0CCC7] accent-[#1a4731]" disabled />
                      </td>
                      <td className="px-4 py-3"><DiamondPlaceholder /></td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#1C1C1E]">{item.name}</p>
                        <p className="text-xs text-[#9A9A9A] font-mono">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6B6B6B]">{item.category}</td>
                      <td className="px-4 py-3 text-sm text-[#6B6B6B]">{item.metal}</td>
                      <td className="px-4 py-3 text-sm text-[#6B6B6B]">{item.stone}</td>
                      <td className="px-4 py-3 text-sm text-[#6B6B6B]">{item.carat}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#1C1C1E] text-right">{item.price}</td>
                      <td className="px-4 py-3 text-sm text-[#6B6B6B] text-center">{item.qty}</td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3">
                        <button className="text-[#9A9A9A] hover:text-[#1C1C1E] transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                : filtered.map((item) => {
                    const isLow = item.quantity <= (item.low_stock_threshold ?? 1) && item.quantity > 0;
                    const isOut = item.quantity === 0;
                    const stockStatus = isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";
                    return (
                      <tr key={item.id} className="hover:bg-[#F8F7F5] transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="w-3.5 h-3.5 rounded border-[#D0CCC7] accent-[#1a4731]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {item.primary_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.primary_image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <DiamondPlaceholder />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-[#1C1C1E]">{item.name}</p>
                          <p className="text-xs text-[#9A9A9A] font-mono">{item.sku || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{item.stock_categories?.name || item.jewellery_type || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{item.metal_type || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">{item.stone_type || "—"}</td>
                        <td className="px-4 py-3 text-sm text-[#6B6B6B]">—</td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#1C1C1E] text-right">
                          ${item.retail_price.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-[#6B6B6B]">{item.quantity}</td>
                        <td className="px-4 py-3"><StatusBadge status={stockStatus} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/inventory/${item.id}`}
                              className="text-xs text-[#1a4731] font-semibold hover:underline"
                            >
                              →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
