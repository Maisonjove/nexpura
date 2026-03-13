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
