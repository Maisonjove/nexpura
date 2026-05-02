"use client";

import { useState, useEffect } from "react";
import { Info, Mail, Phone, UserPlus, UserX } from "lucide-react";
import { searchCustomers, createCustomerInline } from "../actions";
import type { Customer } from "../types";
import { inputCls, labelCls, cardCls, ghostBtnCls } from "./styles";

interface CustomerSectionProps {
  initialCustomers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onError: (error: string) => void;
  isWalkIn: boolean;
  onWalkInToggle: (value: boolean) => void;
}

export default function CustomerSection({
  initialCustomers,
  selectedCustomer,
  onSelectCustomer,
  onError,
  isWalkIn,
  onWalkInToggle,
}: CustomerSectionProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Customer Search Effect
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

  const handleCreateCustomer = async () => {
    if (!newCustomer.first_name && !newCustomer.last_name) return;

    setIsCreatingCustomer(true);
    const result = await createCustomerInline(newCustomer);
    setIsCreatingCustomer(false);

    if (result.error) {
      onError(result.error);
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
      onSelectCustomer(customer);
      onWalkInToggle(false);
      setShowNewCustomerForm(false);
      setNewCustomer({ first_name: "", last_name: "", email: "", phone: "" });
    }
  };

  return (
    <section
      id="step-customer"
      className={`${cardCls} bg-nexpura-ivory-elevated border-nexpura-taupe-100 p-6 mb-6`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-nexpura-charcoal tracking-[0.04em] uppercase">
          Customer
        </h2>
        {selectedCustomer && (
          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
              setCustomerSearch("");
            }}
            className="text-sm text-nexpura-charcoal-700 hover:text-nexpura-charcoal font-medium underline-offset-2 hover:underline"
          >
            Change customer
          </button>
        )}
      </div>

      {selectedCustomer ? (
        // Selected Customer preview card — Section 12.4
        <div className="bg-white border border-nexpura-taupe-100 rounded-xl p-5">
          <div className="flex items-start gap-4">
            {/* Avatar Initial Circle */}
            <div className="w-12 h-12 bg-nexpura-charcoal rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-semibold text-lg">
                {selectedCustomer.full_name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-nexpura-charcoal text-base">
                  {selectedCustomer.full_name || "Unknown"}
                </p>
                {/* VIP tag placeholder — flag not yet on Customer record. */}
              </div>
              <div className="flex flex-col gap-0.5 mt-1.5 text-sm text-nexpura-charcoal-700">
                {(selectedCustomer.mobile || selectedCustomer.phone) && (
                  <p>{selectedCustomer.mobile || selectedCustomer.phone}</p>
                )}
                {selectedCustomer.email && <p>{selectedCustomer.email}</p>}
              </div>
              {/* Last visit / open jobs / outstanding — not in current
                  Customer query payload; left as placeholder row to match
                  the visual brief without a data-layer change. */}
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-nexpura-charcoal-500 uppercase tracking-[0.04em]">Last visit</div>
                  <div className="text-nexpura-charcoal-700 mt-0.5">—</div>
                </div>
                <div>
                  <div className="text-nexpura-charcoal-500 uppercase tracking-[0.04em]">Open jobs</div>
                  <div className="text-nexpura-charcoal-700 mt-0.5">—</div>
                </div>
                <div>
                  <div className="text-nexpura-charcoal-500 uppercase tracking-[0.04em]">Outstanding</div>
                  <div className="text-nexpura-charcoal-700 mt-0.5">—</div>
                </div>
              </div>
            </div>
            {/* Quick Action Icons */}
            <div className="flex items-center gap-2">
              {(selectedCustomer.mobile || selectedCustomer.phone) && (
                <a
                  href={`tel:${selectedCustomer.mobile || selectedCustomer.phone}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-nexpura-taupe-100 text-nexpura-charcoal-700 hover:text-nexpura-charcoal hover:border-nexpura-taupe-200 transition-colors"
                  title="Call customer"
                >
                  <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden />
                </a>
              )}
              {selectedCustomer.email && (
                <a
                  href={`mailto:${selectedCustomer.email}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-nexpura-taupe-100 text-nexpura-charcoal-700 hover:text-nexpura-charcoal hover:border-nexpura-taupe-200 transition-colors"
                  title="Email customer"
                >
                  <Mail className="w-4 h-4" strokeWidth={1.5} aria-hidden />
                </a>
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
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, first_name: e.target.value })
                }
                placeholder="First name"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input
                type="text"
                value={newCustomer.last_name}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, last_name: e.target.value })
                }
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
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, email: e.target.value })
                }
                placeholder="email@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, phone: e.target.value })
                }
                placeholder="04XX XXX XXX"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateCustomer}
              disabled={
                isCreatingCustomer ||
                (!newCustomer.first_name && !newCustomer.last_name)
              }
              className="px-5 py-2.5 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingCustomer ? "Creating..." : "Create Customer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewCustomerForm(false);
                setNewCustomer({
                  first_name: "",
                  last_name: "",
                  email: "",
                  phone: "",
                });
              }}
              className={ghostBtnCls}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // Customer Search — Section 12.4
        <div className="relative">
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowCustomerDropdown(true);
              if (isWalkIn) onWalkInToggle(false);
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            placeholder="Search customers by name, phone, or email"
            className={inputCls}
            disabled={isWalkIn}
          />
          {showCustomerDropdown && !isWalkIn && customers.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-nexpura-taupe-100 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(c);
                    setShowCustomerDropdown(false);
                    setCustomerSearch("");
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-nexpura-champagne/40 transition-colors border-b border-nexpura-taupe-100 last:border-b-0 flex items-center gap-3"
                >
                  <span className="w-8 h-8 rounded-full bg-nexpura-charcoal text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {c.full_name?.[0]?.toUpperCase() || "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-nexpura-charcoal text-sm truncate">
                      {c.full_name}
                    </span>
                    {(c.email || c.mobile || c.phone) && (
                      <span className="block text-xs text-nexpura-charcoal-500 truncate">
                        {c.mobile || c.phone || c.email}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Champagne info alert — Section 12.4 */}
          {!isWalkIn && (
            <div className="mt-4 flex items-start gap-2.5 px-3.5 py-2.5 bg-nexpura-champagne border border-nexpura-taupe-200 rounded-lg">
              <Info className="w-4 h-4 text-nexpura-charcoal-700 flex-shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
              <span className="text-sm text-nexpura-charcoal-700">
                No customer linked yet. Select an existing customer, mark as walk-in, or create a profile.
              </span>
            </div>
          )}

          {isWalkIn && (
            <div className="mt-4 flex items-center justify-between gap-3 px-3.5 py-2.5 bg-nexpura-ivory-elevated border border-nexpura-taupe-200 rounded-lg">
              <span className="text-sm text-nexpura-charcoal-700">
                Walk-in customer — no contact record will be saved.
              </span>
              <button
                type="button"
                onClick={() => onWalkInToggle(false)}
                className="text-xs font-medium text-nexpura-charcoal-700 hover:text-nexpura-charcoal underline-offset-2 hover:underline"
              >
                Undo
              </button>
            </div>
          )}

          {/* Secondary action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowNewCustomerForm(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-nexpura-charcoal-700 bg-white border border-nexpura-taupe-100 hover:bg-nexpura-champagne/40 transition-colors"
            >
              <UserPlus className="w-4 h-4" strokeWidth={1.5} aria-hidden />
              Create customer
            </button>
            <button
              type="button"
              onClick={() => onWalkInToggle(!isWalkIn)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isWalkIn
                  ? "bg-nexpura-charcoal text-white border border-nexpura-charcoal hover:bg-nexpura-charcoal-700"
                  : "text-nexpura-charcoal-700 bg-white border border-nexpura-taupe-100 hover:bg-nexpura-champagne/40"
              }`}
            >
              <UserX className="w-4 h-4" strokeWidth={1.5} aria-hidden />
              Use walk-in
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
