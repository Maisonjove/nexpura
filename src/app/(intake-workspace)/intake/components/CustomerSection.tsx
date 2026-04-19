"use client";

import { useState, useEffect } from "react";
import { searchCustomers, createCustomerInline } from "../actions";
import type { Customer } from "../types";
import { inputCls, labelCls, cardCls, primaryBtnCls, ghostBtnCls } from "./styles";

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

  // Phone icon SVG
  const PhoneIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );

  // Email icon SVG
  const EmailIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );

  return (
    <section className={`${cardCls} p-6 mb-6`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-stone-900">Customer</h2>
        {selectedCustomer && (
          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
              setCustomerSearch("");
            }}
            className="text-sm text-amber-700 hover:text-amber-800 font-medium"
          >
            Change
          </button>
        )}
      </div>

      {selectedCustomer ? (
        // Selected Customer Card — Premium Display
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-5">
          <div className="flex items-start gap-4">
            {/* Avatar Initial Circle */}
            <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-semibold text-lg">
                {selectedCustomer.full_name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900 text-lg">
                {selectedCustomer.full_name || "Unknown"}
              </p>
              <div className="flex flex-col gap-1 mt-1.5">
                {selectedCustomer.email && (
                  <p className="text-sm text-stone-600">{selectedCustomer.email}</p>
                )}
                {(selectedCustomer.mobile || selectedCustomer.phone) && (
                  <p className="text-sm text-stone-600">
                    {selectedCustomer.mobile || selectedCustomer.phone}
                  </p>
                )}
              </div>
            </div>
            {/* Quick Action Icons */}
            <div className="flex items-center gap-2">
              {(selectedCustomer.mobile || selectedCustomer.phone) && (
                <a
                  href={`tel:${selectedCustomer.mobile || selectedCustomer.phone}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-amber-700 hover:border-amber-300 transition-colors"
                  title="Call customer"
                >
                  <PhoneIcon />
                </a>
              )}
              {selectedCustomer.email && (
                <a
                  href={`mailto:${selectedCustomer.email}`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-amber-700 hover:border-amber-300 transition-colors"
                  title="Email customer"
                >
                  <EmailIcon />
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
              className={primaryBtnCls}
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
        // Customer Search
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
            placeholder="Search by name, phone, or email..."
            className={inputCls}
            disabled={isWalkIn}
          />
          {showCustomerDropdown && !isWalkIn && customers.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(c);
                    setShowCustomerDropdown(false);
                    setCustomerSearch("");
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0"
                >
                  <p className="font-medium text-stone-900 text-sm">
                    {c.full_name}
                  </p>
                  {(c.email || c.mobile || c.phone) && (
                    <p className="text-xs text-stone-500">
                      {c.email || c.mobile || c.phone}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Walk-in Toggle */}
          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isWalkIn}
                onChange={(e) => onWalkInToggle(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-amber-700 focus:ring-amber-500/20"
              />
              <span className="text-sm text-stone-700">Walk-in customer (no record)</span>
            </label>
          </div>

          {/* Warning if no customer and not walk-in */}
          {!isWalkIn && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-800">No customer linked to this job</span>
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
        </div>
      )}
    </section>
  );
}
