"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRepairFromIntake,
  createBespokeFromIntake,
  createStockSaleFromIntake,
  type CreateRepairInput,
  type CreateBespokeInput,
  type CreateStockSaleInput,
} from "./actions";
import type {
  Customer,
  InventoryItem,
  IntakeClientProps as Props,
  JobType,
  SuccessResult,
} from "./types";
import {
  CustomerSection,
  RepairForm,
  BespokeForm,
  StockSaleForm,
  SuccessScreen,
  SummaryPanel,
  type RepairData,
  type BespokeData,
  type StockData,
} from "./components";

// ────────────────────────────────────────────────────────────────
// Initial State
// ────────────────────────────────────────────────────────────────

const initialRepairData: RepairData = {
  item_type: "",
  item_description: "",
  metal_type: "",
  stones: "",
  size_length: "",
  identifying_details: "",
  condition_notes: "",
  issue_type: "",
  work_description: "",
  risk_notes: "",
  priority: "normal",
  due_date: "",
  quoted_price: "",
  deposit_amount: "",
  payment_received: "",
  payment_method: "cash",
};

const initialBespokeData: BespokeData = {
  title: "",
  jewellery_type: "",
  description: "",
  design_source: "",
  metal_type: "",
  metal_colour: "",
  metal_purity: "",
  stone_type: "",
  stone_details: "",
  ring_size: "",
  dimensions: "",
  notes: "",
  priority: "normal",
  due_date: "",
  quoted_price: "",
  deposit_amount: "",
  payment_received: "",
  payment_method: "cash",
};

const initialStockData: StockData = {
  price: "",
  payment_received: "",
  payment_method: "cash",
  create_invoice: true,
};

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export default function IntakeClient({ initialCustomers, taxConfig }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Job type state
  const [jobType, setJobType] = useState<JobType>("repair");

  // Success state
  const [successResult, setSuccessResult] = useState<SuccessResult | null>(null);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Inventory state (for stock sale)
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);

  // Form data states
  const [repairData, setRepairData] = useState<RepairData>(initialRepairData);
  const [bespokeData, setBespokeData] = useState<BespokeData>(initialBespokeData);
  const [stockData, setStockData] = useState<StockData>(initialStockData);

  // ─── Computed Values ──────────────────────────────────────────
  const getQuoteAmount = () => {
    if (jobType === "repair") return parseFloat(repairData.quoted_price) || 0;
    if (jobType === "bespoke") return parseFloat(bespokeData.quoted_price) || 0;
    if (jobType === "stock") return parseFloat(stockData.price) || selectedInventory?.retail_price || 0;
    return 0;
  };

  const getDepositAmount = () => {
    if (jobType === "repair") return parseFloat(repairData.deposit_amount) || 0;
    if (jobType === "bespoke") return parseFloat(bespokeData.deposit_amount) || 0;
    return 0;
  };

  const getBalanceRemaining = () => {
    return Math.max(0, getQuoteAmount() - getDepositAmount());
  };

  const getPriority = () => {
    if (jobType === "repair") return repairData.priority;
    if (jobType === "bespoke") return bespokeData.priority;
    return "normal";
  };

  const getDueDate = () => {
    if (jobType === "repair") return repairData.due_date;
    if (jobType === "bespoke") return bespokeData.due_date;
    return "";
  };

  const getItemType = () => {
    if (jobType === "repair") return repairData.item_type;
    if (jobType === "bespoke") return bespokeData.jewellery_type;
    if (jobType === "stock") return selectedInventory?.jewellery_type || "";
    return "";
  };

  // ─── Validation ───────────────────────────────────────────────
  const getMissingFields = () => {
    const missing: string[] = [];
    
    if (jobType === "repair") {
      if (!repairData.item_type) missing.push("Item type");
      if (!repairData.item_description) missing.push("Item description");
    } else if (jobType === "bespoke") {
      if (!bespokeData.title) missing.push("Title");
    } else if (jobType === "stock") {
      if (!selectedInventory) missing.push("Stock item");
    }
    
    return missing;
  };

  const isFormValid = getMissingFields().length === 0;

  // ─── Submit Handler ───────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    
    startTransition(async () => {
      try {
        if (jobType === "repair") {
          const input: CreateRepairInput = {
            customer_id: selectedCustomer?.id || null,
            item_type: repairData.item_type,
            item_description: repairData.item_description,
            metal_type: repairData.metal_type || null,
            stones: repairData.stones || null,
            size_length: repairData.size_length || null,
            identifying_details: repairData.identifying_details || null,
            condition_notes: repairData.condition_notes || null,
            issue_type: repairData.issue_type || null,
            work_description: repairData.work_description || null,
            risk_notes: repairData.risk_notes || null,
            priority: repairData.priority,
            due_date: repairData.due_date || null,
            quoted_price: repairData.quoted_price ? parseFloat(repairData.quoted_price) : null,
            deposit_amount: repairData.deposit_amount ? parseFloat(repairData.deposit_amount) : null,
            payment_received: repairData.payment_received ? parseFloat(repairData.payment_received) : null,
            payment_method: repairData.payment_method || null,
          };
          
          const result = await createRepairFromIntake(input);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccessResult({
            type: "repair",
            id: result.id!,
            number: result.repair_number!,
            invoiceId: result.invoice_id,
          });
        } else if (jobType === "bespoke") {
          const input: CreateBespokeInput = {
            customer_id: selectedCustomer?.id || null,
            title: bespokeData.title,
            jewellery_type: bespokeData.jewellery_type || null,
            description: bespokeData.description || null,
            design_source: bespokeData.design_source || null,
            metal_type: bespokeData.metal_type || null,
            metal_colour: bespokeData.metal_colour || null,
            metal_purity: bespokeData.metal_purity || null,
            stone_type: bespokeData.stone_type || null,
            stone_details: bespokeData.stone_details || null,
            ring_size: bespokeData.ring_size || null,
            dimensions: bespokeData.dimensions || null,
            notes: bespokeData.notes || null,
            priority: bespokeData.priority,
            due_date: bespokeData.due_date || null,
            quoted_price: bespokeData.quoted_price ? parseFloat(bespokeData.quoted_price) : null,
            deposit_amount: bespokeData.deposit_amount ? parseFloat(bespokeData.deposit_amount) : null,
            payment_received: bespokeData.payment_received ? parseFloat(bespokeData.payment_received) : null,
            payment_method: bespokeData.payment_method || null,
          };
          
          const result = await createBespokeFromIntake(input);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccessResult({
            type: "bespoke",
            id: result.id!,
            number: result.job_number!,
            invoiceId: result.invoice_id,
          });
        } else if (jobType === "stock") {
          if (!selectedInventory) {
            setError("Please select a stock item");
            return;
          }
          
          const input: CreateStockSaleInput = {
            customer_id: selectedCustomer?.id || null,
            inventory_id: selectedInventory.id,
            item_name: selectedInventory.name || "Unknown Item",
            price: parseFloat(stockData.price) || selectedInventory.retail_price || 0,
            payment_received: stockData.payment_received ? parseFloat(stockData.payment_received) : null,
            payment_method: stockData.payment_method || null,
            create_invoice: stockData.create_invoice,
          };
          
          const result = await createStockSaleFromIntake(input);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSuccessResult({
            type: "stock",
            id: result.id!,
            number: result.sale_number!,
            invoiceId: result.invoice_id,
          });
        }
      } catch (e: unknown) {
        const err = e as Error;
        setError(err.message || "An error occurred");
      }
    });
  };

  // ─── Reset Form ───────────────────────────────────────────────
  const resetForm = () => {
    setSuccessResult(null);
    setSelectedCustomer(null);
    setSelectedInventory(null);
    setRepairData(initialRepairData);
    setBespokeData(initialBespokeData);
    setStockData(initialStockData);
  };

  // ─────────────────────────────────────────────────────────────
  // Success State Render
  // ─────────────────────────────────────────────────────────────
  if (successResult) {
    return (
      <SuccessScreen
        result={successResult}
        selectedCustomer={selectedCustomer}
        onReset={resetForm}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-8">
      {/* ─── Left Column: Intake Builder ────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Job Type Selector */}
        <div className="bg-white border border-stone-200 rounded-xl p-1.5 mb-6 shadow-sm">
          <div className="flex">
            {(["repair", "bespoke", "stock"] as JobType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setJobType(type)}
                className={`flex-1 px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                  jobType === type
                    ? "bg-amber-700 text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                {type === "repair" && "Repair"}
                {type === "bespoke" && "Bespoke"}
                {type === "stock" && "Stock Item"}
              </button>
            ))}
          </div>
        </div>

        {/* Customer Section */}
        <CustomerSection
          initialCustomers={initialCustomers}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
          onError={setError}
        />

        {/* Form based on job type */}
        {jobType === "repair" && (
          <RepairForm data={repairData} onChange={setRepairData} />
        )}
        
        {jobType === "bespoke" && (
          <BespokeForm data={bespokeData} onChange={setBespokeData} />
        )}
        
        {jobType === "stock" && (
          <StockSaleForm
            data={stockData}
            onChange={setStockData}
            selectedInventory={selectedInventory}
            onSelectInventory={setSelectedInventory}
            taxConfig={taxConfig}
          />
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !isFormValid}
            className="px-8 py-2.5 text-sm font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Creating..." : `Create ${jobType === "repair" ? "Repair" : jobType === "bespoke" ? "Job" : "Sale"}`}
          </button>
        </div>
      </div>

      {/* ─── Right Column: Summary Rail ────────────────────── */}
      <SummaryPanel
        jobType={jobType}
        selectedCustomer={selectedCustomer}
        itemType={getItemType()}
        priority={getPriority()}
        dueDate={getDueDate()}
        quoteAmount={getQuoteAmount()}
        depositAmount={getDepositAmount()}
        balanceRemaining={getBalanceRemaining()}
        missingFields={getMissingFields()}
        taxConfig={taxConfig}
      />
    </div>
  );
}
