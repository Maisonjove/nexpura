"use client";

import {
  JEWELLERY_TYPES,
  METAL_TYPES,
  METAL_PURITIES,
  PRIORITIES,
  PAYMENT_METHODS,
  RING_SIZES,
} from "../constants";
import { inputCls, selectCls, labelCls } from "./styles";

export interface BespokeData {
  title: string;
  jewellery_type: string;
  description: string;
  design_source: string;
  metal_type: string;
  metal_colour: string;
  metal_purity: string;
  stone_type: string;
  stone_details: string;
  ring_size: string;
  dimensions: string;
  notes: string;
  priority: string;
  due_date: string;
  quoted_price: string;
  deposit_amount: string;
  payment_received: string;
  payment_method: string;
}

interface BespokeFormProps {
  data: BespokeData;
  onChange: (data: BespokeData) => void;
}

export default function BespokeForm({ data, onChange }: BespokeFormProps) {
  const update = (field: keyof BespokeData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <>
      {/* Job Core */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-4">
          Job Details
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
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Jewellery Type</label>
            <select
              value={data.jewellery_type}
              onChange={(e) => update("jewellery_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select type...</option>
              {JEWELLERY_TYPES.map((t) => (
                <option key={t} value={t.toLowerCase()}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <select
              value={data.priority}
              onChange={(e) => update("priority", e.target.value)}
              className={selectCls}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
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
        <div className="mt-4">
          <label className={labelCls}>Design Source / Inspiration</label>
          <input
            type="text"
            value={data.design_source}
            onChange={(e) => update("design_source", e.target.value)}
            placeholder="Reference images, sketches, existing pieces..."
            className={inputCls}
          />
        </div>
      </section>

      {/* Specifications */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-4">
          Specifications
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Metal Type</label>
            <select
              value={data.metal_type}
              onChange={(e) => update("metal_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select metal...</option>
              {METAL_TYPES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Metal Colour</label>
            <select
              value={data.metal_colour}
              onChange={(e) => update("metal_colour", e.target.value)}
              className={selectCls}
            >
              <option value="">Select colour...</option>
              <option value="yellow">Yellow</option>
              <option value="white">White</option>
              <option value="rose">Rose</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Purity</label>
            <select
              value={data.metal_purity}
              onChange={(e) => update("metal_purity", e.target.value)}
              className={selectCls}
            >
              <option value="">Select purity...</option>
              {METAL_PURITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Stone Type</label>
            <select
              value={data.stone_type}
              onChange={(e) => update("stone_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select stone...</option>
              <option value="diamond">Diamond</option>
              <option value="lab_diamond">Lab Diamond</option>
              <option value="sapphire">Sapphire</option>
              <option value="ruby">Ruby</option>
              <option value="emerald">Emerald</option>
              <option value="pearl">Pearl</option>
              <option value="other">Other</option>
            </select>
          </div>
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
        </div>
        {data.jewellery_type === "ring" && (
          <div className="mt-4">
            <label className={labelCls}>Ring Size</label>
            <select
              value={data.ring_size}
              onChange={(e) => update("ring_size", e.target.value)}
              className={selectCls}
            >
              <option value="">Select size...</option>
              {RING_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-4">
          <label className={labelCls}>Additional Notes</label>
          <textarea
            value={data.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Any other specifications or requirements..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>
      </section>

      {/* Pricing & Payment */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-4">
          Pricing & Payment
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                $
              </span>
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
            <label className={labelCls}>Deposit Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                $
              </span>
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
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Balance</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={Math.max(
                  0,
                  (parseFloat(data.quoted_price) || 0) -
                    (parseFloat(data.deposit_amount) || 0)
                ).toFixed(2)}
                readOnly
                className={`${inputCls} pl-7 bg-stone-50 cursor-not-allowed`}
              />
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Auto-calculated: Amount - Deposit
            </p>
          </div>
          <div>
            <label className={labelCls}>Payment Method</label>
            <select
              value={data.payment_method}
              onChange={(e) => update("payment_method", e.target.value)}
              className={selectCls}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls}>Due Date</label>
          <input
            type="date"
            value={data.due_date}
            onChange={(e) => update("due_date", e.target.value)}
            className={inputCls}
          />
        </div>
      </section>
    </>
  );
}
