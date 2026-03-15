"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPOSSale, createLaybySale } from "./actions";
import { lookupVoucher } from "../vouchers/actions";
import CameraScannerModal from "@/components/CameraScannerModal";

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  retail_price: number;
  quantity: number;
  primary_image: string | null;
  jewellery_type: string | null;
  item_type: string | null;
  status: string;
}

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  store_credit: number | null;
}

interface CartItem {
  inventoryId: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  itemType: string | null;
}

interface Props {
  tenantId: string;
  userId: string;
  inventoryItems: InventoryItem[];
  customers: Customer[];
  taxRate: number;
}

const CATEGORIES = ["All", "ring", "necklace", "earring", "bracelet", "loose_stone"];
const CATEGORY_LABELS: Record<string, string> = {
  All: "All",
  ring: "Rings",
  necklace: "Necklaces",
  earring: "Earrings",
  bracelet: "Bracelets",
  loose_stone: "Loose Stones",
};

type PaymentTab = "card" | "cash" | "split" | "voucher" | "store_credit" | "layby";
type SaleResult = { id: string; saleNumber: string; invoiceId?: string; customerEmail?: string | null; cartSnapshot?: CartItem[]; paymentMethod?: string; depositAmount?: number; totalAmount?: number };

export default function POSClient({ tenantId, userId, inventoryItems, customers, taxRate }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [discountType, setDiscountType] = useState<"$" | "%">("$");
  const [discountValue, setDiscountValue] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTab, setPaymentTab] = useState<PaymentTab>("card");
  const [cashTendered, setCashTendered] = useState("");
  const [splitCard, setSplitCard] = useState("");
  const [splitCash, setSplitCash] = useState("");
  // Split payment with voucher state
  const [splitVoucherCode, setSplitVoucherCode] = useState("");
  const [splitVoucherData, setSplitVoucherData] = useState<{ id: string; code: string; balance: number } | null>(null);
  const [splitVoucherError, setSplitVoucherError] = useState<string | null>(null);
  const [splitVoucherLookupPending, setSplitVoucherLookupPending] = useState(false);
  const [splitMode, setSplitMode] = useState<"cash+card" | "voucher+card" | "voucher+cash">("cash+card");
  const [isPending, setIsPending] = useState(false);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Voucher state
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherData, setVoucherData] = useState<{ id: string; code: string; balance: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherLookupPending, setVoucherLookupPending] = useState(false);

  // Layby state
  const [laybyDeposit, setLaybyDeposit] = useState("");

  // Camera scanner state
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Barcode scanner state
  const barcodeBuffer = useRef("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Barcode scanner detection
  const handleBarcodeInput = useCallback((barcode: string) => {
    // Find item by SKU or barcode
    const item = inventoryItems.find(
      (i) => i.sku === barcode || i.sku?.toLowerCase() === barcode.toLowerCase()
    );
    if (item) addToCart(item);
  }, [inventoryItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input, skip (unless it's the search bar)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && target.id !== "barcode-input") return;
      if (target.tagName === "TEXTAREA") return;

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length >= 6) {
          handleBarcodeInput(barcodeBuffer.current);
        }
        barcodeBuffer.current = "";
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        if (barcodeTimer.current) clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => {
          barcodeBuffer.current = "";
        }, 300);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleBarcodeInput]);

  // Filtered items
  const filteredItems = inventoryItems.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      categoryFilter === "All" || item.jewellery_type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered customers for dropdown
  const filteredCustomers = customers.filter((c) =>
    !customerSearch ||
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  function addToCart(item: InventoryItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.inventoryId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.inventoryId === item.id
            ? { ...c, quantity: Math.min(c.quantity + 1, item.quantity) }
            : c
        );
      }
      return [
        ...prev,
        {
          inventoryId: item.id,
          name: item.name,
          sku: item.sku,
          unitPrice: item.retail_price,
          quantity: 1,
          itemType: item.item_type,
        },
      ];
    });
  }

  function updateQty(inventoryId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.inventoryId === inventoryId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(inventoryId: string) {
    setCart((prev) => prev.filter((c) => c.inventoryId !== inventoryId));
  }

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const discountAmount =
    discountType === "$"
      ? Math.min(parseFloat(discountValue) || 0, subtotal)
      : (subtotal * (parseFloat(discountValue) || 0)) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
  const total = taxableAmount + taxAmount;
  const change = paymentTab === "cash" ? (parseFloat(cashTendered) || 0) - total : 0;

  async function handleCharge(paymentMethod: string, voucherId?: string, voucherAmount?: number) {
    setIsPending(true);
    setError(null);
    try {
      const result = await createPOSSale({
        tenantId,
        userId,
        cart,
        customerId: selectedCustomer?.id ?? null,
        customerName: selectedCustomer?.full_name ?? null,
        customerEmail: selectedCustomer?.email ?? null,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        paymentMethod,
        storeCreditAmount: paymentMethod === "store_credit" ? total : 0,
        voucherId: voucherId ?? null,
        voucherAmount: voucherAmount ?? 0,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.id) {
        setSaleResult({ id: result.id, saleNumber: result.saleNumber!, invoiceId: result.invoiceId, customerEmail: selectedCustomer?.email, cartSnapshot: [...cart] });
        setShowPaymentModal(false);
        setCart([]);
        setDiscountValue("");
        setSelectedCustomer(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsPending(false);
    }
  }

  function handleSplitCharge() {
    if (splitMode === "cash+card") {
      const cardAmt = parseFloat(splitCard) || 0;
      const cashAmt = parseFloat(splitCash) || 0;
      if (Math.abs(cardAmt + cashAmt - total) > 0.01) {
        setError("Card + cash amounts must equal the total");
        return;
      }
      handleCharge("split");
    } else if (splitMode === "voucher+card" || splitMode === "voucher+cash") {
      if (!splitVoucherData) {
        setSplitVoucherError("Please look up and apply a voucher first");
        return;
      }
      const voucherAmt = Math.min(splitVoucherData.balance, total);
      const remaining = total - voucherAmt;
      if (remaining > 0.01) {
        const secondAmt = splitMode === "voucher+card" ? parseFloat(splitCard) || 0 : parseFloat(splitCash) || 0;
        if (Math.abs(secondAmt - remaining) > 0.01) {
          const method = splitMode === "voucher+card" ? "Card" : "Cash";
          setError(`${method} amount (${secondAmt.toFixed(2)}) must equal remaining (${remaining.toFixed(2)})`);
          return;
        }
      }
      handleCharge(splitMode, splitVoucherData.id, voucherAmt);
    }
  }

  async function handleSplitVoucherLookup() {
    if (!splitVoucherCode.trim()) return;
    setSplitVoucherError(null);
    setSplitVoucherLookupPending(true);
    try {
      const result = await lookupVoucher(splitVoucherCode.trim());
      if (result.error) {
        setSplitVoucherError(result.error);
        setSplitVoucherData(null);
      } else if (result.data) {
        setSplitVoucherData(result.data);
        setSplitVoucherError(null);
        // Auto-fill the remaining amount in the second field
        const voucherAmt = Math.min(result.data.balance, total);
        const remaining = total - voucherAmt;
        if (splitMode === "voucher+card") setSplitCard(remaining.toFixed(2));
        else setSplitCash(remaining.toFixed(2));
      }
    } finally {
      setSplitVoucherLookupPending(false);
    }
  }

  async function handleVoucherLookup() {
    if (!voucherCode.trim()) return;
    setVoucherError(null);
    setVoucherLookupPending(true);
    try {
      const result = await lookupVoucher(voucherCode.trim());
      if (result.error) {
        setVoucherError(result.error);
        setVoucherData(null);
      } else if (result.data) {
        setVoucherData(result.data);
        setVoucherError(null);
      }
    } finally {
      setVoucherLookupPending(false);
    }
  }

  async function handleVoucherCharge() {
    if (!voucherData) return;
    if (voucherData.balance < total) {
      setError(`Voucher balance (${voucherData.balance.toFixed(2)}) is less than total. Use split payment.`);
      return;
    }
    handleCharge("voucher", voucherData.id, total);
  }

  function resetSale() {
    setSaleResult(null);
    setError(null);
    setCashTendered("");
    setSplitCard("");
    setSplitCash("");
  }

  // Print receipt
  async function printReceipt() {
    if (!saleResult) return;
    
    if (saleResult.invoiceId) {
      const url = `/api/invoice/${saleResult.invoiceId}/pdf?format=thermal`;
      const w = window.open(url, "_blank");
      if (w) w.focus();
    } else {
      legacyPrint();
    }
  }

  function legacyPrint() {
    const items = saleResult?.cartSnapshot ?? cart;
    const receiptHTML = `
      <html><head><title>Receipt</title>
      <style>body{font-family:monospace;max-width:300px;margin:0 auto;padding:20px;font-size:12px}
      h2{text-align:center}hr{border:1px dashed #ccc}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .total{font-weight:bold;font-size:14px;border-top:2px solid #000;margin-top:8px;padding-top:8px}
      </style></head><body>
      <h2>NEXPURA</h2>
      <p style="text-align:center">${new Date().toLocaleString("en-AU")}</p>
      ${saleResult?.customerEmail ? `<p>Customer: ${saleResult.customerEmail}</p>` : ""}
      <hr/>
      ${items.map((c) => `<div class="row"><span>${c.name} x${c.quantity}</span><span>$${(c.unitPrice * c.quantity).toFixed(2)}</span></div>`).join("")}
      <hr/>
      <div class="row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
      ${discountAmount > 0 ? `<div class="row"><span>Discount</span><span>-$${discountAmount.toFixed(2)}</span></div>` : ""}
      <div class="row"><span>Tax (${(taxRate * 100).toFixed(0)}%)</span><span>$${taxAmount.toFixed(2)}</span></div>
      <div class="row total"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
      <p style="text-align:center;margin-top:20px">Thank you!</p>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(receiptHTML);
      w.document.close();
      w.print();
    }
  }

  // Email receipt on sale complete screen
  const [emailReceiptSending, setEmailReceiptSending] = useState(false);
  const [emailReceiptToast, setEmailReceiptToast] = useState<string | null>(null);

  async function handleEmailReceiptAfterSale() {
    if (!saleResult?.invoiceId) return;
    setEmailReceiptSending(true);
    setEmailReceiptToast(null);
    try {
      const res = await fetch(`/api/invoice/${saleResult.invoiceId}/email`, { method: "POST" });
      const data = await res.json();
      if (data.success || data.ok) {
        setEmailReceiptToast(`✓ Receipt emailed to ${saleResult.customerEmail}`);
      } else {
        setEmailReceiptToast("✗ Failed to send email");
      }
    } catch {
      setEmailReceiptToast("✗ Failed to send email");
    } finally {
      setEmailReceiptSending(false);
      setTimeout(() => setEmailReceiptToast(null), 4000);
    }
  }

  if (saleResult) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-sm">
          {/* Success header */}
          <div className="bg-green-50 border-b border-green-100 rounded-t-2xl px-8 py-7 text-center">
            <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {saleResult.paymentMethod === "layby" ? (
              <>
                <h2 className="text-xl font-bold text-blue-800">Layby Created ✅</h2>
                <p className="text-sm font-mono text-blue-700 mt-1 font-semibold">{saleResult.saleNumber}</p>
                <p className="text-sm text-stone-600 mt-2">
                  Deposit taken: <span className="font-bold text-stone-900">${(saleResult.depositAmount ?? 0).toFixed(2)}</span>
                </p>
                <p className="text-sm text-stone-600">
                  Balance remaining: <span className="font-bold text-stone-900">${((saleResult.totalAmount ?? 0) - (saleResult.depositAmount ?? 0)).toFixed(2)}</span>
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-green-800">Sale Complete ✅</h2>
                <p className="text-sm font-mono text-green-700 mt-1 font-semibold">{saleResult.saleNumber}</p>
                <p className="text-3xl font-bold text-stone-900 mt-2">${total.toFixed(2)}</p>
                {paymentTab === "cash" && change > 0 && (
                  <p className="text-sm text-green-700 mt-1">Change: <span className="font-bold">${change.toFixed(2)}</span></p>
                )}
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-5 flex flex-col gap-2.5">
            {emailReceiptToast && (
              <p className={`text-xs text-center font-medium py-1 ${emailReceiptToast.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                {emailReceiptToast}
              </p>
            )}

            {/* Primary action: New Sale */}
            <button
              onClick={resetSale}
              className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 transition-colors"
            >
              + New Sale
            </button>

            {/* Print Receipt */}
            <button
              onClick={printReceipt}
              className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
            >
              🖨️ Print Receipt
            </button>

            {/* Email Receipt */}
            {saleResult.invoiceId && saleResult.customerEmail && (
              <button
                onClick={handleEmailReceiptAfterSale}
                disabled={emailReceiptSending}
                className="w-full py-3 bg-stone-100 text-stone-900 rounded-xl font-medium hover:bg-stone-200 transition-colors disabled:opacity-50 text-sm"
              >
                {emailReceiptSending ? "Sending…" : `📧 Email to ${saleResult.customerEmail}`}
              </button>
            )}

            {/* View Invoice */}
            {saleResult.invoiceId && (
              <button
                onClick={() => router.push(`/invoices/${saleResult.invoiceId}`)}
                className="w-full py-3 bg-stone-100 text-stone-900 rounded-xl font-medium hover:bg-stone-200 transition-colors text-sm"
              >
                📄 View Invoice
              </button>
            )}

            {/* Issue Passport (finished pieces) */}
            {(saleResult.cartSnapshot ?? []).some((c) => c.itemType === "finished_piece") && (
              <button
                onClick={() => {
                  const finishedItem = (saleResult.cartSnapshot ?? []).find((c) => c.itemType === "finished_piece");
                  if (finishedItem) router.push(`/passports/new?inventory_item_id=${finishedItem.inventoryId}`);
                }}
                className="w-full py-3 bg-[#8B7355]/10 text-[#8B7355] rounded-xl font-medium hover:bg-[#8B7355]/20 transition-colors text-sm"
              >
                🛡️ Issue Passport
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 -m-8 mt-0">
      {/* LEFT PANEL */}
      <div className="flex-1 flex flex-col bg-stone-50 min-w-0">
        {/* Camera Scanner Modal */}
        {showCameraScanner && (
          <CameraScannerModal
            title="Scan Product"
            onScan={(barcode) => {
              handleBarcodeInput(barcode);
              setShowCameraScanner(false);
            }}
            onClose={() => setShowCameraScanner(false)}
          />
        )}

        {/* Search */}
        <div className="p-4 bg-white border-b border-stone-200 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search inventory by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
            />
            <button
              onClick={() => setShowCameraScanner(true)}
              className="px-3 py-2 border border-stone-200 rounded-xl text-stone-500 hover:border-[#8B7355] hover:text-[#8B7355] transition-colors text-lg"
              title="Scan barcode with camera"
            >
              📷
            </button>
          </div>
          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? "bg-[#8B7355] text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">No items found</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white border border-stone-200 rounded-xl p-3 text-left hover:border-[#8B7355] hover:shadow-sm transition-all group"
                >
                  <div className="aspect-square w-full mb-2 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
                    {item.primary_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.primary_image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">💎</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-stone-900 truncate">{item.name}</p>
                  {item.sku && <p className="text-[10px] text-stone-400 font-mono">{item.sku}</p>}
                  <p className="text-sm font-bold text-[#8B7355] mt-1">${item.retail_price.toFixed(2)}</p>
                  <p className="text-[10px] text-stone-400">Qty: {item.quantity}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-80 xl:w-96 bg-white border-l border-stone-200 flex flex-col">
        {/* Cart header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">
            Cart
            {cart.length > 0 && (
              <span className="ml-2 bg-[#8B7355] text-white text-xs rounded-full px-2 py-0.5">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </h2>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-stone-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-stone-400">
              Click items to add to cart
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {cart.map((item) => (
                <div key={item.inventoryId} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-stone-900 truncate flex-1 mr-2">{item.name}</span>
                    <button
                      onClick={() => removeFromCart(item.inventoryId)}
                      className="text-stone-300 hover:text-red-400 text-xs ml-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.inventoryId, -1)}
                        className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-sm hover:bg-stone-200"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium text-stone-900 w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.inventoryId, 1)}
                        className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-sm hover:bg-stone-200"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-stone-900">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart footer */}
        <div className="border-t border-stone-200 p-4 space-y-3">
          {/* Customer selector */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search customer (optional)…"
              value={selectedCustomer ? selectedCustomer.full_name : customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setSelectedCustomer(null);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#8B7355]"
            />
            {showCustomerDropdown && filteredCustomers.length > 0 && !selectedCustomer && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-32 overflow-y-auto z-10">
                {filteredCustomers.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch("");
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 flex items-center justify-between"
                  >
                    <span className="font-medium">{c.full_name}</span>
                    <span className="text-stone-400">{c.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Discount */}
          <div className="flex gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "$" | "%")}
              className="border border-stone-200 rounded-lg px-2 py-2 text-xs"
            >
              <option value="$">$ off</option>
              <option value="%">% off</option>
            </select>
            <input
              type="number"
              min="0"
              placeholder="Discount"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#8B7355]"
            />
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-stone-500">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>−${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-500">
              <span>Tax ({(taxRate * 100).toFixed(0)}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-stone-900 text-base border-t border-stone-200 pt-2 mt-1">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={() => { setError(null); setShowPaymentModal(true); }}
            disabled={cart.length === 0}
            className="w-full py-3 bg-[#8B7355] text-white rounded-xl font-semibold text-sm hover:bg-[#7a6447] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={cart.length === 0 ? "Add items to cart first" : undefined}
          >
            {cart.length === 0 ? "Add items to charge" : `Charge $${total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900 text-lg">Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-stone-400 hover:text-stone-900">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-200 overflow-x-auto">
              {(["card", "cash", "store_credit", "split", "voucher", "layby"] as PaymentTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPaymentTab(tab)}
                  className={`flex-1 min-w-[80px] py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    paymentTab === tab
                      ? "border-b-2 border-[#8B7355] text-[#8B7355]"
                      : "text-stone-400 hover:text-stone-900"
                  }`}
                >
                  {tab.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Amount due</p>
                <p className="text-4xl font-bold text-stone-900">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>

              {paymentTab === "store_credit" && (
                <div className="space-y-4">
                  {!selectedCustomer ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <p className="text-sm text-amber-700 font-medium">Please select a customer to use store credit.</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Available Balance</p>
                          <p className="text-xl font-bold text-stone-900">${(selectedCustomer.store_credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                        { (selectedCustomer.store_credit || 0) >= total ? (
                          <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">✓</div>
                        ) : (
                          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xs font-bold">!</div>
                        )}
                      </div>

                      {(selectedCustomer.store_credit || 0) < total && (
                        <p className="text-xs text-amber-600 text-center">Insufficient balance. Use split payment instead.</p>
                      )}

                      <button
                        onClick={() => handleCharge("store_credit")}
                        disabled={isPending || (selectedCustomer.store_credit || 0) < total}
                        className="w-full py-4 bg-[#8B7355] text-white rounded-xl font-bold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {isPending ? "Processing…" : "Pay with Store Credit"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {paymentTab === "card" && (
                <button
                  onClick={() => handleCharge("card")}
                  disabled={isPending}
                  className="w-full py-4 bg-[#8B7355] text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                >
                  {isPending ? "Processing…" : "Record Card Payment"}
                </button>
              )}

              {paymentTab === "cash" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1.5">Amount tendered</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                    />
                  </div>
                  {parseFloat(cashTendered) >= total && (
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <p className="text-sm text-green-600">Change</p>
                      <p className="text-2xl font-bold text-green-700">${change.toFixed(2)}</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleCharge("cash")}
                    disabled={isPending || (parseFloat(cashTendered) || 0) < total}
                    className="w-full py-4 bg-[#8B7355] text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Processing…" : "Complete Cash Sale"}
                  </button>
                </div>
              )}

              {paymentTab === "split" && (
                <div className="space-y-3">
                  {/* Split mode selector */}
                  <div className="flex gap-2 bg-stone-100 rounded-xl p-1">
                    {(["cash+card", "voucher+card", "voucher+cash"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setSplitMode(mode);
                          setSplitCard("");
                          setSplitCash("");
                          setSplitVoucherData(null);
                          setSplitVoucherCode("");
                          setSplitVoucherError(null);
                        }}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                          splitMode === mode
                            ? "bg-white text-stone-900 shadow-sm"
                            : "text-stone-500 hover:text-stone-700"
                        }`}
                      >
                        {mode === "cash+card" ? "Cash + Card" : mode === "voucher+card" ? "Voucher + Card" : "Voucher + Cash"}
                      </button>
                    ))}
                  </div>

                  {splitMode === "cash+card" && (
                    <>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Card amount</label>
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={splitCard}
                          onChange={(e) => setSplitCard(e.target.value)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Cash amount</label>
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={splitCash}
                          onChange={(e) => setSplitCash(e.target.value)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                        />
                      </div>
                      {(parseFloat(splitCard) || 0) + (parseFloat(splitCash) || 0) !== total && (
                        <p className="text-xs text-amber-600">
                          Must equal ${total.toFixed(2)} (currently ${((parseFloat(splitCard) || 0) + (parseFloat(splitCash) || 0)).toFixed(2)})
                        </p>
                      )}
                    </>
                  )}

                  {(splitMode === "voucher+card" || splitMode === "voucher+cash") && (
                    <>
                      {/* Voucher lookup */}
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">Voucher code</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter voucher code…"
                            value={splitVoucherCode}
                            onChange={(e) => { setSplitVoucherCode(e.target.value.toUpperCase()); setSplitVoucherData(null); setSplitVoucherError(null); }}
                            className="flex-1 border border-stone-200 rounded-xl px-4 py-3 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                          />
                          <button
                            onClick={handleSplitVoucherLookup}
                            disabled={splitVoucherLookupPending || !splitVoucherCode.trim()}
                            className="px-4 py-3 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors disabled:opacity-50"
                          >
                            {splitVoucherLookupPending ? "…" : "Look up"}
                          </button>
                        </div>
                        {splitVoucherError && <p className="text-xs text-red-600 mt-1">{splitVoucherError}</p>}
                        {splitVoucherData && (
                          <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between">
                            <span className="text-sm font-mono text-green-800">{splitVoucherData.code}</span>
                            <span className="text-sm font-bold text-green-700">
                              Voucher: −${Math.min(splitVoucherData.balance, total).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {splitVoucherData && (
                        <>
                          <div className="flex justify-between text-sm px-1">
                            <span className="text-stone-500">Remaining to pay</span>
                            <span className="font-bold text-stone-900">
                              ${Math.max(0, total - Math.min(splitVoucherData.balance, total)).toFixed(2)}
                            </span>
                          </div>
                          {Math.max(0, total - Math.min(splitVoucherData.balance, total)) > 0.01 && (
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">
                                {splitMode === "voucher+card" ? "Card amount" : "Cash amount"}
                              </label>
                              <input
                                type="number" min="0" step="0.01" placeholder="0.00"
                                value={splitMode === "voucher+card" ? splitCard : splitCash}
                                onChange={(e) => splitMode === "voucher+card" ? setSplitCard(e.target.value) : setSplitCash(e.target.value)}
                                className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  <button
                    onClick={handleSplitCharge}
                    disabled={isPending}
                    className="w-full py-4 bg-[#8B7355] text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Processing…" : "Complete Split Payment"}
                  </button>
                </div>
              )}

              {paymentTab === "voucher" && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter voucher code…"
                      value={voucherCode}
                      onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherData(null); setVoucherError(null); }}
                      className="flex-1 border border-stone-200 rounded-xl px-4 py-3 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                    />
                    <button
                      onClick={handleVoucherLookup}
                      disabled={voucherLookupPending || !voucherCode.trim()}
                      className="px-4 py-3 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors disabled:opacity-50"
                    >
                      {voucherLookupPending ? "…" : "Look up"}
                    </button>
                  </div>
                  {voucherError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{voucherError}</p>}
                  {voucherData && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono font-semibold text-green-800">{voucherData.code}</span>
                        <span className="text-sm font-bold text-green-700">Balance: ${voucherData.balance.toFixed(2)}</span>
                      </div>
                      {voucherData.balance >= total ? (
                        <p className="text-xs text-green-600">✓ Sufficient balance to cover ${total.toFixed(2)}</p>
                      ) : (
                        <p className="text-xs text-amber-600">⚠ Voucher balance is less than total. Use split payment to cover the difference.</p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleVoucherCharge}
                    disabled={isPending || !voucherData || voucherData.balance < total}
                    className="w-full py-4 bg-[#8B7355] text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Processing…" : "Redeem Voucher"}
                  </button>
                </div>
              )}

              {paymentTab === "layby" && (
                <div className="space-y-4">
                  {!selectedCustomer ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <p className="text-sm text-amber-700 font-medium">Please select a customer above to create a layby.</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Customer</p>
                        <p className="text-sm font-semibold text-stone-800">{selectedCustomer.full_name}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1.5">Deposit amount</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          max={total - 0.01}
                          placeholder="0.00"
                          value={laybyDeposit}
                          onChange={(e) => setLaybyDeposit(e.target.value)}
                          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
                        />
                      </div>
                      {parseFloat(laybyDeposit) > 0 && parseFloat(laybyDeposit) < total && (
                        <div className="bg-stone-50 rounded-xl p-4 flex justify-between text-sm">
                          <span className="text-stone-500">Remaining balance</span>
                          <span className="font-bold text-stone-900">${(total - parseFloat(laybyDeposit)).toFixed(2)}</span>
                        </div>
                      )}
                      <p className="text-xs text-stone-400">
                        The customer pays a deposit now and collects their item once the full balance is paid. Inventory is reserved but not yet deducted.
                      </p>
                      <button
                        onClick={async () => {
                          const deposit = parseFloat(laybyDeposit);
                          if (!deposit || deposit <= 0) {
                            setError("Enter a deposit amount");
                            return;
                          }
                          if (deposit >= total) {
                            setError("Deposit must be less than the total — use a regular sale instead");
                            return;
                          }
                          setIsPending(true);
                          setError(null);
                          const result = await createLaybySale({
                            tenantId,
                            userId,
                            cart,
                            customerId: selectedCustomer.id,
                            customerName: selectedCustomer.full_name,
                            customerEmail: selectedCustomer.email,
                            subtotal: subtotal,
                            discountAmount: discountAmount,
                            taxAmount: taxAmount,
                            total,
                            depositAmount: deposit,
                          });
                          setIsPending(false);
                          if (result.error) {
                            setError(result.error);
                          } else {
                            setSaleResult({
                              id: result.id!,
                              saleNumber: result.saleNumber!,
                              customerEmail: selectedCustomer.email,
                              cartSnapshot: [...cart],
                              paymentMethod: "layby",
                              depositAmount: deposit,
                              totalAmount: total,
                            });
                            setShowPaymentModal(false);
                            setCart([]);
                            setSelectedCustomer(null);
                            setLaybyDeposit("");
                          }
                        }}
                        disabled={isPending || !laybyDeposit || parseFloat(laybyDeposit) <= 0}
                        className="w-full py-4 bg-[#8B7355] text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
                      >
                        {isPending ? "Processing…" : "Create Layby"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
