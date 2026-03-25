"use client";

import { useState, useEffect } from "react";
import { searchCustomers, createCustomerInline } from "../actions";
import type { Customer } from "../types";
import { inputCls, labelCls } from "./styles";

interface CustomerSectionProps {
  initialCustomers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onError: (error: string) => void;
}

export default function CustomerSection({
  initialCustomers,
  selectedCustomer,
  onSelectCustomer,
  onError,
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
      setShowNewCustomerForm(false);
      setNewCustomer({ first_name: "", last_name: "", email: "", phone: "" });
    }
  };

  return (
    <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-stone-900">Customer</h2>
        {selectedCustomer && (
          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
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
              <p className="font-medium text-stone-900">
                {selectedCustomer.full_name || "Unknown"}
              </p>
              {(selectedCustomer.email ||
                selectedCustomer.mobile ||
                selectedCustomer.phone) && (
                <p className="text-sm text-stone-500 truncate">
                  {selectedCustomer.email ||
                    selectedCustomer.mobile ||
                    selectedCustomer.phone}
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
              className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 disabled:opacity-50 transition-colors"
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
          <p className="text-xs text-stone-400 mt-1">
            Optional — leave blank for walk-in
          </p>
        </div>
      )}
    </section>
  );
}
