"use client";

import { useState } from "react";
import {
  JEWELLERY_TYPES,
  METAL_TYPES,
  METAL_PURITIES,
  PRIORITIES,
  PAYMENT_METHODS,
  RING_SIZES,
  STONE_SHAPES,
  SETTING_STYLES,
} from "../constants";
import { inputCls, selectCls, labelCls, cardCls, cardHeaderCls } from "./styles";

export interface BespokeData {
  title: string;
  jewellery_type: string;
  description: string;
  design_source: string;
  budget: string;
  timeline: string;
  metal_type: string;
  metal_colour: string;
  metal_purity: string;
  stone_type: string;
  stone_details: string;
  stone_count: string;
  stone_shape: string;
  setting_style: string;
  ring_size: string;
  dimensions: string;
  notes: string;
  priority: string;
  due_date: string;
  quoted_price: string;
  deposit_amount: string;
  payment_received: string;
  payment_method: string;
  discount_amount: string;
  payment_notes: string;
  job_reference: string;
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

interface BespokeFormProps {
  data: BespokeData;
  onChange: (data: BespokeData) => void;
}

export default function BespokeForm({ data, onChange }: BespokeFormProps) {
  // State for "Other" free text fields
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});

  const update = <K extends keyof BespokeData>(field: K, value: BespokeData[K]) => {
    onChange({ ...data, [field]: value });
  };

  // Handle select change with "other" support
  const handleSelectChange = (field: keyof BespokeData, value: string) => {
    if (value.toLowerCase() === "other") {
      update(field, "other" as BespokeData[typeof field]);
    } else {
      update(field, value as BespokeData[typeof field]);
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
  const handleOtherChange = (field: keyof BespokeData, value: string) => {
    setOtherValues(prev => ({ ...prev, [field]: value }));
    update(field, value as BespokeData[typeof field]);
  };

  // Check if field is in "other" mode
  const isOtherMode = (field: keyof BespokeData) => {
    return data[field] === "other" || (otherValues[field] && data[field] === otherValues[field]);
  };

  // Get select value (show "other" if custom value entered)
  const getSelectValue = (field: keyof BespokeData, options: string[] | { value: string; label: string }[]): string => {
    const currentValue = data[field];
    if (!currentValue || typeof currentValue !== 'string') return "";
    
    const isArray = Array.isArray(options) && typeof options[0] === 'string';
    if (isArray) {
      const exists = (options as string[]).includes(currentValue);
      if (exists) return currentValue;
    } else {
      const exists = (options as { value: string; label: string }[]).some(o => o.value === currentValue);
      if (exists) return currentValue;
    }
    
    return "other";
  };

  const balanceDue = Math.max(
    0,
    (parseFloat(data.quoted_price) || 0) - (parseFloat(data.deposit_amount) || 0)
  );

  const isRing = data.jewellery_type.toLowerCase() === "ring";

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
          Card 1: Job Details
      ───────────────────────────────────────────────────────────── */}
      <section className={`${cardCls} p-6 mb-6`}>
        <h2 className={cardHeaderCls}>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Job Details
          </span>
        </h2>

        <div>
          <label className={labelCls}>Title *</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Custom Engagement Ring"
            className={inputCls}
          />
        </div>

        <div className="mt-4">
          <label className={labelCls}>Brief / Description</label>
          <textarea
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Describe what the customer wants..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Budget Range</label>
            <input
              type="text"
              value={data.budget}
              onChange={(e) => update("budget", e.target.value)}
              placeholder="e.g. $5,000 - $8,000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Timeline</label>
            <input
              type="text"
              value={data.timeline}
              onChange={(e) => update("timeline", e.target.value)}
              placeholder="e.g. 6-8 weeks"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Jewellery Type</label>
            <select
              value={getSelectValue("jewellery_type", JEWELLERY_TYPES.map(t => t.toLowerCase()))}
              onChange={(e) => handleSelectChange("jewellery_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select type...</option>
              {JEWELLERY_TYPES.map((t) => (
                <option key={t} value={t.toLowerCase()}>{t}</option>
              ))}
              <option value="other">Other (specify)...</option>
            </select>
            {isOtherMode("jewellery_type") && (
              <input
                type="text"
                placeholder="Please specify..."
                value={otherValues.jewellery_type || (data.jewellery_type !== "other" ? data.jewellery_type : "")}
                onChange={(e) => handleOtherChange("jewellery_type", e.target.value)}
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
      </section>

      {/* ─────────────────────────────────────────────────────────────
          Card 2: Specifications
      ───────────────────────────────────────────────────────────── */}
      <section className={`${cardCls} p-6 mb-6`}>
        <h2 className={cardHeaderCls}>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Specifications
          </span>
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Stone Details</label>
            <input
              type="text"
              value={data.stone_details}
              onChange={(e) => update("stone_details", e.target.value)}
              placeholder="e.g. 1.5ct, F colour, VS1"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Stone Shape</label>
            <select
              value={getSelectValue("stone_shape", STONE_SHAPES)}
              onChange={(e) => handleSelectChange("stone_shape", e.target.value)}
              className={selectCls}
            >
              <option value="">Select shape...</option>
              {STONE_SHAPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="other">Other (specify)...</option>
            </select>
            {isOtherMode("stone_shape") && (
              <input
                type="text"
                placeholder="Please specify..."
                value={otherValues.stone_shape || (data.stone_shape !== "other" ? data.stone_shape : "")}
                onChange={(e) => handleOtherChange("stone_shape", e.target.value)}
                className={`${inputCls} mt-2`}
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Setting Style</label>
            <select
              value={getSelectValue("setting_style", SETTING_STYLES)}
              onChange={(e) => handleSelectChange("setting_style", e.target.value)}
              className={selectCls}
            >
              <option value="">Select style...</option>
              {SETTING_STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="other">Other (specify)...</option>
            </select>
            {isOtherMode("setting_style") && (
              <input
                type="text"
                placeholder="Please specify..."
                value={otherValues.setting_style || (data.setting_style !== "other" ? data.setting_style : "")}
                onChange={(e) => handleOtherChange("setting_style", e.target.value)}
                className={`${inputCls} mt-2`}
                autoFocus
              />
            )}
          </div>
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
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          {isRing && (
            <div>
              <label className={labelCls}>Ring Size</label>
              <select
                value={data.ring_size}
                onChange={(e) => update("ring_size", e.target.value)}
                className={selectCls}
              >
                <option value="">Select size...</option>
                {RING_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Dimensions / Size</label>
            <input
              type="text"
              value={data.dimensions}
              onChange={(e) => update("dimensions", e.target.value)}
              placeholder="e.g. 45cm length"
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
          Card 4: Notes
      ───────────────────────────────────────────────────────────── */}
      <section className={`${cardCls} p-6 mb-6`}>
        <h2 className={cardHeaderCls}>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Notes
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
