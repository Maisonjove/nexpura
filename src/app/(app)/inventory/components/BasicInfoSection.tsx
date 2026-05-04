"use client";

import { useState, useRef } from "react";
import { PlusIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { createCategory, categorizeWithAI } from "../actions";
import { FormSection, FieldLabel, Input, Select, Textarea } from "./FormElements";
import { ITEM_TYPES, JEWELLERY_TYPES } from "./constants";
import type { Category, InventoryItem } from "./types";

interface BasicInfoSectionProps {
  item?: InventoryItem;
  mode: "create" | "edit";
  initialCategories: Category[];
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
  // AI categorization callbacks for other sections
  onAICategorize?: (data: {
    metalType?: string | null;
    metalColour?: string | null;
    metalPurity?: string | null;
    stoneType?: string | null;
    stoneColour?: string | null;
    stoneClarity?: string | null;
  }) => void;
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
  onAICategorize,
}: BasicInfoSectionProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

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

  async function handleAICategorize() {
    const name = nameRef.current?.value?.trim();
    if (!name) {
      setError("Enter an item name first");
      return;
    }

    setAiLoading(true);
    setAiConfidence(null);
    setError(null);

    try {
      const description = descRef.current?.value?.trim();
      const result = await categorizeWithAI(name, description || undefined);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        const d = result.data;

        // Set item type and jewellery type
        if (d.itemType) setItemType(d.itemType);
        if (d.jewelleryType) setJewelleryType(d.jewelleryType);

        // Create category if suggested and doesn't exist
        if (d.suggestedCategory) {
          const existingCat = categories.find(
            (c) => c.name.toLowerCase() === d.suggestedCategory!.toLowerCase()
          );
          if (existingCat) {
            setCategoryId(existingCat.id);
          } else {
            // Create the new category
            try {
              const newCat = await createCategory(d.suggestedCategory);
              setCategories((prev) => [...prev, newCat]);
              setCategoryId(newCat.id);
            } catch {
              // Silently fail category creation
            }
          }
        }

        // Pass metal/stone data to parent for MetalStoneSection
        if (onAICategorize) {
          onAICategorize({
            metalType: d.metalType,
            metalColour: d.metalColour,
            metalPurity: d.metalPurity,
            stoneType: d.stoneType,
            stoneColour: d.stoneColour,
            stoneClarity: d.stoneClarity,
          });
        }

        setAiConfidence(d.confidence);
      }
    } catch {
      setError("AI categorization failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <FormSection
      eyebrow="Step 01"
      title="Basic Information"
      description="Identify the piece. Auto-categorize from the name to fill metal, stone, and category fields automatically."
      action={
        <button
          type="button"
          onClick={handleAICategorize}
          disabled={aiLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[0.8125rem] font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 disabled:opacity-60 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
        >
          <SparklesIcon
            className={`w-4 h-4 text-nexpura-bronze ${aiLoading ? "animate-spin" : ""}`}
          />
          {aiLoading ? "Analyzing…" : "Auto-Categorize"}
        </button>
      }
    >
      {aiConfidence !== null && (
        <div className="mb-7 flex items-center gap-2 text-[0.8125rem] text-stone-500">
          <SparklesIcon className="w-4 h-4 text-nexpura-bronze" />
          <span>
            AI categorized with{" "}
            <span className="text-stone-700 font-medium">
              {Math.round(aiConfidence * 100)}%
            </span>{" "}
            confidence
            {aiConfidence < 0.8 && (
              <span className="text-stone-400"> — please review</span>
            )}
          </span>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <FieldLabel htmlFor="name" required>
            Item Name
          </FieldLabel>
          <Input
            ref={nameRef}
            id="name"
            name="name"
            required
            placeholder="e.g. 18ct White Gold Diamond Solitaire Ring"
            defaultValue={item?.name}
          />
          <p className="text-[0.75rem] text-stone-400 mt-2 leading-relaxed">
            Tip — include metal, stone, and jewellery type for the best AI results.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <FieldLabel htmlFor="sku">SKU</FieldLabel>
            {mode === "edit" ? (
              <div className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-lg bg-stone-50/60 text-stone-500 font-mono tracking-tight">
                {item?.sku || "—"}
              </div>
            ) : (
              <Input
                id="sku"
                name="sku"
                placeholder="Auto-generated"
                defaultValue={item?.sku ?? ""}
                className="font-mono tracking-tight"
              />
            )}
            {mode === "create" && (
              <p className="text-[0.75rem] text-stone-400 mt-2 leading-relaxed">
                Leave blank to auto-generate.
              </p>
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
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => setShowNewCategory(!showNewCategory)}
                aria-label="Add category"
                className="shrink-0 inline-flex items-center justify-center w-[42px] rounded-lg border border-stone-200 text-stone-400 hover:bg-stone-50 hover:text-nexpura-bronze hover:border-stone-300 transition-all duration-200"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
            {showNewCategory && (
              <div className="mt-2.5 flex gap-2">
                <Input
                  type="text"
                  placeholder="Category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), handleAddCategory())
                  }
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCat || !newCatName.trim()}
                  className="px-4 rounded-lg text-[0.8125rem] font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {addingCat ? "…" : "Add"}
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
              onChange={(e) => {
                setItemType(e.target.value);
                setJewelleryType("");
              }}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
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
                <option value="">Select type…</option>
                {JEWELLERY_TYPES.map((t) => (
                  <option key={t} value={t.toLowerCase()}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="consignment">Consignment</option>
            </Select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer pb-2.5 select-none">
              <button
                type="button"
                onClick={() => setIsFeatured(!isFeatured)}
                role="switch"
                aria-checked={isFeatured}
                aria-label="Featured item"
                className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${
                  isFeatured ? "bg-nexpura-bronze" : "bg-stone-200"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    isFeatured ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-[0.8125rem] text-stone-700">
                Featured item
              </span>
            </label>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            ref={descRef}
            id="description"
            name="description"
            rows={3}
            placeholder="Optional description…"
            defaultValue={item?.description ?? ""}
          />
        </div>
      </div>
    </FormSection>
  );
}
