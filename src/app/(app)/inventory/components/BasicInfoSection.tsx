"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createCategory } from "../actions";
import { SectionHeader, FieldLabel, Input, Select, Textarea } from "./FormElements";
import { ITEM_TYPES, JEWELLERY_TYPES } from "./constants";
import type { Category, InventoryItem } from "./types";

interface BasicInfoSectionProps {
  item?: InventoryItem;
  mode: "create" | "edit";
  initialCategories: Category[];h
  itemType: string;
  setItemType: (val: string) => void;
  jewelleryType: string;
  setJewelleryType: (val: string) => void;
  status: string;
  setStatus: (val: string) => void;
  isFeatured: boolean;
  setIsFeatured: (val: boolean) => void;
  categoryId: string;
  setCategoryId: (val: string) => void;
  setError: (val: string | null) => void;
}

export default function BasicInfoSection({
  item,
  mode,
  initialCategories,
  itemType,
  setItemType,
  jewelleryType,
  setJewelleryType,
  status,
  setStatus,
  isFeatured,
  setIsFeatured,
  categoryId,
  setCategoryId,
  setError,
}: BasicInfoSectionProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
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

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <SectionHeader title="Basic Information" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="name" required>Item Name</FieldLabel>
          <Input id="name" name="name" required placeholder="e.g. Diamond Solitaire Ring" defaultValue={item?.name} />
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
            <p className="text-[10px] text-stone-400 mt-1 uppercase font-bold tracking-tight">Leave blank to auto-generate</p>
          )}
        </div>

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
              className="flex-shrink-0 px-3 py-2.5 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
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
                className="flex-1 px-3 py-2 text-sm border border-amber-600 rounded-lg focus:outline-none text-stone-900"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={addingCat || !newCatName.trim()}
                className="px-3 py-2 bg-amber-700 text-white text-sm rounded-lg hover:bg-amber-800 disabled:opacity-50 transition-colors"
              >
                {addingCat ? "..." : "Add"}
              </button>
            </div>
          )}
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
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="consignment">Consignment</option>
          </Select>
        </div>

        <div className="flex items-center gap-3 pt-6">
          <button
            type="button"
            onClick={() => setIsFeatured(!isFeatured)}
            className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${isFeatured ? "bg-amber-700" : "bg-stone-200"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isFeatured ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-stone-900">Featured item</span>
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
  );
}
