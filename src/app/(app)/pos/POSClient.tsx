"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createPOSSale, createLaybySale } from "./actions";
import { lookupVoucher } from "../vouchers/actions";
import {
  SaleSuccessScreen,
  ProductGrid,
  CartPanel,
} from "./components";
import type {
  InventoryItem,
  Customer,
  CartItem,
  PaymentTab,
  SaleResult,
  VoucherData,
  POSClientProps,
} from "./components/types";

// Lazy-load modal components that aren't needed on initial render
const CameraScannerModal = dynamic(() => import("@/components/CameraScannerModal"), { ssr: false });
const RefundModal = dynamic(() => import("./components/RefundModal"), { ssr: false });
const PaymentModal = dynamic(() => import("./components/PaymentModal"), { ssr: false });

export default function POSClient({
  tenantId,
  userId,
  inventoryItems,
  customers,
  taxRate,
  businessName,
  hasStripe = false,
}: POSClientProps) {
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
  const [splitVoucherCode, setSplitVoucherCode] = useState("");
  const [splitVoucherData, setSplitVoucherData] = useState<VoucherData | null>(null);
  const [splitVoucherError, setSplitVoucherError] = useState<string | null>(null);
  const [splitVoucherLookupPending, setSplitVoucherLookupPending] = useState(false);
  const [splitMode, setSplitMode] = useState<"cash+card" | "voucher+card" | "voucher+cash">("cash+card");
  const [isPending, setIsPending] = useState(false);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherLookupPending, setVoucherLookupPending] = useState(false);

  const [laybyDeposit, setLaybyDeposit] = useState("");
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const barcodeBuffer = useRef("");
  const barcodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBarcodeInput = useCallback(
    (barcode: string) => {
      const item = inventoryItems.find(
        (i) => i.sku === barcode || i.sku?.toLowerCase() === barcode.toLowerCase()
      );
      if (item) addToCart(item);
    },
    [inventoryItems]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        .map((c) => (c.inventoryId === inventoryId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  function removeFromCart(inventoryId: string) {
    setCart((prev) => prev.filter((c) => c.inventoryId !== inventoryId));
  }

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
        setSaleResult({
          id: result.id,
          saleNumber: result.saleNumber!,
          invoiceId: result.invoiceId,
          customerEmail: selectedCustomer?.email,
          cartSnapshot: [...cart],
        });
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

  async function handleLaybyCreate() {
    const deposit = parseFloat(laybyDeposit);
    if (!deposit || deposit <= 0) {
      setError("Enter a deposit amount");
      return;
    }
    if (deposit >= total) {
      setError("Deposit must be less than the total — use a regular sale instead");
      return;
    }
    if (!selectedCustomer) return;

    setIsPending(true);
    setError(null);
    const result = await createLaybySale({
      tenantId,
      userId,
      cart,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.full_name,
      customerEmail: selectedCustomer.email,
      subtotal,
      discountAmount,
      taxAmount,
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
  }

  function resetSale() {
    setSaleResult(null);
    setError(null);
    setCashTendered("");
    setSplitCard("");
    setSplitCash("");
  }

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
      <h2>${businessName}</h2>
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
      <SaleSuccessScreen
        saleResult={saleResult}
        total={total}
        change={change}
        paymentTab={paymentTab}
        emailReceiptSending={emailReceiptSending}
        emailReceiptToast={emailReceiptToast}
        onNewSale={resetSale}
        onPrintReceipt={printReceipt}
        onEmailReceipt={handleEmailReceiptAfterSale}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-0 -m-4 md:-m-6 lg:-m-8 mt-0">
      {/* Refund Modal */}
      {showRefundModal && (
        <RefundModal
          tenantId={tenantId}
          onClose={() => setShowRefundModal(false)}
        />
      )}

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

      {/* Left Panel - Product Grid */}
      <ProductGrid
        items={inventoryItems}
        search={search}
        setSearch={setSearch}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        onAddToCart={addToCart}
        onOpenCameraScanner={() => setShowCameraScanner(true)}
        onOpenRefund={() => setShowRefundModal(true)}
      />

      {/* Right Panel - Cart */}
      <CartPanel
        cart={cart}
        selectedCustomer={selectedCustomer}
        customers={customers}
        customerSearch={customerSearch}
        setCustomerSearch={setCustomerSearch}
        setSelectedCustomer={setSelectedCustomer}
        showCustomerDropdown={showCustomerDropdown}
        setShowCustomerDropdown={setShowCustomerDropdown}
        discountType={discountType}
        setDiscountType={setDiscountType}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        subtotal={subtotal}
        discountAmount={discountAmount}
        taxRate={taxRate}
        taxAmount={taxAmount}
        total={total}
        error={error}
        onClearCart={() => setCart([])}
        onRemoveFromCart={removeFromCart}
        onUpdateQty={updateQty}
        onCharge={() => {
          setError(null);
          setShowPaymentModal(true);
        }}
      />

      {/* Payment Modal */}
      <PaymentModal
        show={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={total}
        paymentTab={paymentTab}
        setPaymentTab={setPaymentTab}
        selectedCustomer={selectedCustomer}
        hasStripe={hasStripe}
        isPending={isPending}
        error={error}
        cashTendered={cashTendered}
        setCashTendered={setCashTendered}
        change={change}
        splitMode={splitMode}
        setSplitMode={setSplitMode}
        splitCard={splitCard}
        setSplitCard={setSplitCard}
        splitCash={splitCash}
        setSplitCash={setSplitCash}
        splitVoucherCode={splitVoucherCode}
        setSplitVoucherCode={setSplitVoucherCode}
        splitVoucherData={splitVoucherData}
        setSplitVoucherData={setSplitVoucherData}
        splitVoucherError={splitVoucherError}
        setSplitVoucherError={setSplitVoucherError}
        splitVoucherLookupPending={splitVoucherLookupPending}
        onSplitVoucherLookup={handleSplitVoucherLookup}
        voucherCode={voucherCode}
        setVoucherCode={setVoucherCode}
        voucherData={voucherData}
        setVoucherData={setVoucherData}
        voucherError={voucherError}
        setVoucherError={setVoucherError}
        voucherLookupPending={voucherLookupPending}
        onVoucherLookup={handleVoucherLookup}
        laybyDeposit={laybyDeposit}
        setLaybyDeposit={setLaybyDeposit}
        onCharge={handleCharge}
        onSplitCharge={handleSplitCharge}
        onVoucherCharge={handleVoucherCharge}
        onLaybyCreate={handleLaybyCreate}
      />
    </div>
  );
}
