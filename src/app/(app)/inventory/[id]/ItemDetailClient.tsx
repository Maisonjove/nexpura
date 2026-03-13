"use client";

import { useState } from "react";
import Link from "next/link";
import StockAdjustModal from "./StockAdjustModal";
import PrintTagModal from "./PrintTagModal";
import { archiveInventoryItem } from "../actions";

interface Movement {
  id: string;
  movement_type: string;
  quantity_change: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  users: { full_name: string | null } | null;
}

interface InventoryItem {
  id: string;
  sku: string | null;
  barcode: string | null;
  barcode_value?: string | null;
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
  stock_categories: { name: string } | null;
}

interface ItemDetailClientProps {
  item: InventoryItem;
  movements: Movement[];
  tenantName?: string;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  finished_piece: "Finished Piece",
  loose_stone: "Loose Stone",
  finding: "Finding",
  raw_material: "Raw Material",
  packaging: "Packaging",
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase: "Purchase",
  sale: "Sale",
  adjustment: "Adjustment",
  return: "Return",
  damage: "Damage",
  transfer: "Transfer",
};

const MOVEMENT_COLORS: Record<string, string> = {
  purchase: "text-green-600 bg-green-50",
  sale: "text-blue-600 bg-blue-50",
  adjustment: "text-amber-600 bg-amber-50",
  return: "text-stone-700 bg-stone-100",
  damage: "text-red-600 bg-red-50",
  transfer: "text-gray-600 bg-gray-50",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700 border border-green-200",
  inactive: "bg-gray-50 text-gray-600 border border-gray-200",
  sold: "bg-stone-100 text-stone-700 border border-blue-200",
  consignment: "bg-amber-50 text-amber-700 border border-amber-200",
};

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2 border-b border-stone-100 last:border-0">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-sm font-medium text-stone-900 capitalize">{String(value)}</span>
    </div>
  );
}

export default function ItemDetailClient({ item, movements, tenantName = "Nexpura" }: ItemDetailClientProps) {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showPrintTag, setShowPrintTag] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const isLowStock = item.quantity <= (item.low_stock_threshold ?? 1);
  const margin =
    item.cost_price != null && item.retail_price > 0
      ? (((item.retail_price - item.cost_price) / item.retail_price) * 100).toFixed(1)
      : null;

  async function handleArchive() {
    setArchiving(true);
    try {
      await archiveInventoryItem(item.id);
    } catch {
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  }

  const tagItem = {
    id: item.id,
    name: item.name,
    sku: item.sku,
    retail_price: item.retail_price,
    metal_type: item.metal_type,
    stone_type: item.stone_type,
    metal_weight_grams: item.metal_weight_grams,
    barcode_value: item.barcode_value ?? null,
  };

  return (
    <>
      {showAdjustModal && (
        <StockAdjustModal
          inventoryId={item.id}
          currentQty={item.quantity}
          onClose={() => setShowAdjustModal(false)}
        />
      )}
      {showPrintTag && (
        <PrintTagModal
          item={tagItem}
          tenantName={tenantName}
          onClose={() => setShowPrintTag(false)}
        />
      )}

      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowArchiveConfirm(false)} />
          <div className="relative bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-lg font-semibold text-stone-900 mb-2">Archive Item?</h3>
            <p className="text-sm text-stone-500 mb-6">This item will be soft-deleted and hidden from your inventory. This cannot be easily undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowArchiveConfirm(false)} className="flex-1 py-2.5 text-sm font-medium text-stone-900 border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex-1 py-2.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {archiving ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Link href="/inventory" className="hover:text-[#8B7355] transition-colors">Inventory</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-stone-900 truncate max-w-[200px]">{item.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="font-semibold text-2xl font-semibold text-stone-900">{item.name}</h1>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {item.sku && (
                      <span className="text-xs font-mono bg-stone-50 border border-stone-200 px-2 py-0.5 rounded text-stone-500">
                        {item.sku}
                      </span>
                    )}
                    {item.stock_categories && (
                      <span className="text-xs bg-stone-100 text-[#8B7355] px-2 py-0.5 rounded">
                        {item.stock_categories.name}
                      </span>
                    )}
                    <span className="text-xs bg-stone-50 border border-stone-200 text-stone-500 px-2 py-0.5 rounded capitalize">
                      {ITEM_TYPE_LABELS[item.item_type] || item.item_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[item.status] || ""}`}>
                      {item.status}
                    </span>
                    {item.is_featured && (
                      <span className="text-xs bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Featured
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setShowPrintTag(true)}
                    className="px-4 py-2 text-sm font-medium text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Tag
                  </button>
                  <Link
                    href={`/inventory/${item.id}/edit`}
                    className="px-4 py-2 text-sm font-medium text-stone-900 border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Archive
                  </button>
                </div>
              </div>

              {item.description && (
                <p className="mt-4 text-sm text-stone-500 border-t border-stone-200 pt-4">{item.description}</p>
              )}
            </div>

            {/* Specifications */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="font-semibold text-lg font-semibold text-stone-900 mb-4">Specifications</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <div>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Metal</p>
                  <SpecRow label="Type" value={item.metal_type} />
                  <SpecRow label="Colour" value={item.metal_colour} />
                  <SpecRow label="Purity" value={item.metal_purity} />
                  <SpecRow label="Weight" value={item.metal_weight_grams != null ? `${item.metal_weight_grams}g` : null} />
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Stone</p>
                  <SpecRow label="Type" value={item.stone_type} />
                  <SpecRow label="Carat" value={item.stone_carat != null ? `${item.stone_carat}ct` : null} />
                  <SpecRow label="Colour" value={item.stone_colour} />
                  <SpecRow label="Clarity" value={item.stone_clarity} />
                </div>
                {(item.ring_size || item.dimensions || item.barcode || item.jewellery_type) && (
                  <div className="sm:col-span-2 mt-4">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Other</p>
                    <SpecRow label="Jewellery Type" value={item.jewellery_type} />
                    <SpecRow label="Ring Size" value={item.ring_size} />
                    <SpecRow label="Dimensions" value={item.dimensions} />
                    <SpecRow label="Barcode" value={item.barcode} />
                    <SpecRow label="Stock Tag Barcode" value={item.barcode_value} />
                  </div>
                )}
                {(item.supplier_name || item.supplier_sku) && (
                  <div className="sm:col-span-2 mt-4">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Supplier</p>
                    <SpecRow label="Name" value={item.supplier_name} />
                    <SpecRow label="SKU" value={item.supplier_sku} />
                  </div>
                )}
              </div>
            </div>

            {/* Stock Movement History */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="font-semibold text-lg font-semibold text-stone-900 mb-4">Stock Movement History</h2>
              {movements.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">No movements recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200">
                        <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                        <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Type</th>
                        <th className="text-right pb-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Change</th>
                        <th className="text-right pb-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Qty After</th>
                        <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wider">Notes</th>
                        <th className="text-left pb-3 text-xs font-medium text-stone-500 uppercase tracking-wider">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-platinum/50">
                      {movements.map((m) => (
                        <tr key={m.id} className="hover:bg-stone-50/30 transition-colors">
                          <td className="py-3 text-stone-500 whitespace-nowrap">
                            {new Date(m.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MOVEMENT_COLORS[m.movement_type] || "text-gray-600 bg-gray-50"}`}>
                              {MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type}
                            </span>
                          </td>
                          <td className={`py-3 text-right font-semibold ${m.quantity_change > 0 ? "text-green-600" : "text-red-500"}`}>
                            {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                          </td>
                          <td className="py-3 text-right text-stone-900 font-medium">{m.quantity_after}</td>
                          <td className="py-3 text-stone-500 max-w-[200px] truncate">{m.notes || "—"}</td>
                          <td className="py-3 text-stone-400 whitespace-nowrap">
                            {m.users?.full_name || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right column — Stock panel */}
          <div className="space-y-4">
            {/* Stock level */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Current Stock</p>
              <p className={`font-semibold text-5xl font-semibold ${isLowStock && item.track_quantity ? "text-red-500" : "text-stone-900"}`}>
                {item.quantity}
              </p>
              <p className="text-sm text-stone-400 mt-1">units in stock</p>

              {isLowStock && item.track_quantity && (
                <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-lg">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Low stock — reorder soon
                </div>
              )}

              {!item.track_quantity && (
                <p className="text-xs text-stone-400 mt-2">Quantity tracking disabled</p>
              )}

              <button
                onClick={() => setShowAdjustModal(true)}
                className="w-full mt-4 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] transition-colors"
              >
                Adjust Stock
              </button>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-4">Pricing</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-stone-500">Cost</span>
                  <span className="text-sm font-medium text-stone-900">
                    {item.cost_price != null ? `£${item.cost_price.toFixed(2)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-stone-500">Wholesale</span>
                  <span className="text-sm font-medium text-stone-900">
                    {item.wholesale_price != null ? `£${item.wholesale_price.toFixed(2)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-stone-200 pt-3">
                  <span className="text-sm font-medium text-stone-900">Retail</span>
                  <span className="font-semibold text-lg font-semibold text-stone-900">
                    £{item.retail_price.toFixed(2)}
                  </span>
                </div>
                {margin !== null && (
                  <div className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                    parseFloat(margin) >= 50
                      ? "bg-green-50"
                      : parseFloat(margin) >= 25
                      ? "bg-amber-50"
                      : "bg-red-50"
                  }`}>
                    <span className="text-sm text-stone-500">Margin</span>
                    <span className={`text-sm font-semibold ${
                      parseFloat(margin) >= 50 ? "text-green-700" : parseFloat(margin) >= 25 ? "text-amber-700" : "text-red-600"
                    }`}>
                      {margin}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Actions</p>
              <div className="space-y-2">
                <button
                  onClick={() => setShowPrintTag(true)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Stock Tag
                </button>
                <Link
                  href={`/inventory/${item.id}/edit`}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-stone-900 border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Item Details
                </Link>
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Archive Item
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
