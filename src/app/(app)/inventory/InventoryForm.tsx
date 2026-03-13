"use client";

import { useState, useTransition } from "react";
import { createInventoryItem, updateInventoryItem, createCategory } from "./actions";

interface Category {
  id: string;
  name: string;
}

interface InventoryItem {
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
  // New advanced fields
  certificate_number?: string | null;
  grading_lab?: string | null;
  grade?: string | null;
  report_url?: string | null;
  cert_image_url?: string | null;
  secondary_stones?: SecondaryStone[] | null;
  metal_form?: string | null;
  stock_location?: string | null;
  consignor_name?: string | null;
  consignor_contact?: string | null;
  consignment_start_date?: string | null;
  consignment_end_date?: string | null;
  consignment_commission_pct?: number | null;
  supplier_invoice_ref?: string | null;
}

interface SecondaryStone {
  stone_type: string;
  shape: string;
  carat_weight: string;
  color: string;
  clarity: string;
  cut: string;
  treatment: string;
  count: string;
}

interface InventoryFormProps {
  categories: Category[];
  item?: InventoryItem;
  mode: "create" | "edit";
}

const ITEM_TYPES = [
  { value: "finished_piece", label: "Finished Piece" },
  { value: "loose_stone", label: "Loose Stone" },
  { value: "finding", label: "Finding" },
  { value: "raw_material", label: "Raw Material" },
  { value: "packaging", label: "Packaging" },
];

const JEWELLERY_TYPES = [
  "Ring", "Necklace", "Bracelet", "Earring", "Pendant", "Bangle", "Brooch", "Other",
];

const METAL_TYPES = ["Gold", "Silver", "Platinum", "Palladium", "Titanium", "Steel", "Other"];
const METAL_COLOURS = ["Yellow", "White", "Rose", "Two-tone", "N/A"];
const METAL_PURITIES = ["9ct", "14ct", "18ct", "22ct", "24ct", "925", "950", "999", "Other"];
const STONE_TYPES = ["Diamond", "Sapphire", "Ruby", "Emerald", "Amethyst", "Aquamarine", "Opal", "Pearl", "Other"];
const STONE_COLOURS = ["White", "Blue", "Red", "Green", "Yellow", "Pink", "Purple", "Black", "Other"];
const STONE_CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-stone-200 pb-3 mb-5">
      <h2 className="font-semibold text-lg font-semibold text-stone-900">{title}</h2>
    </div>
  );
}

function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-900 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#8B7355] transition-colors ${className}`}
    />
  );
}

function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 focus:outline-none focus:border-[#8B7355] transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#8B7355] transition-colors resize-none ${className}`}
    />
  );
}

export default function InventoryForm({ categories: initialCategories, item, mode }: InventoryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [itemType, setItemType] = useState(item?.item_type ?? "finished_piece");
  const [jewelleryType, setJewelleryType] = useState(item?.jewellery_type ?? "");
  const [trackQuantity, setTrackQuantity] = useState(item?.track_quantity ?? true);
  const [isFeatured, setIsFeatured] = useState(item?.is_featured ?? false);
  const [status, setStatus] = useState(item?.status ?? "active");

  // Pricing
  const [costPrice, setCostPrice] = useState(item?.cost_price?.toString() ?? "");
  const [retailPrice, setRetailPrice] = useState(item?.retail_price?.toString() ?? "");

  const margin =
    costPrice && retailPrice && parseFloat(retailPrice) > 0
      ? (((parseFloat(retailPrice) - parseFloat(costPrice)) / parseFloat(retailPrice)) * 100).toFixed(1)
      : null;

  // Advanced fields
  const [certNumber, setCertNumber] = useState(item?.certificate_number ?? "");
  const [gradingLab, setGradingLab] = useState(item?.grading_lab ?? "");
  const [grade, setGrade] = useState(item?.grade ?? "");
  const [reportUrl, setReportUrl] = useState(item?.report_url ?? "");
  const [stockLocation, setStockLocation] = useState(item?.stock_location ?? "display");
  const [metalForm, setMetalForm] = useState(item?.metal_form ?? "");
  const [consignorName, setConsignorName] = useState(item?.consignor_name ?? "");
  const [consignorContact, setConsignorContact] = useState(item?.consignor_contact ?? "");
  const [consignmentStart, setConsignmentStart] = useState(item?.consignment_start_date ?? "");
  const [consignmentEnd, setConsignmentEnd] = useState(item?.consignment_end_date ?? "");
  const [consignmentCommPct, setConsignmentCommPct] = useState(item?.consignment_commission_pct?.toString() ?? "");
  const [supplierInvoiceRef, setSupplierInvoiceRef] = useState(item?.supplier_invoice_ref ?? "");
  const [secondaryStones, setSecondaryStones] = useState<SecondaryStone[]>(item?.secondary_stones ?? []);
  const [showCertSection, setShowCertSection] = useState(false);

  function addSecondaryStone() {
    setSecondaryStones((prev) => [
      ...prev,
      { stone_type: "", shape: "", carat_weight: "", color: "", clarity: "", cut: "", treatment: "", count: "1" },
    ]);
  }

  function updateSecondaryStone(idx: number, field: keyof SecondaryStone, value: string) {
    setSecondaryStones((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function removeSecondaryStone(idx: number) {
    setSecondaryStones((prev) => prev.filter((_, i) => i !== idx));
  }

  // Categories
  const [categories, setCategories] = useState(initialCategories);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [addingCat, setAddingCat] = useState(false);

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const cat = await createCategory(newCatName.trim());
      setCategories((prev) => [...prev, cat]);
      setCategoryId(cat.id);
      setNewCatName("");
      setShowNewCategory(false);
    } catch {
      setError("Failed to create category");
    } finally {
      setAddingCat(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("track_quantity", String(trackQuantity));
    formData.set("is_featured", String(isFeatured));
    formData.set("status", status);
    formData.set("category_id", categoryId);

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createInventoryItem(formData);
        } else if (item) {
          await updateInventoryItem(item.id, formData);
        }
      } catch (err) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          setError(err.message);
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionHeader title="Basic Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="name" required>Item Name</FieldLabel>
            <Input id="name" name="name" required placeholder="e.g. Diamond Solitaire Ring" defaultValue={item?.name} />
          </div>

          <div>
            <FieldLabel htmlFor="item_type">Item Type</FieldLabel>
            <Select
              id="item_type"
              name="item_type"
              value={itemType}
              onChange={(e) => { setItemType(e.target.value); setJewelleryType(""); }}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>

          {itemType === "finished_piece" && (
            <div>
              <FieldLabel htmlFor="jewellery_type">Jewellery Type</FieldLabel>
              <Select
                id="jewellery_type"
                name="jewellery_type"
                value={jewelleryType}
                onChange={(e) => setJewelleryType(e.target.value)}
              >
                <option value="">Select type...</option>
                {JEWELLERY_TYPES.map((t) => (
                  <option key={t} value={t.toLowerCase()}>{t}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <FieldLabel htmlFor="category_id">Category</FieldLabel>
            <div className="flex gap-2">
              <Select
                id="category_id"
                name="category_id"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex-1"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => setShowNewCategory(!showNewCategory)}
                className="flex-shrink-0 px-3 py-2.5 border border-stone-900 text-stone-900 text-sm rounded-lg hover:bg-stone-900 hover:text-white transition-colors"
                title="New category"
              >
                +
              </button>
            </div>
            {showNewCategory && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategory())}
                  className="flex-1 px-3 py-2 text-sm border border-[#8B7355] rounded-lg focus:outline-none text-stone-900"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCat || !newCatName.trim()}
                  className="px-3 py-2 bg-[#8B7355] text-white text-sm rounded-lg hover:bg-[#7A6347] disabled:opacity-50 transition-colors"
                >
                  {addingCat ? "..." : "Add"}
                </button>
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional description..."
              defaultValue={item?.description ?? ""}
            />
          </div>
        </div>
      </div>

      {/* Specifications */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionHeader title="Specifications" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <FieldLabel htmlFor="metal_type">Metal Type</FieldLabel>
            <Select id="metal_type" name="metal_type" defaultValue={item?.metal_type ?? ""}>
              <option value="">None</option>
              {METAL_TYPES.map((t) => <option key={t} value={t.toLowerCase()}>{t}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="metal_colour">Metal Colour</FieldLabel>
            <Select id="metal_colour" name="metal_colour" defaultValue={item?.metal_colour ?? ""}>
              <option value="">None</option>
              {METAL_COLOURS.map((t) => <option key={t} value={t.toLowerCase()}>{t}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="metal_purity">Metal Purity</FieldLabel>
            <Select id="metal_purity" name="metal_purity" defaultValue={item?.metal_purity ?? ""}>
              <option value="">None</option>
              {METAL_PURITIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="metal_weight_grams">Metal Weight (g)</FieldLabel>
            <Input id="metal_weight_grams" name="metal_weight_grams" type="number" step="0.01" min="0" placeholder="0.00" defaultValue={item?.metal_weight_grams?.toString() ?? ""} />
          </div>

          <div>
            <FieldLabel htmlFor="stone_type">Stone Type</FieldLabel>
            <Select id="stone_type" name="stone_type" defaultValue={item?.stone_type ?? ""}>
              <option value="">None</option>
              {STONE_TYPES.map((t) => <option key={t} value={t.toLowerCase()}>{t}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="stone_carat">Stone Carat</FieldLabel>
            <Input id="stone_carat" name="stone_carat" type="number" step="0.01" min="0" placeholder="0.00" defaultValue={item?.stone_carat?.toString() ?? ""} />
          </div>
          <div>
            <FieldLabel htmlFor="stone_colour">Stone Colour</FieldLabel>
            <Select id="stone_colour" name="stone_colour" defaultValue={item?.stone_colour ?? ""}>
              <option value="">None</option>
              {STONE_COLOURS.map((t) => <option key={t} value={t.toLowerCase()}>{t}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="stone_clarity">Stone Clarity</FieldLabel>
            <Select id="stone_clarity" name="stone_clarity" defaultValue={item?.stone_clarity ?? ""}>
              <option value="">None</option>
              {STONE_CLARITIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>

          {(itemType === "finished_piece" && jewelleryType === "ring") && (
            <div>
              <FieldLabel htmlFor="ring_size">Ring Size</FieldLabel>
              <Input id="ring_size" name="ring_size" placeholder="e.g. L, M, N, 7" defaultValue={item?.ring_size ?? ""} />
            </div>
          )}
          {itemType === "finished_piece" && jewelleryType !== "ring" && (
            <input type="hidden" name="ring_size" value="" />
          )}

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="dimensions">Dimensions / Other Specs</FieldLabel>
            <Input id="dimensions" name="dimensions" placeholder="e.g. 18mm x 12mm" defaultValue={item?.dimensions ?? ""} />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionHeader title="Pricing" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <FieldLabel htmlFor="cost_price">Cost Price (£)</FieldLabel>
            <Input
              id="cost_price"
              name="cost_price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="wholesale_price">Wholesale Price (£)</FieldLabel>
            <Input id="wholesale_price" name="wholesale_price" type="number" step="0.01" min="0" placeholder="0.00" defaultValue={item?.wholesale_price?.toString() ?? ""} />
          </div>
          <div>
            <FieldLabel htmlFor="retail_price" required>Retail Price (£)</FieldLabel>
            <Input
              id="retail_price"
              name="retail_price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              required
              value={retailPrice}
              onChange={(e) => setRetailPrice(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="margin_display">Profit Margin</FieldLabel>
            <div className={`w-full px-3 py-2.5 text-sm border rounded-lg font-medium ${
              margin !== null && parseFloat(margin) > 0
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-stone-200 bg-stone-50 text-stone-400"
            }`}>
              {margin !== null ? `${margin}%` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Stock */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionHeader title="Stock" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {mode === "create" && (
            <div>
              <FieldLabel htmlFor="quantity">Initial Quantity</FieldLabel>
              <Input id="quantity" name="quantity" type="number" min="0" placeholder="0" defaultValue="0" />
            </div>
          )}
          <div>
            <FieldLabel htmlFor="low_stock_threshold">Low Stock Threshold</FieldLabel>
            <Input id="low_stock_threshold" name="low_stock_threshold" type="number" min="0" placeholder="1" defaultValue={item?.low_stock_threshold?.toString() ?? "1"} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => setTrackQuantity(!trackQuantity)}
              className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${trackQuantity ? "bg-[#8B7355]" : "bg-stone-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${trackQuantity ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <span className="text-sm text-stone-900">Track quantity</span>
          </div>

          <div>
            <FieldLabel htmlFor="sku">SKU</FieldLabel>
            {mode === "edit" ? (
              <div className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50 text-stone-500 font-mono">
                {item?.sku || "—"}
              </div>
            ) : (
              <Input id="sku" name="sku" placeholder="Auto-generated" defaultValue={item?.sku ?? ""} className="font-mono" />
            )}
            {mode === "create" && (
              <p className="text-xs text-stone-400 mt-1">Leave blank to auto-generate (SKU00001)</p>
            )}
          </div>
          <div>
            <FieldLabel htmlFor="barcode">Barcode</FieldLabel>
            <Input id="barcode" name="barcode" placeholder="Optional barcode" defaultValue={item?.barcode ?? ""} className="font-mono" />
          </div>
          <div>
            <FieldLabel htmlFor="supplier_name">Supplier Name</FieldLabel>
            <Input id="supplier_name" name="supplier_name" placeholder="e.g. Gold Masters Ltd" defaultValue={item?.supplier_name ?? ""} />
          </div>
          <div>
            <FieldLabel htmlFor="supplier_sku">Supplier SKU</FieldLabel>
            <Input id="supplier_sku" name="supplier_sku" placeholder="Supplier's reference" defaultValue={item?.supplier_sku ?? ""} className="font-mono" />
          </div>
        </div>
      </div>

      {/* Display */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <SectionHeader title="Display" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-stone-900 mb-3">Status</p>
            <div className="flex gap-3">
              {(["active", "inactive", "consignment"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 text-sm rounded-lg border font-medium capitalize transition-colors ${
                    status === s
                      ? "bg-[#8B7355] text-white border-[#8B7355]"
                      : "bg-white text-stone-900 border-stone-200 hover:border-[#8B7355]/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsFeatured(!isFeatured)}
              className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${isFeatured ? "bg-[#8B7355]" : "bg-stone-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isFeatured ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-stone-900">Featured item</p>
              <p className="text-xs text-stone-400">Highlight this item in your catalogue</p>
            </div>
          </div>

          {/* Image upload placeholder */}
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-stone-900 mb-2">Images</p>
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center bg-stone-50/50">
              <svg className="w-10 h-10 text-stone-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-stone-400">Image upload available in Sprint 9</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Location */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <SectionHeader title="Stock Location & Reference" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="stock_location">Stock Location</FieldLabel>
            <Select
              id="stock_location"
              name="stock_location"
              value={stockLocation}
              onChange={(e) => setStockLocation(e.target.value)}
            >
              <option value="display">Display Cabinet</option>
              <option value="safe">Safe</option>
              <option value="workshop">Workshop</option>
              <option value="warehouse">Warehouse</option>
              <option value="consignment">On Consignment</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="supplier_invoice_ref">Supplier Invoice Ref</FieldLabel>
            <Input
              id="supplier_invoice_ref"
              name="supplier_invoice_ref"
              value={supplierInvoiceRef}
              onChange={(e) => setSupplierInvoiceRef(e.target.value)}
              placeholder="e.g. INV-2024-001"
            />
          </div>
        </div>
      </div>

      {/* Certificate */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCertSection(!showCertSection)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
        >
          <span className="font-semibold text-stone-900">Certificate / Grading</span>
          <span className="text-stone-400 text-sm">{showCertSection ? "▲" : "▼"}</span>
        </button>
        {showCertSection && (
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="certificate_number">Certificate Number</FieldLabel>
                <Input
                  id="certificate_number"
                  name="certificate_number"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="e.g. GIA 1234567890"
                />
              </div>
              <div>
                <FieldLabel htmlFor="grading_lab">Grading Lab</FieldLabel>
                <Select
                  id="grading_lab"
                  name="grading_lab"
                  value={gradingLab}
                  onChange={(e) => setGradingLab(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option value="GIA">GIA</option>
                  <option value="IGI">IGI</option>
                  <option value="AGS">AGS</option>
                  <option value="HRD">HRD</option>
                  <option value="Other">Other</option>
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor="grade">Grade</FieldLabel>
                <Input
                  id="grade"
                  name="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. D/IF"
                />
              </div>
              <div>
                <FieldLabel htmlFor="report_url">Report URL</FieldLabel>
                <Input
                  id="report_url"
                  name="report_url"
                  type="url"
                  value={reportUrl}
                  onChange={(e) => setReportUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Secondary Stones */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <SectionHeader title="Secondary Stones" />
          <button
            type="button"
            onClick={addSecondaryStone}
            className="text-xs text-[#8B7355] font-medium hover:underline"
          >
            + Add Stone
          </button>
        </div>
        {secondaryStones.length === 0 ? (
          <p className="text-sm text-stone-400">No secondary stones added.</p>
        ) : (
          <div className="space-y-4">
            {secondaryStones.map((stone, idx) => (
              <div key={idx} className="border border-stone-200 rounded-xl p-4 relative">
                <button
                  type="button"
                  onClick={() => removeSecondaryStone(idx)}
                  className="absolute top-3 right-3 text-stone-300 hover:text-red-400 text-xs"
                >
                  ✕ Remove
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <FieldLabel htmlFor={`ss_type_${idx}`}>Stone Type</FieldLabel>
                    <Input
                      id={`ss_type_${idx}`}
                      value={stone.stone_type}
                      onChange={(e) => updateSecondaryStone(idx, "stone_type", e.target.value)}
                      placeholder="Diamond"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`ss_shape_${idx}`}>Shape</FieldLabel>
                    <Input
                      id={`ss_shape_${idx}`}
                      value={stone.shape}
                      onChange={(e) => updateSecondaryStone(idx, "shape", e.target.value)}
                      placeholder="Round"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`ss_carat_${idx}`}>Carat Weight</FieldLabel>
                    <Input
                      id={`ss_carat_${idx}`}
                      value={stone.carat_weight}
                      onChange={(e) => updateSecondaryStone(idx, "carat_weight", e.target.value)}
                      placeholder="0.50"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`ss_count_${idx}`}>Count</FieldLabel>
                    <Input
                      id={`ss_count_${idx}`}
                      type="number"
                      min="1"
                      value={stone.count}
                      onChange={(e) => updateSecondaryStone(idx, "count", e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`ss_color_${idx}`}>Color</FieldLabel>
                    <Input
                      id={`ss_color_${idx}`}
                      value={stone.color}
                      onChange={(e) => updateSecondaryStone(idx, "color", e.target.value)}
                      placeholder="G"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`ss_clarity_${idx}`}>Clarity</FieldLabel>
                    <Input
                      id={`ss_clarity_${idx}`}
                      value={stone.clarity}
                      onChange={(e) => updateSecondaryStone(idx, "clarity", e.target.value)}
                      placeholder="VS1"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`ss_cut_${idx}`}>Cut</FieldLabel>
                    <Input
                      id={`ss_cut_${idx}`}
                      value={stone.cut}
                      onChange={(e) => updateSecondaryStone(idx, "cut", e.target.value)}
                      placeholder="Excellent"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`ss_treatment_${idx}`}>Treatment</FieldLabel>
                    <Input
                      id={`ss_treatment_${idx}`}
                      value={stone.treatment}
                      onChange={(e) => updateSecondaryStone(idx, "treatment", e.target.value)}
                      placeholder="None"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Hidden input for secondary_stones JSON */}
        <input type="hidden" name="secondary_stones" value={JSON.stringify(secondaryStones)} />
      </div>

      {/* Metal Form (raw material) */}
      {itemType === "raw_material" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <SectionHeader title="Metal Stock Details" />
          <div>
            <FieldLabel htmlFor="metal_form">Metal Form</FieldLabel>
            <Select
              id="metal_form"
              name="metal_form"
              value={metalForm}
              onChange={(e) => setMetalForm(e.target.value)}
            >
              <option value="">Select…</option>
              <option value="sheet">Sheet</option>
              <option value="wire">Wire</option>
              <option value="grain">Grain</option>
              <option value="casting">Casting</option>
            </Select>
          </div>
        </div>
      )}

      {/* Consignment Details */}
      {status === "consignment" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <SectionHeader title="Consignment Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="consignor_name">Consignor Name</FieldLabel>
              <Input
                id="consignor_name"
                name="consignor_name"
                value={consignorName}
                onChange={(e) => setConsignorName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="consignor_contact">Consignor Contact</FieldLabel>
              <Input
                id="consignor_contact"
                name="consignor_contact"
                value={consignorContact}
                onChange={(e) => setConsignorContact(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="consignment_start_date">Start Date</FieldLabel>
              <Input
                id="consignment_start_date"
                name="consignment_start_date"
                type="date"
                value={consignmentStart}
                onChange={(e) => setConsignmentStart(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="consignment_end_date">End Date</FieldLabel>
              <Input
                id="consignment_end_date"
                name="consignment_end_date"
                type="date"
                value={consignmentEnd}
                onChange={(e) => setConsignmentEnd(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="consignment_commission_pct">Commission (%)</FieldLabel>
              <Input
                id="consignment_commission_pct"
                name="consignment_commission_pct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={consignmentCommPct}
                onChange={(e) => setConsignmentCommPct(e.target.value)}
                placeholder="15"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hidden inputs for cert fields */}
      <input type="hidden" name="certificate_number" value={certNumber} />
      <input type="hidden" name="grading_lab" value={gradingLab} />
      <input type="hidden" name="grade" value={grade} />
      <input type="hidden" name="report_url" value={reportUrl} />
      <input type="hidden" name="stock_location" value={stockLocation} />
      <input type="hidden" name="metal_form" value={metalForm} />
      <input type="hidden" name="consignor_name" value={consignorName} />
      <input type="hidden" name="consignor_contact" value={consignorContact} />
      <input type="hidden" name="consignment_start_date" value={consignmentStart} />
      <input type="hidden" name="consignment_end_date" value={consignmentEnd} />
      <input type="hidden" name="consignment_commission_pct" value={consignmentCommPct} />
      <input type="hidden" name="supplier_invoice_ref" value={supplierInvoiceRef} />

      {/* Actions */}
      <div className="flex items-center justify-between pb-8">
        <a href={mode === "edit" && item ? `/inventory/${item.id}` : "/inventory"} className="px-5 py-2.5 text-sm font-medium text-stone-900 border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-colors">
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7A6347] disabled:opacity-60 transition-colors flex items-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : mode === "create" ? "Add Item" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
