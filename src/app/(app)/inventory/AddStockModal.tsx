"use client";

import { useState, useTransition, useEffect } from "react";
import { X, ChevronDown, Plus, Package, Upload, Loader2, Circle, Link2, Watch, Gem, Sparkles, Star } from "lucide-react";
import { quickAddStock, createQuickSupplier, getSuppliersList } from "./actions";

interface Supplier {
  id: string;
  name: string;
}

interface AddStockModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  suppliers: Supplier[];
}

const ITEM_TYPES = [
  { value: "ring", label: "Ring", Icon: Circle },
  { value: "necklace", label: "Necklace", Icon: Link2 },
  { value: "bracelet", label: "Bracelet", Icon: Circle },
  { value: "watch", label: "Watch", Icon: Watch },
  { value: "earrings", label: "Earrings", Icon: Gem },
  { value: "pendant", label: "Pendant", Icon: Sparkles },
  { value: "other", label: "Other", Icon: Star },
];

export default function AddStockModal({ onClose, onSuccess, suppliers: initialSuppliers }: AddStockModalProps) {
  const [isPending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    itemType: "ring",
    description: "",
    supplierId: "",
    costPrice: "",
    salesPrice: "",
    tags: "",
    isConsignment: false,
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    
    setCreatingSupplier(true);
    try {
      const result = await createQuickSupplier(newSupplierName.trim());
      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        setSuppliers([...suppliers, { id: result.id, name: newSupplierName.trim() }]);
        setFormData({ ...formData, supplierId: result.id });
        setNewSupplierName("");
        setShowNewSupplier(false);
      }
    } catch {
      setError("Failed to create supplier");
    }
    setCreatingSupplier(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const form = new FormData();
    form.append("item_type", formData.itemType);
    form.append("description", formData.description);
    form.append("supplier_id", formData.supplierId);
    form.append("cost_price", formData.costPrice);
    form.append("retail_price", formData.salesPrice);
    form.append("tags", formData.tags);
    form.append("is_consignment", formData.isConsignment.toString());
    
    // Image would need to be uploaded to storage first in a real implementation
    // For now, we'll just submit the form data
    
    startTransition(async () => {
      try {
        const result = await quickAddStock(form);
        if (result.error) {
          setError(result.error);
        } else {
          onSuccess?.();
          onClose();
        }
      } catch {
        setError("Failed to add stock");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Add Stock</h2>
              <p className="text-xs text-stone-500">Quick add new inventory item</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Item Type Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Item Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ITEM_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, itemType: type.value })}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    formData.itemType === type.value
                      ? "border-amber-500 bg-amber-50 shadow-sm"
                      : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  <type.Icon className={`w-6 h-6 ${formData.itemType === type.value ? "text-amber-600" : "text-stone-400"}`} strokeWidth={1.5} />
                  <span className="text-xs font-medium text-stone-700">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="18ct Yellow Gold Diamond Ring, 0.5ct center stone..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none text-sm"
              required
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Supplier
            </label>
            {!showNewSupplier ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none bg-white text-sm"
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewSupplier(true)}
                  className="px-3 py-2.5 rounded-xl border border-dashed border-stone-300 hover:border-amber-500 hover:bg-amber-50 transition-all text-amber-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="New supplier name..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateSupplier}
                  disabled={creatingSupplier || !newSupplierName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {creatingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSupplier(false);
                    setNewSupplierName("");
                  }}
                  className="px-3 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  <X className="w-4 h-4 text-stone-500" />
                </button>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Cost Price
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Sales Price
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.salesPrice}
                  onChange={(e) => setFormData({ ...formData, salesPrice: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Tags / Categories
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="diamond, engagement, gold (comma separated)"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Image (optional)
            </label>
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 hover:border-amber-400 transition-colors">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 cursor-pointer py-4">
                  <Upload className="w-8 h-8 text-stone-300" />
                  <span className="text-sm text-stone-500">Click to upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Consignment Toggle */}
          <label className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 hover:border-amber-300 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={formData.isConsignment}
              onChange={(e) => setFormData({ ...formData, isConsignment: e.target.checked })}
              className="w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <p className="font-medium text-stone-900">Consignment Item</p>
              <p className="text-xs text-stone-500">This item belongs to a consignor</p>
            </div>
          </label>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-stock-form"
            onClick={handleSubmit}
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-medium hover:from-amber-700 hover:to-amber-800 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Stock
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
