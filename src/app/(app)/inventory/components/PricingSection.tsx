import { FormSection, FieldLabel, Input } from "./FormElements";
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
  const cost = parseFloat(costPrice);
  const retail = parseFloat(retailPrice);
  const hasBoth = !isNaN(cost) && !isNaN(retail) && cost > 0 && retail > 0;
  const isUnderwater = hasBoth && retail < cost;
  const margin = hasBoth
    ? (((retail - cost) / retail) * 100).toFixed(1)
    : null;

  return (
    <FormSection
      eyebrow="Step 02"
      title="Pricing"
      description="Set the cost, wholesale, and retail prices. The margin updates automatically."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <Input
            id="wholesale_price"
            name="wholesale_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            defaultValue={item?.wholesale_price?.toString() ?? ""}
          />
        </div>
        <div>
          <FieldLabel htmlFor="retail_price" required>
            Retail Price
          </FieldLabel>
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
          <div
            className={`w-full px-4 py-2.5 text-sm rounded-lg border bg-stone-50/60 font-medium tabular-nums ${
              margin !== null && parseFloat(margin) > 0
                ? "border-stone-200 text-emerald-700"
                : isUnderwater
                  ? "border-stone-200 text-red-600"
                  : "border-stone-200 text-stone-400"
            }`}
          >
            {margin !== null ? `${margin}%` : "—"}
          </div>
        </div>
      </div>
      {isUnderwater && (
        <div
          role="alert"
          className="mt-6 border-l-2 border-red-400 pl-4 py-1 text-sm text-red-600 leading-relaxed"
        >
          <span className="font-medium">Retail price is below cost.</span>{" "}
          Selling at this price means a loss per unit. Adjust retail up, or
          update cost if it was overstated.
        </div>
      )}
    </FormSection>
  );
}
