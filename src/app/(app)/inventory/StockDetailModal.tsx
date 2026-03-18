"use client";

import { useState, useTransition } from "react";
import { X, Edit2, Save, Printer, Globe, Trash2, Package, Check, AlertCircle } from "lucide-react";
import { updateStockPrices, updateStockStatus, listOnWebsite, archiveStockItem } from "./actions";
import QuickPrintTagModal from "@/components/QuickPrintTagModal";

interface StockItem {
  id: string;
  stock_number: string | null;
  sku: string | null;
  name: string;
  description?: string | null;
  item_type: string;
  jewellery_type: string | null;
  cost_price: number | null;
  retail_price: number;
  quantity: number;
  status: string;
  supplier_name?: string | null;
  supplier?: { name: string } | null;
  primary_image: string | null;
  is_consignment: boolean;
  listed_on_website: boolean;
  metal_type?: string | null;
  stone_type?: string | null;
  metal_weight_grams?: number | null;
  barcode_value?: string | null;
  tags?: string[] | null;
  created_at?: string;
}

interface StockDetailModalProps {
  item: StockItem;
  tenantName: string;
  canViewCost: boolean;
  hasWebsite: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const STATUS_OPTIONS = [
  { value: "available", label: "Available", color: "emerald" },
  { value: "sold", label: "Sold", color: "blue" },
  { value: "unavailable", label: "Unavailable", color: "red" },
  { value: "reserved", label: "Reserved", color: "amber" },
];

export default function StockDetailModal({
  item,
  tenantName,
  canViewCost,
  hasWebsite,
  onClose,
  onUpdate,
}: StockDetailModalProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit state
  const [editData, setEditData] = useState({
    costPrice: item.cost_price?.toString() || "",
    retailPrice: item.retail_price.toString(),
    status: item.status,
  });

  const handleSave = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateStockPrices(
          item.id,
          editData.costPrice ? parseFloat(editData.costPrice) : null,
          parseFloat(editData.retailPrice)
        );
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess("Prices updated successfully");
          setIsEditing(false);
          onUpdate?.();
          setTimeout(() => setSuccess(null), 2000);
        }
      } catch {
        setError("Failed to update prices");
      }
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateStockStatus(item.id, newStatus);
        if (result.error) {
          setError(result.error);
        } else {
          setEditData({ ...editData, status: newStatus });
          setSuccess("Status updated");
          onUpdate?.();
          setTimeout(() => setSuccess(null), 2000);
        }
      } catch {
        setError("Failed to update status");
      }
    });
  };

  const handleListOnWebsite = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await listOnWebsite(item.id);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess("Listed on website");
          onUpdate?.();
          setTimeout(() => setSuccess(null), 2000);
        }
      } catch {
        setError("Failed to list on website");
      }
    });
  };

  const handleDelete = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await archiveStockItem(item.id);
        if (result.error) {
          setError(result.error);
        } else {
          onUpdate?.();
          onClose();
        }
      } catch {
        setError("Failed to delete item");
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
    const colorClasses = {
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      red: "bg-red-50 text-red-700 border-red-200",
      amber: "bg-amber-50 text-amber-700 border-amber-200",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses[config.color as keyof typeof colorClasses]}`}>
        {config.label}
      </span>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-stone-100">
            <div className="flex items-center gap-4">
              {item.primary_image ? (
                <img
                  src={item.primary_image}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
                  <Package className="w-6 h-6 text-stone-400" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {item.stock_number || item.sku || "—"}
                  </span>
                  {item.is_consignment && (
                    <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      Consignment
                    </span>
                  )}
                  {item.listed_on_website && (
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <Globe className="w-3 h-3" /> On Website
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-stone-900 mt-1">{item.name}</h2>
                {item.description && (
                  <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{item.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-sm text-emerald-600">
              <Check className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-240px)]">
            {/* Status */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-500 mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => handleStatusChange(status.value)}
                    disabled={isPending}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      editData.status === status.value
                        ? status.color === "emerald"
                          ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500"
                          : status.color === "blue"
                          ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500"
                          : status.color === "red"
                          ? "bg-red-100 text-red-700 ring-2 ring-red-500"
                          : "bg-amber-100 text-amber-700 ring-2 ring-amber-500"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    } disabled:opacity-50`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Item Type</label>
                <p className="text-stone-900 capitalize">{item.jewellery_type || item.item_type}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1">Quantity</label>
                <p className="text-stone-900">{item.quantity}</p>
              </div>
              {item.metal_type && (
                <div>
                  <label className="block text-sm font-medium text-stone-500 mb-1">Metal</label>
                  <p className="text-stone-900">{item.metal_type}</p>
                </div>
              )}
              {item.stone_type && (
                <div>
                  <label className="block text-sm font-medium text-stone-500 mb-1">Stone</label>
                  <p className="text-stone-900">{item.stone_type}</p>
                </div>
              )}
              {(item.supplier?.name || item.supplier_name) && (
                <div>
                  <label className="block text-sm font-medium text-stone-500 mb-1">Supplier</label>
                  <p className="text-stone-900">{item.supplier?.name || item.supplier_name}</p>
                </div>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-stone-500 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-1 bg-stone-100 text-stone-600 text-xs rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pricing Section */}
            <div className="bg-stone-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-stone-900">Pricing</h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="text-sm text-stone-500 hover:text-stone-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isPending}
                      className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {canViewCost && (
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Cost Price</label>
                    {isEditing ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editData.costPrice}
                          onChange={(e) => setEditData({ ...editData, costPrice: e.target.value })}
                          className="w-full pl-7 pr-4 py-2 rounded-lg border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    ) : (
                      <p className="text-lg font-semibold text-stone-900">
                        ${item.cost_price?.toLocaleString() || "—"}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Sales Price</label>
                  {isEditing ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editData.retailPrice}
                        onChange={(e) => setEditData({ ...editData, retailPrice: e.target.value })}
                        className="w-full pl-7 pr-4 py-2 rounded-lg border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-stone-900">
                      ${item.retail_price.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setShowPrintModal(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50 transition-all"
              >
                <Printer className="w-5 h-5 text-stone-600" />
                <span className="text-sm font-medium text-stone-700">Print Tag</span>
              </button>

              {hasWebsite && !item.listed_on_website && (
                <button
                  onClick={handleListOnWebsite}
                  disabled={isPending}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-stone-200 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                  <Globe className="w-5 h-5 text-stone-600" />
                  <span className="text-sm font-medium text-stone-700">List on Web</span>
                </button>
              )}

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-stone-200 hover:border-red-400 hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-5 h-5 text-stone-600" />
                <span className="text-sm font-medium text-stone-700">Archive</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 bg-stone-50">
            <div className="text-xs text-stone-400">
              {item.created_at && `Added ${new Date(item.created_at).toLocaleDateString()}`}
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-stone-200 text-stone-700 font-medium hover:bg-stone-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-stone-900 mb-2">Archive Item?</h3>
            <p className="text-sm text-stone-500 mb-4">
              This will remove the item from your active inventory. You can restore it later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-stone-200 text-stone-600 font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Tag Modal */}
      {showPrintModal && (
        <QuickPrintTagModal
          item={{
            id: item.id,
            name: item.name,
            sku: item.stock_number || item.sku,
            retail_price: item.retail_price,
            metal_type: item.metal_type ?? null,
            stone_type: item.stone_type ?? null,
            metal_weight_grams: item.metal_weight_grams ?? null,
            barcode_value: item.barcode_value || item.stock_number || item.sku || item.id.substring(0, 12).toUpperCase(),
          }}
          tenantName={tenantName}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </>
  );
}
