"use client";

import type { CartItem, Customer } from "./types";

interface CartPanelProps {
  cart: CartItem[];
  selectedCustomer: Customer | null;
  customers: Customer[];
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  showCustomerDropdown: boolean;
  setShowCustomerDropdown: (show: boolean) => void;
  discountType: "$" | "%";
  setDiscountType: (type: "$" | "%") => void;
  discountValue: string;
  setDiscountValue: (value: string) => void;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  error: string | null;
  onClearCart: () => void;
  onRemoveFromCart: (inventoryId: string) => void;
  onUpdateQty: (inventoryId: string, delta: number) => void;
  onCharge: () => void;
}

export default function CartPanel({
  cart,
  selectedCustomer,
  customers,
  customerSearch,
  setCustomerSearch,
  setSelectedCustomer,
  showCustomerDropdown,
  setShowCustomerDropdown,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  subtotal,
  discountAmount,
  taxRate,
  taxAmount,
  total,
  error,
  onClearCart,
  onRemoveFromCart,
  onUpdateQty,
  onCharge,
}: CartPanelProps) {
  const filteredCustomers = customers.filter((c) =>
    !customerSearch ||
    c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  return (
    <div className="w-full lg:w-80 xl:w-96 bg-white border-t lg:border-t-0 lg:border-l border-stone-200 flex flex-col min-h-[40vh] lg:min-h-0 max-h-[60vh] lg:max-h-none">
      {/* Cart header */}
      <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
        <h2 className="font-semibold text-stone-900">
          Cart
          {cart.length > 0 && (
            <span className="ml-2 bg-nexpura-charcoal text-white text-xs rounded-full px-2 py-0.5">
              {cart.reduce((s, c) => s + c.quantity, 0)}
            </span>
          )}
        </h2>
        {cart.length > 0 && (
          <button
            onClick={onClearCart}
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
                    onClick={() => onRemoveFromCart(item.inventoryId)}
                    className="text-stone-300 hover:text-red-400 text-xs ml-1"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQty(item.inventoryId, -1)}
                      className="w-8 h-8 md:w-7 md:h-7 rounded-full bg-stone-100 flex items-center justify-center text-sm hover:bg-stone-200 touch-manipulation active:bg-stone-300"
                    >
                      −
                    </button>
                    <span className="text-sm font-medium text-stone-900 w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQty(item.inventoryId, 1)}
                      className="w-8 h-8 md:w-7 md:h-7 rounded-full bg-stone-100 flex items-center justify-center text-sm hover:bg-stone-200 touch-manipulation active:bg-stone-300"
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
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-nexpura-bronze"
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
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-nexpura-bronze"
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
          onClick={onCharge}
          disabled={cart.length === 0}
          className="w-full py-3 md:py-4 bg-nexpura-charcoal text-white rounded-xl font-semibold text-sm md:text-base hover:bg-[#7a6447] transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation active:scale-[0.98]"
          title={cart.length === 0 ? "Add items to cart first" : undefined}
        >
          {cart.length === 0 ? "Add items to charge" : `Charge $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
