"use client";

import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { CollapsibleSection, FieldLabel, Input, Select } from "./FormElements";
import {
  METAL_TYPES,
  METAL_COLOURS,
  METAL_PURITIES,
  STONE_TYPES,
  STONE_COLOURS,
  STONE_CLARITIES,
} from "./constants";
import type { InventoryItem, SecondaryStone } from "./types";

interface MetalStoneSectionProps {
  item?: InventoryItem;
  itemType: string;
  jewelleryType: string;
  metalForm: string;
  setMetalForm: (val: string) => void;
  secondaryStones: SecondaryStone[];
  setSecondaryStones: React.Dispatch<React.SetStateAction<SecondaryStone[]>>;
}

export default function MetalStoneSection({
  item,
  itemType,
  jewelleryType,
  metalForm,
  setMetalForm,
  secondaryStones,
  setSecondaryStones,
}: MetalStoneSectionProps) {
  function addSecondaryStone() {
    setSecondaryStones((prev) => [
      ...prev,
      {
        stone_type: "",
        shape: "",
        carat_weight: "",
        color: "",
        clarity: "",
        cut: "",
        treatment: "",
        count: "1",
      },
    ]);
  }

  function updateSecondaryStone(
    idx: number,
    field: keyof SecondaryStone,
    value: string
  ) {
    setSecondaryStones((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  }

  function removeSecondaryStone(idx: number) {
    setSecondaryStones((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      {/* Metal Details */}
      <CollapsibleSection
        eyebrow="Step 03"
        title="Metal Details"
        description="Metal composition, purity, and weight."
        defaultOpen
        badge={
          itemType === "raw_material" || metalForm ? "Relevant" : undefined
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <FieldLabel htmlFor="metal_type">Metal Type</FieldLabel>
            <Select
              id="metal_type"
              name="metal_type"
              defaultValue={item?.metal_type ?? ""}
            >
              <option value="">None</option>
              {METAL_TYPES.map((t) => (
                <option key={t} value={t.toLowerCase()}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="metal_colour">Metal Colour</FieldLabel>
            <Select
              id="metal_colour"
              name="metal_colour"
              defaultValue={item?.metal_colour ?? ""}
            >
              <option value="">None</option>
              {METAL_COLOURS.map((t) => (
                <option key={t} value={t.toLowerCase()}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="metal_purity">Metal Purity</FieldLabel>
            <Select
              id="metal_purity"
              name="metal_purity"
              defaultValue={item?.metal_purity ?? ""}
            >
              <option value="">None</option>
              {METAL_PURITIES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="metal_weight_grams">
              Metal Weight (g)
            </FieldLabel>
            <Input
              id="metal_weight_grams"
              name="metal_weight_grams"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              defaultValue={item?.metal_weight_grams?.toString() ?? ""}
            />
          </div>
          {itemType === "raw_material" && (
            <div>
              <FieldLabel htmlFor="metal_form">Metal Form</FieldLabel>
              <Select
                id="metal_form"
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
          )}
        </div>
      </CollapsibleSection>

      {/* Stone Details */}
      <CollapsibleSection
        eyebrow="Step 04"
        title="Stone Details"
        description="Primary stone specifications and any secondary stones."
        badge={
          secondaryStones.length > 0
            ? `${secondaryStones.length} stones`
            : undefined
        }
      >
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <FieldLabel htmlFor="stone_type">Stone Type</FieldLabel>
              <Select
                id="stone_type"
                name="stone_type"
                defaultValue={item?.stone_type ?? ""}
              >
                <option value="">None</option>
                {STONE_TYPES.map((t) => (
                  <option key={t} value={t.toLowerCase()}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="stone_carat">Stone Carat</FieldLabel>
              <Input
                id="stone_carat"
                name="stone_carat"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                defaultValue={item?.stone_carat?.toString() ?? ""}
              />
            </div>
            <div>
              <FieldLabel htmlFor="stone_colour">Stone Colour</FieldLabel>
              <Select
                id="stone_colour"
                name="stone_colour"
                defaultValue={item?.stone_colour ?? ""}
              >
                <option value="">None</option>
                {STONE_COLOURS.map((t) => (
                  <option key={t} value={t.toLowerCase()}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="stone_clarity">Stone Clarity</FieldLabel>
              <Select
                id="stone_clarity"
                name="stone_clarity"
                defaultValue={item?.stone_clarity ?? ""}
              >
                <option value="">None</option>
                {STONE_CLARITIES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            {itemType === "finished_piece" && jewelleryType === "ring" && (
              <div>
                <FieldLabel htmlFor="ring_size">Ring Size</FieldLabel>
                <Input
                  id="ring_size"
                  name="ring_size"
                  placeholder="e.g. L, M, N, 7"
                  defaultValue={item?.ring_size ?? ""}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="dimensions">
                Dimensions / Other Specs
              </FieldLabel>
              <Input
                id="dimensions"
                name="dimensions"
                placeholder="e.g. 18mm x 12mm"
                defaultValue={item?.dimensions ?? ""}
              />
            </div>
          </div>

          <div className="pt-7 border-t border-stone-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[0.6875rem] uppercase tracking-luxury text-stone-400 mb-2">
                  Secondary Stones
                </p>
                <h3 className="font-serif text-lg text-stone-900 leading-tight tracking-tight">
                  Additional stones
                </h3>
              </div>
              <button
                type="button"
                onClick={addSecondaryStone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[0.8125rem] font-medium text-stone-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition-all duration-200"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add Stone
              </button>
            </div>
            {secondaryStones.length === 0 ? (
              <p className="text-[0.8125rem] text-stone-400 leading-relaxed">
                No secondary stones added.
              </p>
            ) : (
              <div className="space-y-4">
                {secondaryStones.map((stone, idx) => (
                  <div
                    key={idx}
                    className="border border-stone-200 rounded-xl p-5 relative bg-stone-50/30"
                  >
                    <button
                      type="button"
                      onClick={() => removeSecondaryStone(idx)}
                      aria-label="Remove stone"
                      className="absolute top-3 right-3 text-stone-400 hover:text-red-500 transition-colors duration-200"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <FieldLabel htmlFor={`ss_type_${idx}`}>
                          Stone Type
                        </FieldLabel>
                        <Input
                          id={`ss_type_${idx}`}
                          value={stone.stone_type}
                          onChange={(e) =>
                            updateSecondaryStone(
                              idx,
                              "stone_type",
                              e.target.value
                            )
                          }
                          placeholder="Diamond"
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`ss_shape_${idx}`}>
                          Shape
                        </FieldLabel>
                        <Input
                          id={`ss_shape_${idx}`}
                          value={stone.shape}
                          onChange={(e) =>
                            updateSecondaryStone(idx, "shape", e.target.value)
                          }
                          placeholder="Round"
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`ss_carat_${idx}`}>
                          Carat Weight
                        </FieldLabel>
                        <Input
                          id={`ss_carat_${idx}`}
                          value={stone.carat_weight}
                          onChange={(e) =>
                            updateSecondaryStone(
                              idx,
                              "carat_weight",
                              e.target.value
                            )
                          }
                          placeholder="0.50"
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`ss_count_${idx}`}>
                          Count
                        </FieldLabel>
                        <Input
                          id={`ss_count_${idx}`}
                          type="number"
                          min="1"
                          value={stone.count}
                          onChange={(e) =>
                            updateSecondaryStone(idx, "count", e.target.value)
                          }
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}
