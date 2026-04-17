"use client";

import { useState } from "react";
import {
  JEWELLERY_TYPES,
  METAL_TYPES,
  METAL_PURITIES,
  METAL_COLOURS,
  REPAIR_ISSUES,
  PRIORITIES,
  PAYMENT_METHODS,
  RING_SIZES,
  STONE_SHAPES,
} from "../constants";
import { inputCls, selectCls, labelCls, cardCls, cardHeaderCls } from "./styles";

export interface RepairData {
  item_type: string;
  item_description: string;
  metal_type: string;
  metal_purity: string;
  metal_colour: string;
  stones: string;
  stone_count: string;
  size_length: string;
  current_size: string;
  hallmark: string;
  engraving: string;
  brand: string;
  serial_number: string;
  identifying_details: string;
  condition_notes: string;
  is_heirloom: boolean;
  customer_supplied: boolean;
  is_high_value: boolean;
  issue_type: string;
  work_description: string;
  risk_notes: string;
  priority: string;
  due_date: string;
  assigned_staff: string;
  resize_from: string;
  resize_to: string;
  replacement_stone_type: string;
  replacement_stone_shape: string;
  replacement_stone_carat: string;
  clasp_type: string;
  quoted_price: string;
  deposit_amount: string;
  payment_received: string;
  payment_method: string;
  discount_amount: string;
  payment_notes: string;
  repair_reference: string;
  assigned_salesperson: string;
  job_complete: boolean;
  job_complete_date: string;
  collected_by: string;
  collected_on: string;
  collection_status: string;
  workshop_routing: string;
  internal_notes: string;
  customer_communication_notes: string;
  followup_comments: string;
  reminder_date: string;
  delivery_notes: string;
}

interface RepairFormProps {
  data: RepairData;
  onChange: (data: RepairData) => void;
}

export default function RepairForm({ data, onChange }: RepairFormProps) {
  // State for "Other" free text fields
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const update = <K extends keyof RepairData>(field: K, value: RepairData[K]) => {
    onChange({ ...data, [field]: value });
  };

  // Handle select change with "other" support
  const handleSelectChange = (field: keyof RepairData, value: string) => {
    if (value === "other") {
      // Keep "other" in state, but actual value will come from free text
      update(field, "other" as RepairData[typeof field]);
    } else {
      update(field, value as RepairData[typeof field]);
      // Clear any "other" value for this field
      if (otherValues[field]) {
        setOtherValues(prev => {
          const newVals = { ...prev };
          delete newVals[field];
          return newVals;
        });
      }
    }
  };

  // Handle "other" text input change
  const handleOtherChange = (field: keyof RepairData, value: string) => {
    setOtherValues(prev => ({ ...prev, [field]: value }));
    // Update the actual form data with the custom value
    update(field, value as RepairData[typeof field]);
  };

  // Check if field is in "other" mode
  const isOtherMode = (field: keyof RepairData) => {
    return data[field] === "other" || (otherValues[field] && data[field] === otherValues[field]);
  };

  // Get select value (show "other" if custom value entered)
  const getSelectValue = (field: keyof RepairData, options: string[] | { value: string; label: string }[]): string => {
    const currentValue = data[field];
    if (!currentValue || typeof currentValue !== 'string') return "";
    
    // Check if it's a valid predefined option
    const isArray = Array.isArray(options) && typeof options[0] === 'string';
    if (isArray) {
      const exists = (options as string[]).includes(currentValue);
      if (exists) return currentValue;
    } else {
      const exists = (options as { value: string; label: string }[]).some(o => o.value === currentValue);
      if (exists) return currentValue;
    }
    
    // If not a predefined option, it's a custom "other" value
    return "other";
  };

  const balanceDue = Math.max(
    0,
    (parseFloat(data.quoted_price) || 0) - (parseFloat(data.deposit_amount) || 0)
  );

  const isRing = data.item_type.toLowerCase() === "ring";
  const showResizeFields = data.issue_type.toLowerCase().includes("resize");
  const showStoneFields = data.issue_type.toLowerCase().includes("stone");
  const showClaspFields = data.issue_type.toLowerCase().includes("clasp");

  // Payment status
  const getPaymentStatus = () => {
    const quote = parseFloat(data.quoted_price) || 0;
    const deposit = parseFloat(data.deposit_amount) || 0;
    if (quote <= 0) return null;
    if (deposit >= quote) return { label: "Paid in full", color: "bg-emerald-100 text-emerald-700" };
    if (deposit > 0) return { label: "Deposit received", color: "bg-blue-100 text-blue-700" };
    return { label: "Awaiting deposit", color: "bg-amber-100 text-amber-700" };
  };
  const paymentStatus = getPaymentStatus();

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          Card 1: Item Details
      ───────────────────────────────────────────────────────────── */}
      <section className={`${cardCls} p-6 mb-6`}>
        <h2 className={cardHeaderCls}>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Item Details
          </span>
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Item Type *</label>
            <select
              value={getSelectValue("item_type", JEWELLERY_TYPES)}
              onChange={(e) => handleSelectChange("item_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select type...</option>
              {JEWELLERY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="other">Other (specify)...</option>
            </select>
            {isOtherMode("item_type") && (
              <input
                type="text"
                placeholder="Please specify..."
                value={otherValues.item_type || (data.item_type !== "other" ? data.item_type : "")}
                onChange={(e) => handleOtherChange("item_type", e.target.value)}
                className={`${inputCls} mt-2`}
                autoFocus
              />
            )}
          </div>
          <div>
            <label className={labelCls}>Metal Type</label>
            <select
              value={getSelectValue("metal_type", METAL_TYPES)}
              onChange={(e) => handleSelectChange("metal_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select metal...</option>
              {METAL_TYPES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              <option value="other">Other (specify)...</option>
            </select>
            {isOtherMode("metal_type") && (
              <input
                type="text"
                placeholder="Please specify..."
                value={otherValues.metal_type || (data.metal_type !== "other" ? data.metal_type : "")}
                onChange={(e) => handleOtherChange("metal_type", e.target.value)}
                className={`${inputCls} mt-2`}
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Metal Purity</label>
            <select
              value={getSelectValue("metal_purity", METAL_PURITIES)}
              onChange={(e) => handleSelectChange("metal_purity", e.target.value)}
              className={selectCls}
            >
              <option value="">Select purity...</option>
              {METAL_PURITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="other">Other (specify)...</option>
            </select>
            {isOtherMode("metal_purity") && (
              <input
                type="text"
                placeholder="Please specify..."
                value={otherValues.metal_purity || (data.metal_purity !== "other" ? data.metal_purity : "")}
                onChange={(e) => handleOtherChange("metal_purity", e.target.value)}
                className={`${inputCls} mt-2`}
                autoFocus
              />
            )}
          </div>
          {isRing && (
            <div>
              <label className={labelCls}>Current Ring Size</label>
              <select
                value={data.current_size}
                onChange={(e) => update("current_size", e.target.value)}
                className={selectCls}
              >
                <option value="">Select size...</option>
                {RING_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className={labelCls}>Item Description *</label>
          <textarea
            value={data.item_description}
            onChange={(e) => update("item_description", e.target.value)}
            placeholder="Describe the piece in detail..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="mt-4">
          <label className={labelCls}>Condition on Arrival</label>
          <textarea
            value={data.condition_notes}
            onChange={(e) => update("condition_notes", e.target.value)}
            placeholder="Note any existing damage, scratches, or wear..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Compact Checkboxes */}
        <div className="mt-5 pt-4 border-t border-stone-100">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.is_heirloom}
                onChange={(e) => update("is_heirloom", e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-amber-700 focus:ring-amber-500/20"
              />
              <span className="text-sm text-stone-700">Heirloom</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.customer_supplied}
                onChange={(e) => update("customer_supplied", e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-amber-700 focus:ring-amber-500/20"
              />
              <span className="text-sm text-stone-700">Customer-supplied stones</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.is_high_value}
                onChange={(e) => update("is_high_value", e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-amber-700 focus:ring-amber-500/20"
              />
              <span className="text-sm text-stone-700">High-value item</span>
            </label>
          </div>
        </div>

        {/* Collapsible More Details Section */}
        <div className="mt-4 pt-4 border-t border-stone-100">
          <button
            type="button"
            onClick={() => setShowMoreDetails(!showMoreDetails)}
            className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1"
          >
            More details {showMoreDetails ? "▴" : "▾"}
          </button>
          
          {showMoreDetails && (
            <div className="mt-4 space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Metal Colour</label>
                  <select
                    value={data.metal_colour}
                    onChange={(e) => update("metal_colour", e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select colour...</option>
                    {METAL_COLOURS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Size / Length</label>
                  <input
                    type="text"
                    value={data.size_length}
                    onChange={(e) => update("size_length", e.target.value)}
                    placeholder="e.g. 45cm, Size M"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Stone Details</label>
                  <input
                    type="text"
                    value={data.stones}
                    onChange={(e) => update("stones", e.target.value)}
                    placeholder="e.g. 1x diamond, 2x sapphire"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hallmark / Stamp</label>
                  <input
                    type="text"
                    value={data.hallmark}
                    onChange={(e) => update("hallmark", e.target.value)}
                    placeholder="e.g. 750, 925"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Engraving</label>
                  <input
                    type="text"
                    value={data.engraving}
                    onChange={(e) => update("engraving", e.target.value)}
                    placeholder="Existing engraving text"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Brand / Collection</label>
                  <input
                    type="text"
                    value={data.brand}
                    onChange={(e) => update("brand", e.target.value)}
                    placeholder="e.g. Tiffany & Co"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Serial Number</label>
                <input
                  type="text"
                  value={data.serial_number}
                  onChange={(e) => update("serial_number", e.target.value)}
                  placeholder="Manufacturer serial or reference"
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          Card 2: Work Required
      ───────────────────────────────────────────────────────────── */}
      <section className={`${cardCls} p-6 mb-6`}>
        <h2 className={cardHeaderCls}>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Work Required
          </span>
        </h2>

        <div>
          <label className={labelCls}>Issue / Service Type</label>
          <select
            value={getSelectValue("issue_type", REPAIR_ISSUES)}
            onChange={(e) => handleSelectChange("issue_type", e.target.value)}
            className={selectCls}
          >
            <option value="">Select issue...</option>
            {REPAIR_ISSUES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
            <option value="other">Other (specify)...</option>
          </select>
          {isOtherMode("issue_type") && (
            <input
              type="text"
              placeholder="Please specify..."
              value={otherValues.issue_type || (data.issue_type !== "other" ? data.issue_type : "")}
              onChange={(e) => handleOtherChange("issue_type", e.target.value)}
              className={`${inputCls} mt-2`}
              autoFocus
            />
          )}
        </div>

        <div className="mt-4">
          <label className={labelCls}>Work Description</label>
          <textarea
            value={data.work_description}
            onChange={(e) => update("work_description", e.target.value)}
            placeholder="Detailed instructions for the repair. Include any risks or potential damage concerns..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Conditional Fields */}
        {showResizeFields && (
          <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
            <div>
              <label className={labelCls}>Resize From</label>
              <select
                value={data.resize_from}
                onChange={(e) => update("resize_from", e.target.value)}
                className={selectCls}
              >
                <option value="">Current size...</option>
                {RING_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Resize To</label>
              <select
                value={data.resize_to}
                onChange={(e) => update("resize_to", e.target.value)}
                className={selectCls}
              >
                <option value="">Target size...</option>
                {RING_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showStoneFields && (
          <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
            <div>
              <label className={labelCls}>Replacement Stone Type</label>
              <input
                type="text"
                value={data.replacement_stone_type}
                onChange={(e) => update("replacement_stone_type", e.target.value)}
                placeholder="e.g. Diamond"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Stone Shape</label>
              <select
                value={getSelectValue("replacement_stone_shape", STONE_SHAPES)}
                onChange={(e) => handleSelectChange("replacement_stone_shape", e.target.value)}
                className={selectCls}
              >
                <option value="">Select shape...</option>
                {STONE_SHAPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="other">Other (specify)...</option>
              </select>
              {isOtherMode("replacement_stone_shape") && (
                <input
                  type="text"
                  placeholder="Please specify..."
                  value={otherValues.replacement_stone_shape || (data.replacement_stone_shape !== "other" ? data.replacement_stone_shape : "")}
                  onChange={(e) => handleOtherChange("replacement_stone_shape", e.target.value)}
                  className={`${inputCls} mt-2`}
                  autoFocus
                />
              )}
            </div>
            <div>
              <label className={labelCls}>Approx Carat</label>
              <input
                type="text"
                value={data.replacement_stone_carat}
                onChange={(e) => update("replacement_stone_carat", e.target.value)}
                placeholder="e.g. 0.50"
                className={inputCls}
              />
            </div>
          </div>
        )}

        {showClaspFields && (
          <div className="mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
            <label className={labelCls}>Clasp Type</label>
            <input
              type="text"
              value={data.clasp_type}
              onChange={(e) => update("clasp_type", e.target.value)}
              placeholder="e.g. Lobster, Toggle, Box"
              className={inputCls}
            />
          </div>
        )}

        {/* Priority & Due Date (2-col row) */}
        <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-stone-100">
          <div>
            <label className={labelCls}>Priority</label>
            <select
              value={data.priority}
              onChange={(e) => update("priority", e.target.value)}
              className={selectCls}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Due Date</label>
            <input
              type="date"
              value={data.due_date}
              onChange={(e) => update("due_date", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          Card 3: Pricing & Payment
      ───────────────────────────────────────────────────────────── */}
      <section className={`${cardCls} p-6 mb-6`}>
        <h2 className={cardHeaderCls}>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pricing & Payment
          </span>
        </h2>

        {/* Financial Summary Strip */}
        <div className="mb-5 p-4 bg-stone-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide">Quote</p>
                <p className="text-lg font-semibold text-stone-900">
                  ${(parseFloat(data.quoted_price) || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-px h-10 bg-stone-200" />
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide">Deposit</p>
                <p className="text-lg font-semibold text-stone-900">
                  ${(parseFloat(data.deposit_amount) || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-px h-10 bg-stone-200" />
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide">Balance</p>
                <p className={`text-lg font-bold ${balanceDue > 0 ? "text-amber-700" : "text-emerald-600"}`}>
                  ${balanceDue.toFixed(2)}
                </p>
              </div>
            </div>
            {paymentStatus && (
              <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${paymentStatus.color}`}>
                {paymentStatus.label}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Estimated Price ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.quoted_price}
                onChange={(e) => update("quoted_price", e.target.value)}
                placeholder="0.00"
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Deposit Taken ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={data.deposit_amount}
                onChange={(e) => update("deposit_amount", e.target.value)}
                placeholder="0.00"
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Balance Due</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
              <input
                type="text"
                value={balanceDue.toFixed(2)}
                readOnly
                className={`${inputCls} pl-7 bg-stone-50 cursor-not-allowed`}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Payment Method</label>
          <select
            value={getSelectValue("payment_method", PAYMENT_METHODS)}
            onChange={(e) => handleSelectChange("payment_method", e.target.value)}
            className={selectCls}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
            <option value="other">Other (specify)...</option>
          </select>
          {isOtherMode("payment_method") && (
            <input
              type="text"
              placeholder="Please specify..."
              value={otherValues.payment_method || (data.payment_method !== "other" ? data.payment_method : "")}
              onChange={(e) => handleOtherChange("payment_method", e.target.value)}
              className={`${inputCls} mt-2`}
              autoFocus
            />
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          Card 4: Notes & Operations
      ───────────────────────────────────────────────────────────── */}
      <section className={`${cardCls} p-6 mb-6`}>
        <h2 className={cardHeaderCls}>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Notes & Operations
          </span>
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Assigned Salesperson</label>
            <input
              type="text"
              value={data.assigned_salesperson}
              onChange={(e) => update("assigned_salesperson", e.target.value)}
              placeholder="Salesperson name"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Workshop Routing</label>
            <input
              type="text"
              value={data.workshop_routing}
              onChange={(e) => update("workshop_routing", e.target.value)}
              placeholder="e.g. External, In-house"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Internal Notes</label>
          <textarea
            value={data.internal_notes}
            onChange={(e) => update("internal_notes", e.target.value)}
            placeholder="Workshop-only notes..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      </section>
    </>
  );
}
