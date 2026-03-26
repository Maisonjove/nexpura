"use client";

import { HelpTooltip } from "@/components/ui/HelpTooltip";
import type { Customer, PaymentTab, VoucherData } from "./types";

interface PaymentModalProps {
  show: boolean;
  onClose: () => void;
  total: number;
  paymentTab: PaymentTab;
  setPaymentTab: (tab: PaymentTab) => void;
  selectedCustomer: Customer | null;
  hasStripe: boolean;
  isPending: boolean;
  error: string | null;
  // Cash
  cashTendered: string;
  setCashTendered: (value: string) => void;
  change: number;
  // Split
  splitMode: "cash+card" | "voucher+card" | "voucher+cash";
  setSplitMode: (mode: "cash+card" | "voucher+card" | "voucher+cash") => void;
  splitCard: string;
  setSplitCard: (value: string) => void;
  splitCash: string;
  setSplitCash: (value: string) => void;
  splitVoucherCode: string;
  setSplitVoucherCode: (value: string) => void;
  splitVoucherData: VoucherData | null;
  setSplitVoucherData: (data: VoucherData | null) => void;
  splitVoucherError: string | null;
  setSplitVoucherError: (error: string | null) => void;
  splitVoucherLookupPending: boolean;
  onSplitVoucherLookup: () => void;
  // Voucher
  voucherCode: string;
  setVoucherCode: (value: string) => void;
  voucherData: VoucherData | null;
  setVoucherData: (data: VoucherData | null) => void;
  voucherError: string | null;
  setVoucherError: (error: string | null) => void;
  voucherLookupPending: boolean;
  onVoucherLookup: () => void;
  // Layby
  laybyDeposit: string;
  setLaybyDeposit: (value: string) => void;
  // Actions
  onCharge: (method: string, voucherId?: string, voucherAmount?: number) => void;
  onSplitCharge: () => void;
  onVoucherCharge: () => void;
  onLaybyCreate: () => void;
}

export default function PaymentModal({
  show,
  onClose,
  total,
  paymentTab,
  setPaymentTab,
  selectedCustomer,
  hasStripe,
  isPending,
  error,
  cashTendered,
  setCashTendered,
  change,
  splitMode,
  setSplitMode,
  splitCard,
  setSplitCard,
  splitCash,
  setSplitCash,
  splitVoucherCode,
  setSplitVoucherCode,
  splitVoucherData,
  setSplitVoucherData,
  splitVoucherError,
  setSplitVoucherError,
  splitVoucherLookupPending,
  onSplitVoucherLookup,
  voucherCode,
  setVoucherCode,
  voucherData,
  setVoucherData,
  voucherError,
  setVoucherError,
  voucherLookupPending,
  onVoucherLookup,
  laybyDeposit,
  setLaybyDeposit,
  onCharge,
  onSplitCharge,
  onVoucherCharge,
  onLaybyCreate,
}: PaymentModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto max-h-[95vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900 text-lg">Payment</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 overflow-x-auto">
          {(["card", "cash", "store_credit", "split", "voucher", "layby"] as PaymentTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setPaymentTab(tab)}
              className={`flex-1 min-w-[80px] py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                paymentTab === tab
                  ? "border-b-2 border-amber-600 text-amber-700"
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

          {/* Store Credit Tab */}
          {paymentTab === "store_credit" && (
            <StoreCreditTab
              selectedCustomer={selectedCustomer}
              total={total}
              isPending={isPending}
              onCharge={() => onCharge("store_credit")}
            />
          )}

          {/* Card Tab */}
          {paymentTab === "card" && (
            <CardTab
              hasStripe={hasStripe}
              isPending={isPending}
              onCharge={() => onCharge("card")}
            />
          )}

          {/* Cash Tab */}
          {paymentTab === "cash" && (
            <CashTab
              total={total}
              cashTendered={cashTendered}
              setCashTendered={setCashTendered}
              change={change}
              isPending={isPending}
              onCharge={() => onCharge("cash")}
            />
          )}

          {/* Split Tab */}
          {paymentTab === "split" && (
            <SplitTab
              total={total}
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
              onSplitVoucherLookup={onSplitVoucherLookup}
              isPending={isPending}
              onSplitCharge={onSplitCharge}
            />
          )}

          {/* Voucher Tab */}
          {paymentTab === "voucher" && (
            <VoucherTab
              total={total}
              voucherCode={voucherCode}
              setVoucherCode={setVoucherCode}
              voucherData={voucherData}
              setVoucherData={setVoucherData}
              voucherError={voucherError}
              setVoucherError={setVoucherError}
              voucherLookupPending={voucherLookupPending}
              onVoucherLookup={onVoucherLookup}
              isPending={isPending}
              onVoucherCharge={onVoucherCharge}
            />
          )}

          {/* Layby Tab */}
          {paymentTab === "layby" && (
            <LaybyTab
              selectedCustomer={selectedCustomer}
              total={total}
              laybyDeposit={laybyDeposit}
              setLaybyDeposit={setLaybyDeposit}
              isPending={isPending}
              onLaybyCreate={onLaybyCreate}
            />
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components for each tab
function StoreCreditTab({ selectedCustomer, total, isPending, onCharge }: {
  selectedCustomer: Customer | null;
  total: number;
  isPending: boolean;
  onCharge: () => void;
}) {
  if (!selectedCustomer) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
        <p className="text-sm text-amber-700 font-medium">Please select a customer to use store credit.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Available Balance</p>
          <p className="text-xl font-bold text-stone-900">${(selectedCustomer.store_credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        {(selectedCustomer.store_credit || 0) >= total ? (
          <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">✓</div>
        ) : (
          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xs font-bold">!</div>
        )}
      </div>
      {(selectedCustomer.store_credit || 0) < total && (
        <p className="text-xs text-amber-600 text-center">Insufficient balance. Use split payment instead.</p>
      )}
      <button
        onClick={onCharge}
        disabled={isPending || (selectedCustomer.store_credit || 0) < total}
        className="w-full py-4 bg-amber-700 text-white rounded-xl font-bold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50 shadow-sm"
      >
        {isPending ? "Processing…" : "Pay with Store Credit"}
      </button>
    </>
  );
}

function CardTab({ hasStripe, isPending, onCharge }: {
  hasStripe: boolean;
  isPending: boolean;
  onCharge: () => void;
}) {
  if (hasStripe) {
    return (
      <button
        onClick={onCharge}
        disabled={isPending}
        className="w-full py-4 bg-amber-700 text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Record Card Payment"}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h4 className="font-semibold text-stone-900 mb-1">Connect Stripe to accept cards</h4>
        <p className="text-sm text-stone-600 mb-4">Accept credit cards, Apple Pay, and Google Pay in seconds.</p>
        <a href="/settings/payments" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors">
          Connect Stripe
        </a>
      </div>
      <button
        onClick={onCharge}
        disabled={isPending}
        className="w-full py-3 bg-stone-200 text-stone-700 rounded-xl font-medium text-sm hover:bg-stone-300 transition-colors disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Record as manual card payment"}
      </button>
    </div>
  );
}

function CashTab({ total, cashTendered, setCashTendered, change, isPending, onCharge }: {
  total: number;
  cashTendered: string;
  setCashTendered: (value: string) => void;
  change: number;
  isPending: boolean;
  onCharge: () => void;
}) {
  return (
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
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
      </div>
      {parseFloat(cashTendered) >= total && (
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-sm text-green-600">Change</p>
          <p className="text-2xl font-bold text-green-700">${change.toFixed(2)}</p>
        </div>
      )}
      <button
        onClick={onCharge}
        disabled={isPending || (parseFloat(cashTendered) || 0) < total}
        className="w-full py-4 bg-amber-700 text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Complete Cash Sale"}
      </button>
    </div>
  );
}

function SplitTab({
  total,
  splitMode,
  setSplitMode,
  splitCard,
  setSplitCard,
  splitCash,
  setSplitCash,
  splitVoucherCode,
  setSplitVoucherCode,
  splitVoucherData,
  setSplitVoucherData,
  splitVoucherError,
  setSplitVoucherError,
  splitVoucherLookupPending,
  onSplitVoucherLookup,
  isPending,
  onSplitCharge,
}: {
  total: number;
  splitMode: "cash+card" | "voucher+card" | "voucher+cash";
  setSplitMode: (mode: "cash+card" | "voucher+card" | "voucher+cash") => void;
  splitCard: string;
  setSplitCard: (value: string) => void;
  splitCash: string;
  setSplitCash: (value: string) => void;
  splitVoucherCode: string;
  setSplitVoucherCode: (value: string) => void;
  splitVoucherData: VoucherData | null;
  setSplitVoucherData: (data: VoucherData | null) => void;
  splitVoucherError: string | null;
  setSplitVoucherError: (error: string | null) => void;
  splitVoucherLookupPending: boolean;
  onSplitVoucherLookup: () => void;
  isPending: boolean;
  onSplitCharge: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs font-medium text-stone-500">Split the payment across multiple methods</span>
        <HelpTooltip content="Use split payment when a customer wants to pay using more than one payment method, e.g. part cash and part card, or use a voucher with remaining balance on card." />
      </div>
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
              splitMode === mode ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
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
              className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Cash amount</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={splitCash}
              onChange={(e) => setSplitCash(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-600"
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
          <div>
            <label className="block text-xs text-stone-500 mb-1">Voucher code</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter voucher code…"
                value={splitVoucherCode}
                onChange={(e) => { setSplitVoucherCode(e.target.value.toUpperCase()); setSplitVoucherData(null); setSplitVoucherError(null); }}
                className="flex-1 border border-stone-200 rounded-xl px-4 py-3 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <button
                onClick={onSplitVoucherLookup}
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
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <button
        onClick={onSplitCharge}
        disabled={isPending}
        className="w-full py-4 bg-amber-700 text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Complete Split Payment"}
      </button>
    </div>
  );
}

function VoucherTab({
  total,
  voucherCode,
  setVoucherCode,
  voucherData,
  setVoucherData,
  voucherError,
  setVoucherError,
  voucherLookupPending,
  onVoucherLookup,
  isPending,
  onVoucherCharge,
}: {
  total: number;
  voucherCode: string;
  setVoucherCode: (value: string) => void;
  voucherData: VoucherData | null;
  setVoucherData: (data: VoucherData | null) => void;
  voucherError: string | null;
  setVoucherError: (error: string | null) => void;
  voucherLookupPending: boolean;
  onVoucherLookup: () => void;
  isPending: boolean;
  onVoucherCharge: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter voucher code…"
          value={voucherCode}
          onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherData(null); setVoucherError(null); }}
          className="flex-1 border border-stone-200 rounded-xl px-4 py-3 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-600"
        />
        <button
          onClick={onVoucherLookup}
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
        onClick={onVoucherCharge}
        disabled={isPending || !voucherData || voucherData.balance < total}
        className="w-full py-4 bg-amber-700 text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Redeem Voucher"}
      </button>
    </div>
  );
}

function LaybyTab({
  selectedCustomer,
  total,
  laybyDeposit,
  setLaybyDeposit,
  isPending,
  onLaybyCreate,
}: {
  selectedCustomer: Customer | null;
  total: number;
  laybyDeposit: string;
  setLaybyDeposit: (value: string) => void;
  isPending: boolean;
  onLaybyCreate: () => void;
}) {
  if (!selectedCustomer) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
        <p className="text-sm text-amber-700 font-medium">Please select a customer above to create a layby.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs font-medium text-stone-500">Reserve item with a deposit</span>
        <HelpTooltip content="Layby lets your customer pay a deposit to reserve items. The item stays in your inventory until the full balance is paid, at which point the customer collects their purchase." />
      </div>
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
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-amber-600"
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
        onClick={onLaybyCreate}
        disabled={isPending || !laybyDeposit || parseFloat(laybyDeposit) <= 0}
        className="w-full py-4 bg-amber-700 text-white rounded-xl font-semibold text-base hover:bg-[#7a6447] transition-colors disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Create Layby"}
      </button>
    </>
  );
}
