"use client";

import { useState, useRef, useTransition, useCallback, useEffect } from "react";
import {
  X, Camera, Upload, FileText, Loader2, Check, AlertCircle,
  ChevronDown, Plus, Sparkles, Package, ArrowRight, CheckCircle2
} from "lucide-react";
import { parseInvoiceImage, ExtractedItem } from "@/lib/ai/invoice-parser";
import { quickAddStock, createQuickSupplier } from "./actions";

interface Supplier {
  id: string;
  name: string;
}

interface ScanInvoiceModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  suppliers: Supplier[];
}

interface ReviewItem extends ExtractedItem {
  id: string;
  margin: number;
  salesPrice: number;
  selected: boolean;
}

const MARGIN_OPTIONS = [
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2 },
  { label: "2.5x", value: 2.5 },
  { label: "3x", value: 3 },
];

type Step = "upload" | "processing" | "review" | "importing" | "success";

export default function ScanInvoiceModal({ onClose, onSuccess, suppliers: initialSuppliers }: ScanInvoiceModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [detectedSupplierName, setDetectedSupplierName] = useState<string | null>(null);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [bulkMargin, setBulkMargin] = useState<number>(2);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Calculate total
  const selectedItems = items.filter(i => i.selected);
  const totalCost = selectedItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
  const totalSales = selectedItems.reduce((sum, item) => sum + (item.salesPrice * item.quantity), 0);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Please upload an image (JPG, PNG) or PDF file");
      return;
    }

    // For now, we only support images. PDF would need additional processing.
    if (file.type === "application/pdf") {
      setError("PDF support coming soon. Please upload a photo of the invoice for now.");
      return;
    }

    setError(null);
    
    // Read file as base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      await processImage(base64);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64Image: string) => {
    setStep("processing");
    setError(null);

    try {
      const result = await parseInvoiceImage(base64Image);
      
      if (!result.success || !result.data) {
        setError(result.error || "Failed to process invoice");
        setStep("upload");
        return;
      }

      const { supplier_name, items: extractedItems } = result.data;

      if (extractedItems.length === 0) {
        setError("No items found in the invoice. Please try a clearer image or add items manually.");
        setStep("upload");
        return;
      }

      // Set detected supplier
      if (supplier_name) {
        setDetectedSupplierName(supplier_name);
        // Try to match with existing supplier
        const matchedSupplier = suppliers.find(
          s => s.name.toLowerCase().includes(supplier_name.toLowerCase()) ||
               supplier_name.toLowerCase().includes(s.name.toLowerCase())
        );
        if (matchedSupplier) {
          setSelectedSupplierId(matchedSupplier.id);
        }
      }

      // Convert to review items with default margin
      const reviewItems: ReviewItem[] = extractedItems.map((item, index) => ({
        ...item,
        id: `item-${index}-${Date.now()}`,
        margin: bulkMargin,
        salesPrice: item.cost_price * bulkMargin,
        selected: true,
      }));

      setItems(reviewItems);
      setStep("review");
    } catch (err) {
      console.error("Processing error:", err);
      setError("Failed to process invoice. Please try again.");
      setStep("upload");
    }
  };

  const updateItemMargin = (id: string, margin: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          margin,
          salesPrice: item.cost_price * margin,
        };
      }
      return item;
    }));
  };

  const updateItemField = (id: string, field: keyof ReviewItem, value: string | number | boolean) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate sales price if cost changes
        if (field === "cost_price") {
          updated.salesPrice = Number(value) * updated.margin;
        }
        return updated;
      }
      return item;
    }));
  };

  const applyBulkMargin = (margin: number) => {
    setBulkMargin(margin);
    setItems(items.map(item => ({
      ...item,
      margin,
      salesPrice: item.cost_price * margin,
    })));
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
        setSelectedSupplierId(result.id);
        setNewSupplierName("");
        setShowNewSupplier(false);
      }
    } catch {
      setError("Failed to create supplier");
    }
    setCreatingSupplier(false);
  };

  const handleImport = async () => {
    const toImport = items.filter(i => i.selected);
    if (toImport.length === 0) {
      setError("Please select at least one item to import");
      return;
    }

    setStep("importing");
    setImportProgress(0);
    setImportedCount(0);
    setError(null);

    let successCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const item = toImport[i];
      
      try {
        const formData = new FormData();
        formData.append("description", item.description);
        formData.append("item_type", "other"); // Will be determined later
        formData.append("supplier_id", selectedSupplierId);
        formData.append("cost_price", item.cost_price.toString());
        formData.append("retail_price", item.salesPrice.toString());
        formData.append("is_consignment", "false");
        
        if (item.sku) {
          formData.append("tags", item.sku);
        }

        const result = await quickAddStock(formData);
        
        if (!result.error) {
          successCount++;
        }
      } catch (err) {
        console.error("Failed to import item:", item.description, err);
      }

      setImportProgress(((i + 1) / toImport.length) * 100);
      setImportedCount(successCount);
    }

    if (successCount > 0) {
      setStep("success");
    } else {
      setError("Failed to import items. Please try again.");
      setStep("review");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-amber-50 to-amber-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-200">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">Scan Invoice</h2>
              <p className="text-xs text-stone-500">
                {step === "upload" && "Upload an invoice to auto-extract items"}
                {step === "processing" && "Analyzing invoice with AI..."}
                {step === "review" && `Review ${items.length} extracted items`}
                {step === "importing" && "Importing items to inventory..."}
                {step === "success" && "Import complete!"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/50 transition-colors">
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto p-1 rounded hover:bg-red-100">
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          )}

          {/* Step: Upload */}
          {step === "upload" && (
            <div className="p-6 space-y-6">
              {/* Image Preview (if re-trying) */}
              {imagePreview && (
                <div className="relative rounded-xl overflow-hidden border border-stone-200">
                  <img src={imagePreview} alt="Invoice preview" className="w-full h-48 object-cover" />
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-stone-200 rounded-2xl p-8 hover:border-amber-400 transition-colors bg-stone-50/50"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-amber-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-medium text-stone-900">Upload supplier invoice</p>
                    <p className="text-sm text-stone-500 mt-1">
                      Drag and drop or click to select an image
                    </p>
                    <p className="text-xs text-stone-400 mt-2">
                      Supports JPG, PNG • PDF coming soon
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Browse Files
                    </button>
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl text-sm font-medium hover:from-amber-700 hover:to-amber-800 transition-all shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Tips */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Tips for best results</p>
                    <ul className="text-xs text-amber-700 mt-1 space-y-1">
                      <li>• Ensure the invoice is well-lit and in focus</li>
                      <li>• Include all line items in the photo</li>
                      <li>• Prices and quantities should be clearly visible</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {step === "processing" && (
            <div className="p-12 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-10 h-10 text-amber-600" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                </div>
              </div>
              <p className="text-lg font-medium text-stone-900 mt-6">Analyzing invoice...</p>
              <p className="text-sm text-stone-500 mt-1">Our AI is extracting items from your invoice</p>
              
              {imagePreview && (
                <div className="mt-6 w-48 h-32 rounded-xl overflow-hidden border border-stone-200 shadow-lg">
                  <img src={imagePreview} alt="Processing" className="w-full h-full object-cover opacity-75" />
                </div>
              )}
            </div>
          )}

          {/* Step: Review */}
          {step === "review" && (
            <div className="p-6 space-y-6">
              {/* Supplier Selection */}
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-medium text-stone-700">Supplier</label>
                    {detectedSupplierName && (
                      <p className="text-xs text-amber-600">Detected: {detectedSupplierName}</p>
                    )}
                  </div>
                  {!showNewSupplier && (
                    <button
                      onClick={() => setShowNewSupplier(true)}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Supplier
                    </button>
                  )}
                </div>
                
                {!showNewSupplier ? (
                  <div className="relative">
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
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
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder="Enter supplier name..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateSupplier}
                      disabled={creatingSupplier || !newSupplierName.trim()}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {creatingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                    </button>
                    <button
                      onClick={() => { setShowNewSupplier(false); setNewSupplierName(""); }}
                      className="px-3 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
                    >
                      <X className="w-4 h-4 text-stone-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* Bulk Margin */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-gradient-to-r from-amber-50/50 to-transparent">
                <div>
                  <p className="text-sm font-medium text-stone-700">Apply margin to all items</p>
                  <p className="text-xs text-stone-500">Set the same markup for all items at once</p>
                </div>
                <div className="flex items-center gap-2">
                  {MARGIN_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => applyBulkMargin(option.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        bulkMargin === option.value
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-white border border-stone-200 text-stone-600 hover:border-amber-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="w-12 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={items.every(i => i.selected)}
                            onChange={(e) => setItems(items.map(i => ({ ...i, selected: e.target.checked })))}
                            className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                          />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider w-20">
                          Qty
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider w-28">
                          Cost
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider w-32">
                          Margin
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider w-28">
                          Sales Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {items.map((item) => (
                        <tr key={item.id} className={`${item.selected ? "bg-white" : "bg-stone-50/50 opacity-60"}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => updateItemField(item.id, "selected", e.target.checked)}
                              className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItemField(item.id, "description", e.target.value)}
                              className="w-full px-2 py-1 text-sm border-0 border-b border-transparent hover:border-stone-200 focus:border-amber-500 focus:ring-0 bg-transparent"
                            />
                            {item.sku && (
                              <p className="text-xs text-stone-400 mt-0.5">SKU: {item.sku}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItemField(item.id, "quantity", parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 text-sm text-center border border-stone-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="relative inline-block">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.cost_price}
                                onChange={(e) => updateItemField(item.id, "cost_price", parseFloat(e.target.value) || 0)}
                                className="w-24 pl-5 pr-2 py-1 text-sm text-right border border-stone-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {MARGIN_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => updateItemMargin(item.id, option.value)}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                    item.margin === option.value
                                      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-stone-900">
                              ${item.salesPrice.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Footer */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-stone-50 to-amber-50/30 border-t border-stone-200">
                  <div className="text-sm text-stone-600">
                    <span className="font-medium">{selectedItems.length}</span> of {items.length} items selected
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-stone-500">Total Cost:</span>
                      <span className="ml-2 font-semibold text-stone-900">${totalCost.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Total Sales:</span>
                      <span className="ml-2 font-bold text-emerald-600">${totalSales.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Profit:</span>
                      <span className="ml-2 font-bold text-amber-600">
                        ${(totalSales - totalCost).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="p-12 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                <Package className="w-10 h-10 text-amber-600" />
              </div>
              <p className="text-lg font-medium text-stone-900 mt-6">Importing items...</p>
              <p className="text-sm text-stone-500 mt-1">
                Added {importedCount} of {selectedItems.length} items
              </p>
              
              <div className="w-64 h-2 bg-stone-200 rounded-full mt-6 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="p-12 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold shadow-lg animate-bounce">
                  {importedCount}
                </div>
              </div>
              <p className="text-lg font-medium text-stone-900 mt-6">Import Complete!</p>
              <p className="text-sm text-stone-500 mt-1">
                Successfully added {importedCount} items to your inventory
              </p>
              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={() => {
                    onSuccess?.();
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl font-medium hover:from-amber-700 hover:to-amber-800 transition-all shadow-sm"
                >
                  View Inventory
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === "review" || step === "upload") && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 bg-stone-50">
            <button
              onClick={step === "review" ? () => setStep("upload") : onClose}
              className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-100 transition-colors"
            >
              {step === "review" ? "Back" : "Cancel"}
            </button>
            
            {step === "review" && (
              <button
                onClick={handleImport}
                disabled={selectedItems.length === 0 || isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl font-medium hover:from-amber-700 hover:to-amber-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Import {selectedItems.length} Items
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
