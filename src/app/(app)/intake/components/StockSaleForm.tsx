"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { searchInventory } from "../actions";
import type { InventoryItem, TaxConfig } from "../types";
import { PAYMENT_METHODS } from "../constants";
import { inputCls, selectCls, labelCls } from "./styles";

export interface StockData {
  price: string;
  payment_received: string;
  payment_method: string;
  create_invoice: boolean;
}

interface StockSaleFormProps {
  data: StockData;
  onChange: (data: StockData) => void;
  selectedInventory: InventoryItem | null;
  onSelectInventory: (item: InventoryItem | null) => void;
  taxConfig: TaxConfig;
}

export default function StockSaleForm({
  data,
  onChange,
  selectedInventory,
  onSelectInventory,
  taxConfig,
}: StockSaleFormProps) {
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryResults, setInventoryResults] = useState<InventoryItem[]>([]);
  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: taxConfig.currency || "AUD",
    }).format(amount);
  };

  // Inventory Search Effect
  useEffect(() => {
    if (inventorySearch.length < 2) {
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
  }, [inventorySearch]);

  return (
    <>
      {/* Stock Search */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-4">
          Stock Item
        </h2>

        {selectedInventory ? (
          // Selected Item Card
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <div className="flex items-start gap-4">
              {selectedInventory.primary_image ? (
                <Image
                  src={selectedInventory.primary_image}
                  alt={selectedInventory.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 bg-stone-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-stone-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-stone-900">
                      {selectedInventory.name}
                    </p>
                    <p className="text-sm text-stone-500">
                      SKU: {selectedInventory.sku || "—"}
                    </p>
                    {selectedInventory.metal_type && (
                      <p className="text-sm text-stone-500 capitalize">
                        {selectedInventory.metal_type}{" "}
                        {selectedInventory.metal_purity}
                        {selectedInventory.stone_type &&
                          ` • ${selectedInventory.stone_type}`}
                        {selectedInventory.stone_carat &&
                          ` ${selectedInventory.stone_carat}ct`}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectInventory(null);
                      setInventorySearch("");
                      onChange({ ...data, price: "" });
                    }}
                    className="text-stone-400 hover:text-stone-600"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <span className="text-lg font-semibold text-amber-700">
                    {formatCurrency(selectedInventory.retail_price || 0)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      (selectedInventory.quantity || 0) > 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
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
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
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
                      onSelectInventory(item);
                      setShowInventoryDropdown(false);
                      setInventorySearch("");
                      onChange({
                        ...data,
                        price: String(item.retail_price || ""),
                      });
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      {item.primary_image ? (
                        <Image
                          src={item.primary_image}
                          alt=""
                          width={40}
                          height={40}
                          className="w-10 h-10 object-cover rounded"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 bg-stone-100 rounded flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-stone-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-900 text-sm truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-stone-500">
                          SKU: {item.sku || "—"}
                        </p>
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
          <h2 className="text-base font-semibold text-stone-900 mb-4">
            Payment
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sale Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.price}
                  onChange={(e) => onChange({ ...data, price: e.target.value })}
                  placeholder={String(selectedInventory.retail_price || 0)}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Payment Received</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.payment_received}
                  onChange={(e) =>
                    onChange({ ...data, payment_received: e.target.value })
                  }
                  placeholder="0.00"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>Payment Method</label>
            <select
              value={data.payment_method}
              onChange={(e) =>
                onChange({ ...data, payment_method: e.target.value })
              }
              className={selectCls}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="create_invoice"
              checked={data.create_invoice}
              onChange={(e) =>
                onChange({ ...data, create_invoice: e.target.checked })
              }
              className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="create_invoice" className="text-sm text-stone-700">
              Generate invoice
            </label>
          </div>
        </section>
      )}
    </>
  );
}
