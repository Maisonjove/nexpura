"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  searchCustomers,
  createCustomerInline,
  searchInventory,
  getInventoryByBarcode,
  createRepairFromIntake,
  createBespokeFromIntake,
  createStockSaleFromIntake,
  type CreateRepairInput,
  type CreateBespokeInput,
  type CreateStockSaleInput,
} from "./actions";
import {
  JEWELLERY_TYPES,
  METAL_TYPES,
  METAL_PURITIES,
  REPAIR_ISSUES,
  PRIORITIES,
  PAYMENT_METHODS,
  RING_SIZES,
} from "./constants";
import type {
  Customer,
  InventoryItem,
  TaxConfig,
  IntakeClientProps as Props,
  JobType,
  SuccessResult,
} from "./types";

// Constants imported from ./constants.ts

// ────────────────────────────────────────────────────────────────
// Styling
// ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all";

const selectCls =
  "w-full px-3.5 py-2.5 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all cursor-pointer";

const labelCls = "block text-sm font-medium text-stone-700 mb-1.5";

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
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Inventory state (for stock item flow)
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryResults, setInventoryResults] = useState<InventoryItem[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);

  // ─── Repair Form State ────────────────────────────────────────
  const [repairData, setRepairData] = useState({
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
  });

  // ─── Bespoke Form State ────────────────────────────────────────
  const [bespokeData, setBespokeData] = useState({
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
  });

  // ─── Stock Sale Form State ────────────────────────────────────
  const [stockData, setStockData] = useState({
    price: "",
    payment_received: "",
    payment_method: "cash",
    create_invoice: true,
  });

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

  const getPaymentReceived = () => {
    if (jobType === "repair") return parseFloat(repairData.payment_received) || 0;
    if (jobType === "bespoke") return parseFloat(bespokeData.payment_received) || 0;
    if (jobType === "stock") return parseFloat(stockData.payment_received) || 0;
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

  // ─── Customer Search ──────────────────────────────────────────
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomers(initialCustomers.slice(0, 8));
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      const result = await searchCustomers(customerSearch);
      if (result.data) {
        setCustomers(result.data);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [customerSearch, initialCustomers]);

  // ─── Inventory Search ─────────────────────────────────────────
  useEffect(() => {
    if (jobType !== "stock" || inventorySearch.length < 2) {
      setInventoryResults([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      const result = await searchInventory(inventorySearch);
      if (result.data) {
        setInventoryResults(result.data);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inventorySearch, jobType]);

  // ─── Create Customer ──────────────────────────────────────────
  const handleCreateCustomer = async () => {
    if (!newCustomer.first_name && !newCustomer.last_name) return;
    
    setIsCreatingCustomer(true);
    const result = await createCustomerInline(newCustomer);
    setIsCreatingCustomer(false);
    
    if (result.error) {
      setError(result.error);
      return;
    }
    
    if (result.id) {
      const customer: Customer = {
        id: result.id,
        full_name: result.full_name || null,
        email: newCustomer.email || null,
        mobile: newCustomer.phone || null,
        phone: newCustomer.phone || null,
      };
      setSelectedCustomer(customer);
      setShowNewCustomerForm(false);
      setNewCustomer({ first_name: "", last_name: "", email: "", phone: "" });
    }
  };

  // ─── Barcode Scan ─────────────────────────────────────────────
  const handleBarcodeScan = async (barcode: string) => {
    const result = await getInventoryByBarcode(barcode);
    if (result.data) {
      setSelectedInventory(result.data);
      setStockData((prev) => ({
        ...prev,
        price: String(result.data.retail_price || ""),
      }));
    }
  };

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
            item_name: selectedInventory.name,
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
      } catch (e: any) {
        setError(e.message || "An error occurred");
      }
    });
  };

  // ─── Reset Form ───────────────────────────────────────────────
  const resetForm = () => {
    setSuccessResult(null);
    setSelectedCustomer(null);
    setSelectedInventory(null);
    setCustomerSearch("");
    setInventorySearch("");
    setRepairData({
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
    });
    setBespokeData({
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
    });
    setStockData({
      price: "",
      payment_received: "",
      payment_method: "cash",
      create_invoice: true,
    });
  };

  // ─── Format Currency ──────────────────────────────────────────
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: taxConfig.currency || "AUD",
    }).format(amount);
  };

  // ─────────────────────────────────────────────────────────────
  // Success State Render
  // ─────────────────────────────────────────────────────────────
  if (successResult) {
    const typeLabels = {
      repair: "Repair",
      bespoke: "Bespoke Job",
      stock: "Sale",
    };
    const detailPaths = {
      repair: `/repairs/${successResult.id}`,
      bespoke: `/bespoke/${successResult.id}`,
      stock: `/sales/${successResult.id}`,
    };
    const workshopPath = successResult.type === "stock" ? null : "/workshop";

    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-white border border-stone-200 rounded-2xl p-10 shadow-sm max-w-lg w-full text-center">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-stone-900 mb-2">
            {typeLabels[successResult.type]} Created
          </h2>
          <p className="text-stone-500 mb-8">
            {successResult.type === "stock" ? "Sale" : "Job"} #{successResult.number} has been created successfully.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Print A4 Invoice */}
            <button
              onClick={() => {
                if (successResult.invoiceId) {
                  window.open(`/api/invoice/${successResult.invoiceId}/pdf`, '_blank');
                } else if (successResult.type === "repair") {
                  window.open(`/repairs/${successResult.id}/print`, '_blank');
                } else {
                  window.print();
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Invoice
            </button>
            
            {/* Print Thermal Receipt */}
            {successResult.invoiceId && (
              <button
                onClick={() => {
                  window.open(`/api/invoice/${successResult.invoiceId}/pdf?format=thermal`, '_blank');
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Print Receipt
              </button>
            )}
            
            <button
              onClick={async () => {
                if (!selectedCustomer?.email) {
                  alert("Customer has no email address");
                  return;
                }
                if (successResult.invoiceId) {
                  try {
                    const res = await fetch(`/api/invoices/${successResult.invoiceId}/email`, { method: "POST" });
                    const data = await res.json();
                    if (data.error) {
                      alert(`Failed to send: ${data.error}`);
                    } else {
                      alert("Invoice emailed successfully!");
                    }
                  } catch {
                    alert("Failed to send email");
                  }
                } else {
                  alert("No invoice to email");
                }
              }}
              disabled={!selectedCustomer?.email}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                selectedCustomer?.email 
                  ? "bg-stone-100 text-stone-700 hover:bg-stone-200" 
                  : "bg-stone-50 text-stone-400 cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Customer
            </button>
          </div>

          {/* Navigation Links */}
          <div className="space-y-2">
            <button
              onClick={() => router.push(detailPaths[successResult.type])}
              className="w-full px-4 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors text-sm font-medium"
            >
              Go to {typeLabels[successResult.type]} Detail
            </button>
            
            {successResult.invoiceId && (
              <button
                onClick={() => router.push(`/invoices/${successResult.invoiceId}`)}
                className="w-full px-4 py-2.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Invoice
              </button>
            )}
            
            {workshopPath && (
              <button
                onClick={() => router.push(workshopPath)}
                className="w-full px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
              >
                View in Workshop
              </button>
            )}
            
            {selectedCustomer && (
              <button
                onClick={() => router.push(`/customers/${selectedCustomer.id}`)}
                className="w-full px-4 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium"
              >
                View Customer
              </button>
            )}
            
            <button
              onClick={resetForm}
              className="w-full px-4 py-2.5 text-amber-700 hover:text-amber-800 transition-colors text-sm font-medium"
            >
              Create Another Job →
            </button>
          </div>
        </div>
      </div>
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

        {/* ─── Customer Section ──────────────────────────────── */}
        <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-stone-900">Customer</h2>
            {selectedCustomer && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerSearch("");
                }}
                className="text-sm text-stone-500 hover:text-stone-900"
              >
                Change
              </button>
            )}
          </div>

          {selectedCustomer ? (
            // Selected Customer Card
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-700 font-semibold">
                    {selectedCustomer.full_name?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">{selectedCustomer.full_name || "Unknown"}</p>
                  {(selectedCustomer.email || selectedCustomer.mobile || selectedCustomer.phone) && (
                    <p className="text-sm text-stone-500 truncate">
                      {selectedCustomer.email || selectedCustomer.mobile || selectedCustomer.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : showNewCustomerForm ? (
            // New Customer Form
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <input
                    type="text"
                    value={newCustomer.first_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                    placeholder="First name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input
                    type="text"
                    value={newCustomer.last_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                    placeholder="Last name"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="email@example.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="04XX XXX XXX"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  disabled={isCreatingCustomer || (!newCustomer.first_name && !newCustomer.last_name)}
                  className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 disabled:opacity-50 transition-colors"
                >
                  {isCreatingCustomer ? "Creating..." : "Create Customer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCustomerForm(false);
                    setNewCustomer({ first_name: "", last_name: "", email: "", phone: "" });
                  }}
                  className="px-4 py-2 text-stone-600 text-sm font-medium hover:text-stone-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Customer Search
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="Search by name, phone, or email..."
                className={inputCls}
              />
              {showCustomerDropdown && customers.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setShowCustomerDropdown(false);
                        setCustomerSearch("");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0"
                    >
                      <p className="font-medium text-stone-900 text-sm">{c.full_name}</p>
                      {(c.email || c.mobile || c.phone) && (
                        <p className="text-xs text-stone-500">{c.email || c.mobile || c.phone}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-stone-400">Customer not found?</span>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerForm(true)}
                  className="text-amber-700 hover:text-amber-800 font-medium"
                >
                  Create new customer →
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-1">Optional — leave blank for walk-in</p>
            </div>
          )}
        </section>

        {/* ─── Repair Form ───────────────────────────────────── */}
        {jobType === "repair" && (
          <>
            {/* Item Intake */}
            <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Item Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Item Type *</label>
                  <select
                    value={repairData.item_type}
                    onChange={(e) => setRepairData({ ...repairData, item_type: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select type...</option>
                    {JEWELLERY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Metal Type</label>
                  <select
                    value={repairData.metal_type}
                    onChange={(e) => setRepairData({ ...repairData, metal_type: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select metal...</option>
                    {METAL_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className={labelCls}>Item Description *</label>
                <textarea
                  value={repairData.item_description}
                  onChange={(e) => setRepairData({ ...repairData, item_description: e.target.value })}
                  placeholder="Describe the piece in detail..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}>Stones</label>
                  <input
                    type="text"
                    value={repairData.stones}
                    onChange={(e) => setRepairData({ ...repairData, stones: e.target.value })}
                    placeholder="e.g. 1x diamond, 2x sapphire"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Size / Length</label>
                  <input
                    type="text"
                    value={repairData.size_length}
                    onChange={(e) => setRepairData({ ...repairData, size_length: e.target.value })}
                    placeholder="e.g. Size M, 45cm"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className={labelCls}>Identifying Details</label>
                <input
                  type="text"
                  value={repairData.identifying_details}
                  onChange={(e) => setRepairData({ ...repairData, identifying_details: e.target.value })}
                  placeholder="Serial number, hallmarks, engravings..."
                  className={inputCls}
                />
              </div>
              <div className="mt-4">
                <label className={labelCls}>Condition Notes</label>
                <textarea
                  value={repairData.condition_notes}
                  onChange={(e) => setRepairData({ ...repairData, condition_notes: e.target.value })}
                  placeholder="Note any existing damage, scratches, or wear..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </section>

            {/* Work Required */}
            <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Work Required</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Issue Type</label>
                  <select
                    value={repairData.issue_type}
                    onChange={(e) => setRepairData({ ...repairData, issue_type: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select issue...</option>
                    {REPAIR_ISSUES.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select
                    value={repairData.priority}
                    onChange={(e) => setRepairData({ ...repairData, priority: e.target.value })}
                    className={selectCls}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className={labelCls}>Work Description</label>
                <textarea
                  value={repairData.work_description}
                  onChange={(e) => setRepairData({ ...repairData, work_description: e.target.value })}
                  placeholder="Detailed instructions for the repair..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div className="mt-4">
                <label className={labelCls}>Risk / Damage Notes</label>
                <textarea
                  value={repairData.risk_notes}
                  onChange={(e) => setRepairData({ ...repairData, risk_notes: e.target.value })}
                  placeholder="Any risks or potential issues to note..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </section>

            {/* Pricing & Payment */}
            <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Pricing & Payment</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={repairData.quoted_price}
                      onChange={(e) => setRepairData({ ...repairData, quoted_price: e.target.value })}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Deposit Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={repairData.deposit_amount}
                      onChange={(e) => setRepairData({ ...repairData, deposit_amount: e.target.value })}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}>Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={Math.max(0, (parseFloat(repairData.quoted_price) || 0) - (parseFloat(repairData.deposit_amount) || 0)).toFixed(2)}
                      readOnly
                      className={`${inputCls} pl-7 bg-stone-50 cursor-not-allowed`}
                    />
                  </div>
                  <p className="text-xs text-stone-400 mt-1">Auto-calculated: Amount - Deposit</p>
                </div>
                <div>
                  <label className={labelCls}>Payment Method</label>
                  <select
                    value={repairData.payment_method}
                    onChange={(e) => setRepairData({ ...repairData, payment_method: e.target.value })}
                    className={selectCls}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className={labelCls}>Due Date</label>
                <input
                  type="date"
                  value={repairData.due_date}
                  onChange={(e) => setRepairData({ ...repairData, due_date: e.target.value })}
                  className={inputCls}
                />
              </div>
            </section>
          </>
        )}

        {/* ─── Bespoke Form ──────────────────────────────────── */}
        {jobType === "bespoke" && (
          <>
            {/* Job Core */}
            <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Job Details</h2>
              <div>
                <label className={labelCls}>Title *</label>
                <input
                  type="text"
                  value={bespokeData.title}
                  onChange={(e) => setBespokeData({ ...bespokeData, title: e.target.value })}
                  placeholder="e.g. Custom Engagement Ring"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}>Jewellery Type</label>
                  <select
                    value={bespokeData.jewellery_type}
                    onChange={(e) => setBespokeData({ ...bespokeData, jewellery_type: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select type...</option>
                    {JEWELLERY_TYPES.map((t) => (
                      <option key={t} value={t.toLowerCase()}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select
                    value={bespokeData.priority}
                    onChange={(e) => setBespokeData({ ...bespokeData, priority: e.target.value })}
                    className={selectCls}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className={labelCls}>Brief / Description</label>
                <textarea
                  value={bespokeData.description}
                  onChange={(e) => setBespokeData({ ...bespokeData, description: e.target.value })}
                  placeholder="Describe what the customer wants..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div className="mt-4">
                <label className={labelCls}>Design Source / Inspiration</label>
                <input
                  type="text"
                  value={bespokeData.design_source}
                  onChange={(e) => setBespokeData({ ...bespokeData, design_source: e.target.value })}
                  placeholder="Reference images, sketches, existing pieces..."
                  className={inputCls}
                />
              </div>
            </section>

            {/* Specifications */}
            <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Specifications</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Metal Type</label>
                  <select
                    value={bespokeData.metal_type}
                    onChange={(e) => setBespokeData({ ...bespokeData, metal_type: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select metal...</option>
                    {METAL_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Metal Colour</label>
                  <select
                    value={bespokeData.metal_colour}
                    onChange={(e) => setBespokeData({ ...bespokeData, metal_colour: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select colour...</option>
                    <option value="yellow">Yellow</option>
                    <option value="white">White</option>
                    <option value="rose">Rose</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Purity</label>
                  <select
                    value={bespokeData.metal_purity}
                    onChange={(e) => setBespokeData({ ...bespokeData, metal_purity: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select purity...</option>
                    {METAL_PURITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}>Stone Type</label>
                  <select
                    value={bespokeData.stone_type}
                    onChange={(e) => setBespokeData({ ...bespokeData, stone_type: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select stone...</option>
                    <option value="diamond">Diamond</option>
                    <option value="lab_diamond">Lab Diamond</option>
                    <option value="sapphire">Sapphire</option>
                    <option value="ruby">Ruby</option>
                    <option value="emerald">Emerald</option>
                    <option value="pearl">Pearl</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Stone Details</label>
                  <input
                    type="text"
                    value={bespokeData.stone_details}
                    onChange={(e) => setBespokeData({ ...bespokeData, stone_details: e.target.value })}
                    placeholder="e.g. 1.5ct, F colour, VS1"
                    className={inputCls}
                  />
                </div>
              </div>
              {bespokeData.jewellery_type === "ring" && (
                <div className="mt-4">
                  <label className={labelCls}>Ring Size</label>
                  <select
                    value={bespokeData.ring_size}
                    onChange={(e) => setBespokeData({ ...bespokeData, ring_size: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select size...</option>
                    {RING_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mt-4">
                <label className={labelCls}>Additional Notes</label>
                <textarea
                  value={bespokeData.notes}
                  onChange={(e) => setBespokeData({ ...bespokeData, notes: e.target.value })}
                  placeholder="Any other specifications or requirements..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </section>

            {/* Pricing & Payment */}
            <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Pricing & Payment</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bespokeData.quoted_price}
                      onChange={(e) => setBespokeData({ ...bespokeData, quoted_price: e.target.value })}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Deposit Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bespokeData.deposit_amount}
                      onChange={(e) => setBespokeData({ ...bespokeData, deposit_amount: e.target.value })}
                      placeholder="0.00"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}>Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={Math.max(0, (parseFloat(bespokeData.quoted_price) || 0) - (parseFloat(bespokeData.deposit_amount) || 0)).toFixed(2)}
                      readOnly
                      className={`${inputCls} pl-7 bg-stone-50 cursor-not-allowed`}
                    />
                  </div>
                  <p className="text-xs text-stone-400 mt-1">Auto-calculated: Amount - Deposit</p>
                </div>
                <div>
                  <label className={labelCls}>Payment Method</label>
                  <select
                    value={bespokeData.payment_method}
                    onChange={(e) => setBespokeData({ ...bespokeData, payment_method: e.target.value })}
                    className={selectCls}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className={labelCls}>Due Date</label>
                <input
                  type="date"
                  value={bespokeData.due_date}
                  onChange={(e) => setBespokeData({ ...bespokeData, due_date: e.target.value })}
                  className={inputCls}
                />
              </div>
            </section>
          </>
        )}

        {/* ─── Stock Item Form ───────────────────────────────── */}
        {jobType === "stock" && (
          <>
            {/* Stock Search */}
            <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-4">Stock Item</h2>
              
              {selectedInventory ? (
                // Selected Item Card
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    {selectedInventory.primary_image ? (
                      <img
                        src={selectedInventory.primary_image}
                        alt={selectedInventory.name}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-stone-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-stone-900">{selectedInventory.name}</p>
                          <p className="text-sm text-stone-500">
                            SKU: {selectedInventory.sku || "—"}
                          </p>
                          {selectedInventory.metal_type && (
                            <p className="text-sm text-stone-500 capitalize">
                              {selectedInventory.metal_type} {selectedInventory.metal_purity}
                              {selectedInventory.stone_type && ` • ${selectedInventory.stone_type}`}
                              {selectedInventory.stone_carat && ` ${selectedInventory.stone_carat}ct`}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInventory(null);
                            setInventorySearch("");
                            setStockData({ ...stockData, price: "" });
                          }}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-4">
                        <span className="text-lg font-semibold text-amber-700">
                          {formatCurrency(selectedInventory.retail_price || 0)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          (selectedInventory.quantity || 0) > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {selectedInventory.quantity || 0} in stock
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Search Box
                <div className="relative">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={inventorySearch}
                      onChange={(e) => {
                        setInventorySearch(e.target.value);
                        setShowInventoryDropdown(true);
                      }}
                      onFocus={() => setShowInventoryDropdown(true)}
                      placeholder="Search by SKU, name, or scan barcode..."
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  {showInventoryDropdown && inventoryResults.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {inventoryResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedInventory(item);
                            setShowInventoryDropdown(false);
                            setInventorySearch("");
                            setStockData({
                              ...stockData,
                              price: String(item.retail_price || ""),
                            });
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            {item.primary_image ? (
                              <img src={item.primary_image} alt="" className="w-10 h-10 object-cover rounded" />
                            ) : (
                              <div className="w-10 h-10 bg-stone-100 rounded flex items-center justify-center">
                                <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-stone-900 text-sm truncate">{item.name}</p>
                              <p className="text-xs text-stone-500">SKU: {item.sku || "—"}</p>
                            </div>
                            <span className="text-sm font-medium text-amber-700">
                              {formatCurrency(item.retail_price || 0)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Payment */}
            {selectedInventory && (
              <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
                <h2 className="text-base font-semibold text-stone-900 mb-4">Payment</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Sale Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={stockData.price}
                        onChange={(e) => setStockData({ ...stockData, price: e.target.value })}
                        placeholder={String(selectedInventory.retail_price || 0)}
                        className={`${inputCls} pl-7`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Payment Received</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={stockData.payment_received}
                        onChange={(e) => setStockData({ ...stockData, payment_received: e.target.value })}
                        placeholder="0.00"
                        className={`${inputCls} pl-7`}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls}>Payment Method</label>
                  <select
                    value={stockData.payment_method}
                    onChange={(e) => setStockData({ ...stockData, payment_method: e.target.value })}
                    className={selectCls}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create_invoice"
                    checked={stockData.create_invoice}
                    onChange={(e) => setStockData({ ...stockData, create_invoice: e.target.checked })}
                    className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="create_invoice" className="text-sm text-stone-700">
                    Generate invoice
                  </label>
                </div>
              </section>
            )}
          </>
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
      <div className="w-80 flex-shrink-0">
        <div className="sticky top-8">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
              <h3 className="font-semibold text-stone-900">Job Summary</h3>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Job Type */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Job Type</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  jobType === "repair"
                    ? "bg-blue-50 text-blue-700"
                    : jobType === "bespoke"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-green-50 text-green-700"
                }`}>
                  {jobType === "repair" ? "Repair" : jobType === "bespoke" ? "Bespoke" : "Stock Sale"}
                </span>
              </div>

              {/* Customer */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Customer</span>
                <span className="text-sm font-medium text-stone-900 text-right truncate max-w-[140px]">
                  {selectedCustomer?.full_name || "Walk-in"}
                </span>
              </div>

              {/* Item Type */}
              {getItemType() && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-500">Item Type</span>
                  <span className="text-sm font-medium text-stone-900 capitalize">
                    {getItemType()}
                  </span>
                </div>
              )}

              {/* Priority */}
              {jobType !== "stock" && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-500">Priority</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                    PRIORITIES.find((p) => p.value === getPriority())?.color || "bg-stone-100 text-stone-600"
                  }`}>
                    {getPriority()}
                  </span>
                </div>
              )}

              {/* Due Date */}
              {getDueDate() && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-500">Due Date</span>
                  <span className="text-sm font-medium text-stone-900">
                    {new Date(getDueDate()).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-stone-100 my-4" />

              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Amount</span>
                <span className="text-sm font-semibold text-stone-900">
                  {formatCurrency(getQuoteAmount())}
                </span>
              </div>

              {/* Deposit */}
              {getDepositAmount() > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone-500">Deposit</span>
                  <span className="text-sm text-stone-700">
                    {formatCurrency(getDepositAmount())}
                  </span>
                </div>
              )}

              {/* Balance */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                <span className="text-sm font-medium text-stone-700">Balance</span>
                <span className={`text-base font-bold ${
                  getBalanceRemaining() > 0 ? "text-amber-700" : "text-green-600"
                }`}>
                  {formatCurrency(getBalanceRemaining())}
                </span>
              </div>

              {/* Missing Fields */}
              {getMissingFields().length > 0 && (
                <div className="mt-4 pt-4 border-t border-stone-100">
                  <p className="text-xs font-medium text-stone-500 mb-2">Required fields:</p>
                  <ul className="space-y-1">
                    {getMissingFields().map((field) => (
                      <li key={field} className="text-xs text-red-500 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-red-400 rounded-full" />
                        {field}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
