"use client";

import { useState, useTransition, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AlertCircle, X, WifiOff } from "lucide-react";
import { useLocation } from "@/contexts/LocationContext";
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
// Static imports: rendered on every paint of the intake screen.
import {
  CustomerSection,
  SummaryPanel,
  SegmentedTypeSelector,
  ProgressIndicator,
  getSteps,
  type MissingField,
} from "./components";
import type { RepairData, BespokeData, StockData } from "./components";

// Dynamic imports: tab-specific form components. Only the tab the user is
// viewing gets fetched. RepairForm is the default-selected tab so it's
// still likely in the critical path on first visit, but each form is now
// its own chunk so a session that only creates repairs never downloads
// the bespoke/stock bundles. Together these split ~1500 lines of client
// JS out of the initial bundle.
//
// Each tab form renders a shell while its chunk loads so tab switching
// doesn't show a jarring empty space.
const TabFormFallback = () => (
  <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-2xl p-6 space-y-5 animate-pulse">
    <div className="h-5 w-32 bg-nexpura-taupe-100 rounded" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-11 bg-nexpura-taupe-100 rounded-lg" />
      <div className="h-11 bg-nexpura-taupe-100 rounded-lg" />
    </div>
    <div className="h-24 bg-nexpura-taupe-100 rounded-lg" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-11 bg-nexpura-taupe-100 rounded-lg" />
      <div className="h-11 bg-nexpura-taupe-100 rounded-lg" />
    </div>
  </div>
);

const RepairForm = dynamic(() => import("./components/RepairForm"), {
  loading: TabFormFallback,
  ssr: true,
});
const BespokeForm = dynamic(() => import("./components/BespokeForm"), {
  loading: TabFormFallback,
  ssr: false,
});
const StockSaleForm = dynamic(() => import("./components/StockSaleForm"), {
  loading: TabFormFallback,
  ssr: false,
});
const SuccessScreen = dynamic(() => import("./components/SuccessScreen"), { ssr: false });

// ────────────────────────────────────────────────────────────────
// Initial State
// ────────────────────────────────────────────────────────────────

const initialRepairData: RepairData = {
  item_type: "",
  item_description: "",
  metal_type: "",
  metal_purity: "",
  metal_colour: "",
  stones: "",
  stone_count: "",
  size_length: "",
  current_size: "",
  hallmark: "",
  engraving: "",
  brand: "",
  serial_number: "",
  identifying_details: "",
  condition_notes: "",
  is_heirloom: false,
  customer_supplied: false,
  is_high_value: false,
  issue_type: "",
  work_description: "",
  risk_notes: "",
  priority: "normal",
  due_date: "",
  assigned_staff: "",
  resize_from: "",
  resize_to: "",
  replacement_stone_type: "",
  replacement_stone_shape: "",
  replacement_stone_carat: "",
  clasp_type: "",
  quoted_price: "",
  deposit_amount: "",
  payment_received: "",
  payment_method: "cash",
  discount_amount: "",
  payment_notes: "",
  repair_reference: "",
  assigned_salesperson: "",
  job_complete: false,
  job_complete_date: "",
  collected_by: "",
  collected_on: "",
  collection_status: "",
  workshop_routing: "",
  internal_notes: "",
  customer_communication_notes: "",
  followup_comments: "",
  reminder_date: "",
  delivery_notes: "",
};

const initialBespokeData: BespokeData = {
  title: "",
  jewellery_type: "",
  description: "",
  design_source: "",
  budget: "",
  timeline: "",
  metal_type: "",
  metal_colour: "",
  metal_purity: "",
  stone_type: "",
  stone_details: "",
  stone_count: "",
  stone_shape: "",
  setting_style: "",
  ring_size: "",
  dimensions: "",
  notes: "",
  priority: "normal",
  due_date: "",
  quoted_price: "",
  deposit_amount: "",
  payment_received: "",
  payment_method: "cash",
  discount_amount: "",
  payment_notes: "",
  job_reference: "",
  assigned_salesperson: "",
  job_complete: false,
  job_complete_date: "",
  collected_by: "",
  collected_on: "",
  collection_status: "",
  workshop_routing: "",
  internal_notes: "",
  customer_communication_notes: "",
  followup_comments: "",
  reminder_date: "",
  delivery_notes: "",
};

const initialStockData: StockData = {
  price: "",
  payment_received: "",
  payment_method: "cash",
  create_invoice: true,
};

// ────────────────────────────────────────────────────────────────
// URL <-> jobType bridging
// ────────────────────────────────────────────────────────────────

function isJobType(s: string | null): s is JobType {
  return s === "repair" || s === "bespoke" || s === "stock";
}

// ────────────────────────────────────────────────────────────────
// Error Banner
// ────────────────────────────────────────────────────────────────

function ErrorBanner({
  error,
  errorType,
  onDismiss,
}: {
  error: string;
  errorType: "validation" | "server" | "network";
  onDismiss: () => void;
}) {
  const titles = {
    validation: "Please fix the following",
    server: "Something went wrong",
    network: "Connection issue",
  };

  // All errors render in the oxblood family — Section 12 has no amber
  // surfaces. Validation/server use the standard oxblood; network uses
  // the same palette + a wifi icon so the visual distinction stays.
  const Icon = errorType === "network" ? WifiOff : AlertCircle;

  return (
    <div className="bg-nexpura-oxblood-bg border border-nexpura-oxblood/20 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-nexpura-oxblood shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
        <div className="flex-1">
          <h4 className="font-medium text-nexpura-oxblood mb-1">{titles[errorType]}</h4>
          <p className="text-sm text-nexpura-charcoal-700">{error}</p>
          {errorType === "server" && (
            <p className="text-xs text-nexpura-charcoal-500 mt-2">
              Your data has not been lost. Try again, or contact support if this persists.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-nexpura-oxblood hover:opacity-70"
          aria-label="Dismiss error"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Loading Overlay
// ────────────────────────────────────────────────────────────────

function LoadingOverlay({ jobType }: { jobType: JobType }) {
  const labels = {
    repair: "Creating repair",
    bespoke: "Creating bespoke job",
    stock: "Processing sale",
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full mx-4 text-center">
        <div className="w-12 h-12 border-4 border-nexpura-charcoal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-nexpura-charcoal mb-1">{labels[jobType]}…</h3>
        <p className="text-sm text-nexpura-charcoal-500">Please wait, do not close this page</p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Location Gate — surfaced when the tenant has 2+ locations and no
// specific location has been selected yet. The server's
// resolveLocationForCreate would reject the create in this state, and
// the (intake-workspace) shell doesn't render the TopNav location
// switcher, so without this banner the user has no way to satisfy the
// requirement from inside /intake.
// ────────────────────────────────────────────────────────────────

function LocationGate() {
  const { locations, currentLocationId, setCurrentLocationId, setViewMode } = useLocation();

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 mb-1">Pick a location to continue</h4>
          <p className="text-sm text-amber-800 mb-3">
            New jobs are stamped with a single location. You're currently viewing all locations — choose one before creating this job.
          </p>
          <select
            value={currentLocationId || ""}
            onChange={(e) => {
              const id = e.target.value;
              if (id) {
                setCurrentLocationId(id);
                setViewMode("single");
              }
            }}
            className="w-full max-w-sm px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            <option value="">Select a location…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────

export default function IntakeClient({ initialCustomers, taxConfig }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"validation" | "server" | "network">("server");

  // The server's resolveLocationForCreate rejects creates when the user is in
  // "All Locations" view AND the tenant has 2+ active locations. Surface that
  // upfront so the Save button stays disabled and the missing-fields hint
  // tells the user what to do, instead of letting them fill the entire form
  // and only failing at submit.
  const { locations: visibleLocations, currentLocationId } = useLocation();
  const requiresLocationSelection =
    visibleLocations.length >= 2 && !currentLocationId;

  // Double-submit prevention
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  // Job type — initialised from URL (?type=repair|bespoke|stock) so
  // deep-links and back/forward keep selection in sync. Falls back to
  // "repair".
  const initialType: JobType = (() => {
    const t = searchParams.get("type");
    return isJobType(t) ? t : "repair";
  })();
  const [jobType, setJobType] = useState<JobType>(initialType);

  // Success state
  const [successResult, setSuccessResult] = useState<SuccessResult | null>(null);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);

  // Inventory state (for stock sale)
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);

  // Form data states
  const [repairData, setRepairData] = useState<RepairData>(initialRepairData);
  const [bespokeData, setBespokeData] = useState<BespokeData>(initialBespokeData);
  const [stockData, setStockData] = useState<StockData>(initialStockData);

  // ─── URL sync (?type=…) ───────────────────────────────────────
  useEffect(() => {
    const current = searchParams.get("type");
    if (current === jobType) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("type", jobType);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobType]);

  // Keep state in sync if the URL changes via back/forward.
  useEffect(() => {
    const t = searchParams.get("type");
    if (isJobType(t) && t !== jobType) {
      setJobType(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ─── Walk-in Toggle Handler ───────────────────────────────────
  const handleWalkInToggle = useCallback((value: boolean) => {
    setIsWalkIn(value);
    if (value) {
      setSelectedCustomer(null);
    }
  }, []);

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
    if (jobType === "stock")
      return parseFloat(stockData.price) || selectedInventory?.retail_price || 0;
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

  const getJobTitle = () => {
    if (jobType === "bespoke") return bespokeData.title;
    return undefined;
  };

  // ─── Validation / step tracking ───────────────────────────────
  const steps = useMemo(() => getSteps(jobType), [jobType]);

  // Step 0 is always Customer for all flows. The remaining steps map to
  // form-section completeness; the existing forms render every section
  // in one column so we use these as visual milestones rather than
  // gating navigation. The "Review" step is considered complete only
  // when all required fields are satisfied.
  const customerComplete = !!selectedCustomer || isWalkIn;

  const repairItemComplete = !!repairData.item_type && !!repairData.item_description;
  const repairWorkComplete =
    !!repairData.issue_type || !!repairData.work_description.trim();
  const repairPricingComplete = !!repairData.quoted_price;

  const bespokeBriefComplete = !!bespokeData.title;
  const bespokeDesignComplete =
    !!bespokeData.jewellery_type || !!bespokeData.description.trim();
  const bespokeMaterialsComplete = !!bespokeData.metal_type || !!bespokeData.stone_type;
  const bespokePricingComplete = !!bespokeData.quoted_price;

  const stockItemComplete = !!selectedInventory;
  const stockSaleComplete = !!selectedInventory && (parseFloat(stockData.price) > 0 || (selectedInventory?.retail_price ?? 0) > 0);
  const stockPaymentComplete = !!stockData.payment_method;

  // ─── Build per-step completion array ──────────────────────────
  const stepCompletion: boolean[] = useMemo(() => {
    if (jobType === "repair") {
      return [
        customerComplete,
        repairItemComplete,
        repairWorkComplete,
        repairPricingComplete,
        // "Review" — completed when everything else is.
        customerComplete && repairItemComplete && repairWorkComplete && repairPricingComplete,
      ];
    }
    if (jobType === "bespoke") {
      return [
        customerComplete,
        bespokeBriefComplete,
        bespokeDesignComplete,
        bespokeMaterialsComplete,
        bespokePricingComplete,
        customerComplete &&
          bespokeBriefComplete &&
          bespokeDesignComplete &&
          bespokeMaterialsComplete &&
          bespokePricingComplete,
      ];
    }
    // stock
    return [
      customerComplete,
      stockItemComplete,
      stockSaleComplete,
      stockPaymentComplete,
      customerComplete && stockItemComplete && stockSaleComplete && stockPaymentComplete,
    ];
  }, [
    jobType,
    customerComplete,
    repairItemComplete,
    repairWorkComplete,
    repairPricingComplete,
    bespokeBriefComplete,
    bespokeDesignComplete,
    bespokeMaterialsComplete,
    bespokePricingComplete,
    stockItemComplete,
    stockSaleComplete,
    stockPaymentComplete,
  ]);

  const completedSet = useMemo(() => {
    const set = new Set<number>();
    stepCompletion.forEach((ok, i) => ok && set.add(i));
    return set;
  }, [stepCompletion]);

  // Current step = first incomplete step (Review when everything is done).
  const currentStepIndex = useMemo(() => {
    const firstIncomplete = stepCompletion.findIndex((ok) => !ok);
    return firstIncomplete === -1 ? steps.length - 1 : firstIncomplete;
  }, [stepCompletion, steps.length]);

  // Anchor IDs match step ids (see ProgressIndicator). RepairForm /
  // BespokeForm / StockSaleForm don't currently emit per-section anchors,
  // so jumping to those steps falls back to the form container.
  const handleJumpToStep = useCallback(
    (index: number) => {
      const stepId = steps[index]?.id;
      if (!stepId) return;
      const target =
        document.getElementById(`step-${stepId}`) ?? document.getElementById("intake-form-area");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [steps]
  );

  // ─── Missing required fields (with step links) ────────────────
  const missingFields: MissingField[] = useMemo(() => {
    const out: MissingField[] = [];
    if (requiresLocationSelection) {
      out.push({ label: "Pick a location (use the switcher in the header)", stepIndex: 0 });
    }
    if (!customerComplete) {
      out.push({ label: "Customer (or tick walk-in)", stepIndex: 0 });
    }
    if (jobType === "repair") {
      if (!repairData.item_type) out.push({ label: "Item type", stepIndex: 1 });
      if (!repairData.item_description) out.push({ label: "Item description", stepIndex: 1 });
    } else if (jobType === "bespoke") {
      if (!bespokeData.title) out.push({ label: "Title", stepIndex: 1 });
    } else if (jobType === "stock") {
      if (!selectedInventory) out.push({ label: "Stock item", stepIndex: 1 });
    }
    return out;
  }, [
    requiresLocationSelection,
    customerComplete,
    jobType,
    repairData.item_type,
    repairData.item_description,
    bespokeData.title,
    selectedInventory,
  ]);

  // ─── Warnings (heuristic — high-value etc.) ────────────────────
  const warnings: string[] = useMemo(() => {
    const w: string[] = [];
    const quote = getQuoteAmount();
    if (quote >= 5000) {
      w.push("High value — risk acknowledgement required.");
    }
    if (jobType === "repair" && repairData.is_high_value && !repairData.risk_notes.trim()) {
      w.push("High-value repair flagged — add risk notes before completing.");
    }
    if (jobType === "repair" && repairData.customer_supplied && !repairData.risk_notes.trim()) {
      w.push("Customer-supplied stones — record condition notes.");
    }
    return w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobType, repairData.is_high_value, repairData.customer_supplied, repairData.risk_notes, repairData.quoted_price, bespokeData.quoted_price, stockData.price, selectedInventory]);

  const validatePriceInputs = (): string | null => {
    const quote = getQuoteAmount();
    const deposit = getDepositAmount();
    const payment =
      jobType === "repair"
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

  const isFormValid = missingFields.length === 0;

  // ─── Submit Handler ───────────────────────────────────────────
  const handleSubmit = async () => {
    // Double-submit prevention
    const now = Date.now();
    if (isSubmittingRef.current || now - lastSubmitTimeRef.current < 2000) {
      console.warn("[Intake] Double-submit prevented");
      return;
    }

    if (missingFields.length > 0) {
      setErrorType("validation");
      setError(`Missing required fields: ${missingFields.map((m) => m.label).join(", ")}`);
      return;
    }

    const priceError = validatePriceInputs();
    if (priceError) {
      setErrorType("validation");
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
            payment_received: repairData.payment_received
              ? parseFloat(repairData.payment_received)
              : null,
            payment_method: repairData.payment_method || null,
          };

          const result = await createRepairFromIntake(input);
          if (result.error) {
            setErrorType("server");
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
            deposit_amount: bespokeData.deposit_amount
              ? parseFloat(bespokeData.deposit_amount)
              : null,
            payment_received: bespokeData.payment_received
              ? parseFloat(bespokeData.payment_received)
              : null,
            payment_method: bespokeData.payment_method || null,
          };

          const result = await createBespokeFromIntake(input);
          if (result.error) {
            setErrorType("server");
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
            setErrorType("validation");
            setError("Please select a stock item");
            isSubmittingRef.current = false;
            return;
          }

          const input: CreateStockSaleInput = {
            customer_id: selectedCustomer?.id || null,
            inventory_id: selectedInventory.id,
            item_name: selectedInventory.name || "Unknown Item",
            price: parseFloat(stockData.price) || selectedInventory.retail_price || 0,
            payment_received: stockData.payment_received
              ? parseFloat(stockData.payment_received)
              : null,
            payment_method: stockData.payment_method || null,
            create_invoice: stockData.create_invoice,
          };

          const result = await createStockSaleFromIntake(input);
          if (result.error) {
            if (result.error.includes("out of stock") || result.error.includes("sold out")) {
              setErrorType("validation");
            } else {
              setErrorType("server");
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
        if (err.message?.includes("fetch") || err.message?.includes("network") || err.name === "TypeError") {
          setErrorType("network");
          setError("Unable to connect to the server. Please check your connection and try again.");
        } else {
          setErrorType("server");
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
    setIsWalkIn(false);
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

  // ─── Cancel Handler ───────────────────────────────────────────
  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  // ─────────────────────────────────────────────────────────────
  // Success State Render
  // ─────────────────────────────────────────────────────────────
  if (successResult) {
    return (
      <SuccessScreen result={successResult} selectedCustomer={selectedCustomer} onReset={resetForm} />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Main Render — Section 12 shell
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {isPending && <LoadingOverlay jobType={jobType} />}

      <div className="flex flex-col lg:flex-row lg:gap-8">
        {/* ─── Left main (~70%) ─────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* 12.1 — Segmented type selector */}
          <SegmentedTypeSelector value={jobType} onChange={handleJobTypeChange} disabled={isPending} />

          {/* 12.2 — Slim progress indicator */}
          <ProgressIndicator
            jobType={jobType}
            currentIndex={currentStepIndex}
            completedSet={completedSet}
            onStepClick={handleJumpToStep}
          />

          <div id="intake-form-area">
            {requiresLocationSelection && (
              <LocationGate />
            )}

            {/* Customer Section — id="step-customer" lives inside */}
            <CustomerSection
              initialCustomers={initialCustomers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              onError={(msg) => {
                setErrorType("server");
                setError(msg);
              }}
              isWalkIn={isWalkIn}
              onWalkInToggle={handleWalkInToggle}
            />

            {/* Form based on job type */}
            {jobType === "repair" && <RepairForm data={repairData} onChange={setRepairData} />}

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
            {error && <ErrorBanner error={error} errorType={errorType} onDismiss={dismissError} />}
          </div>
        </div>

        {/* ─── Right sidebar (~30%) ─────────────────────────── */}
        <SummaryPanel
          jobType={jobType}
          selectedCustomer={selectedCustomer}
          itemType={getItemType()}
          jobTitle={getJobTitle()}
          priority={getPriority()}
          dueDate={getDueDate()}
          quoteAmount={getQuoteAmount()}
          depositAmount={getDepositAmount()}
          balanceRemaining={getBalanceRemaining()}
          missingFields={missingFields}
          warnings={warnings}
          steps={steps}
          completedCount={completedSet.size}
          taxConfig={taxConfig}
          isWalkIn={isWalkIn}
          isFormValid={isFormValid}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onJumpToStep={handleJumpToStep}
        />
      </div>
    </>
  );
}
