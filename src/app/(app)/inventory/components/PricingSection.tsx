import { SectionHeader, FieldLabel, Input } from "./FormElements";
import type { InventoryItem } from "./types";

interface PricingSectionProps {
  item?: InventoryItem;
  costPrice: string;
  setCostPrice: (val: string) => void;
  retailPrice: string;
  setRetailPrice: (val: string) => void;
}

export default function PricingSection({
  item,
  costPrice,
  setCostPrice,
  retailPrice,
  setRetailPrice,
}: PricingSectionProps) {
  const margin =
    costPrice && retailPrice && parseFloat(retailPrice) > 0
      ? (((parseFloat(retailPrice) - parseFloat(costPrice)) / parseFloat(retailPrice)) * 100).toFixed(1)
      : null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <SectionHeader title="Pricing" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div>
          <FieldLabel htmlFor="cost_price">Cost Price</FieldLabel>
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
          <FieldLabel htmlFor="wholesale_price">Wholesale Price</FieldLabel>
          <Input id="wholesale_price" name="wholesale_price" type="number" step="0.01" min="0" placeholder="0.00" defaultValue={item?.wholesale_price?.toString() ?? ""} />
        </div>
        <div>
          <FieldLabel htmlFor="retail_price" required>Retail Price</FieldLabel>
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
  );
}
