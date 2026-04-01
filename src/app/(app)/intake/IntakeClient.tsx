"use client";

import { useState, useTransition, useRef, useCallback } from "react";
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
// Error Display Component
// ────────────────────────────────────────────────────────────────

function ErrorBanner({ 
  error, 
  errorType, 
  onDismiss 
}: { 
  error: string; 
  errorType: 'validation' | 'server' | 'network';
  onDismiss: () => void;
}) {
  const titles = {
    validation: 'Please fix the following',
    server: 'Something went wrong',
    network: 'Connection issue',
  };
  
  const icons = {
    validation: (
      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    server: (
      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    network: (
      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
  };
  
  const bgColors = {
    validation: 'bg-amber-50 border-amber-200',
    server: 'bg-red-50 border-red-200',
    network: 'bg-orange-50 border-orange-200',
  };
  
  const textColors = {
    validation: 'text-amber-800',
    server: 'text-red-800',
    network: 'text-orange-800',
  };

  return (
    <div className={`${bgColors[errorType]} border rounded-lg p-4 mb-6`}>
      <div className="flex items-start gap-3">
        {icons[errorType]}
        <div className="flex-1">
          <h4 className={`font-medium ${textColors[errorType]} mb-1`}>{titles[errorType]}</h4>
          <p className={`text-sm ${textColors[errorType]} opacity-90`}>{error}</p>
          {errorType === 'server' && (
            <p className="text-xs text-stone-500 mt-2">
              Your data has not been lost. Try again, or contact support if this persists.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={`${textColors[errorType]} hover:opacity-70`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Loading Overlay Component
// ────────────────────────────────────────────────────────────────

function LoadingOverlay({ jobType }: { jobType: JobType }) {
  const labels = {
    repair: 'Creating repair',
    bespoke: 'Creating bespoke job',
    stock: 'Processing sale',
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full mx-4 text-center">
        <div className="w-12 h-12 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-stone-900 mb-1">{labels[jobType]}...</h3>
        <p className="text-sm text-stone-500">Please wait, do not close this page</p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export default function IntakeClient({ initialCustomers, taxConfig }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'validation' | 'server' | 'network'>('server');

  // Double-submit prevention
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

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

  // ─── Job Type Switching ───────────────────────────────────────
  const handleJobTypeChange = useCallback((type: JobType) => {
    // Clear errors when switching types
    setError(null);
    setJobType(type);
  }, []);

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

  const validatePriceInputs = (): string | null => {
    const quote = getQuoteAmount();
    const deposit = getDepositAmount();
    const payment = jobType === "repair" 
      ? parseFloat(repairData.payment_received) || 0
      : jobType === "bespoke"
      ? parseFloat(bespokeData.payment_received) || 0
      : parseFloat(stockData.payment_received) || 0;

    if (deposit > 0 && quote <= 0) {
      return "Cannot set deposit without a quoted price";
    }
    if (deposit > quote) {
      return "Deposit amount cannot exceed the quoted price";
    }
    if (payment > quote && quote > 0) {
      return "Payment received cannot exceed the quoted price";
    }
    if (payment < 0 || deposit < 0 || quote < 0) {
      return "Price values cannot be negative";
    }
    return null;
  };

  const isFormValid = getMissingFields().length === 0;

  // ─── Submit Handler ───────────────────────────────────────────
  const handleSubmit = async () => {
    // Double-submit prevention
    const now = Date.now();
    if (isSubmittingRef.current || now - lastSubmitTimeRef.current < 2000) {
      console.warn("[Intake] Double-submit prevented");
      return;
    }

    // Validate required fields
    const missing = getMissingFields();
    if (missing.length > 0) {
      setErrorType('validation');
      setError(`Missing required fields: ${missing.join(", ")}`);
      return;
    }

    // Validate price inputs
    const priceError = validatePriceInputs();
    if (priceError) {
      setErrorType('validation');
      setError(priceError);
      return;
    }

    setError(null);
    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;
    
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
            setErrorType('server');
            setError(result.error);
            isSubmittingRef.current = false;
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
            setErrorType('server');
            setError(result.error);
            isSubmittingRef.current = false;
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
            setErrorType('validation');
            setError("Please select a stock item");
            isSubmittingRef.current = false;
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
            // Distinguish out-of-stock from other errors
            if (result.error.includes("out of stock") || result.error.includes("sold out")) {
              setErrorType('validation');
            } else {
              setErrorType('server');
            }
            setError(result.error);
            isSubmittingRef.current = false;
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
        // Distinguish network errors
        if (err.message?.includes('fetch') || err.message?.includes('network') || err.name === 'TypeError') {
          setErrorType('network');
          setError("Unable to connect to the server. Please check your connection and try again.");
        } else {
          setErrorType('server');
          setError(err.message || "An unexpected error occurred. Please try again.");
        }
        isSubmittingRef.current = false;
      }
    });
  };

  // ─── Reset Form ───────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setSuccessResult(null);
    setSelectedCustomer(null);
    setSelectedInventory(null);
    setRepairData(initialRepairData);
    setBespokeData(initialBespokeData);
    setStockData(initialStockData);
    setError(null);
    isSubmittingRef.current = false;
    lastSubmitTimeRef.current = 0;
  }, []);

  // ─── Dismiss Error ────────────────────────────────────────────
  const dismissError = useCallback(() => {
    setError(null);
  }, []);

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
    <>
      {/* Loading Overlay */}
      {isPending && <LoadingOverlay jobType={jobType} />}

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
                  onClick={() => handleJobTypeChange(type)}
                  disabled={isPending}
                  className={`flex-1 px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                    jobType === type
                      ? "bg-amber-700 text-white shadow-sm"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                  } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
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
            onError={(msg) => {
              setErrorType('server');
              setError(msg);
            }}
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

          {/* Error Banner */}
          {error && (
            <ErrorBanner 
              error={error} 
              errorType={errorType} 
              onDismiss={dismissError} 
            />
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !isFormValid}
              className="px-8 py-2.5 text-sm font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
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
    </>
  );
}
