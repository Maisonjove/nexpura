import { SectionHeader, FieldLabel, Input, Select } from "./FormElements";
import type { InventoryItem } from "./types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface StockSectionProps {
  item?: InventoryItem;
  mode: "create" | "edit";
  trackQuantity: boolean;
  setTrackQuantity: (val: boolean) => void;
  stockLocation: string;
  setStockLocation: (val: string) => void;
  supplierInvoiceRef: string;
  setSupplierInvoiceRef: (val: string) => void;
}

export default function StockSection({
  item,
  mode,
  trackQuantity,
  setTrackQuantity,
  stockLocation,
  setStockLocation,
  supplierInvoiceRef,
  setSupplierInvoiceRef,
}: StockSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <SectionHeader title="Stock & Location" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {mode === "create" && (
          <div>
            <FieldLabel htmlFor="quantity">Initial Quantity</FieldLabel>
            <Input id="quantity" name="quantity" type="number" min="0" placeholder="0" defaultValue="0" />
          </div>
        )}
        <div>
          <TooltipProvider>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FieldLabel htmlFor="low_stock_threshold">Low Stock Threshold</FieldLabel>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3.5 w-3.5 text-stone-400" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>When the quantity falls at or below this number, this item will show as &quot;Low Stock&quot; and appear in your low stock alerts.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <Input id="low_stock_threshold" name="low_stock_threshold" type="number" min="0" placeholder="1" defaultValue={item?.low_stock_threshold?.toString() ?? "1"} />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <button
            type="button"
            onClick={() => setTrackQuantity(!trackQuantity)}
            className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${trackQuantity ? "bg-amber-700" : "bg-stone-200"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${trackQuantity ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-stone-900 font-medium">Track quantity</span>
        </div>

        <div>
          <FieldLabel htmlFor="stock_location">Stock Location</FieldLabel>
          <Select
            id="stock_location"
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
        <div>
          <FieldLabel htmlFor="supplier_invoice_ref">Supplier Invoice Ref</FieldLabel>
          <Input
            id="supplier_invoice_ref"
            value={supplierInvoiceRef}
            onChange={(e) => setSupplierInvoiceRef(e.target.value)}
            placeholder="e.g. INV-2024-001"
          />
        </div>
      </div>
    </div>
  );
}
