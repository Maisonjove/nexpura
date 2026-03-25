"use client";

import {
  JEWELLERY_TYPES,
  METAL_TYPES,
  REPAIR_ISSUES,
  PRIORITIES,
  PAYMENT_METHODS,
} from "../constants";
import { inputCls, selectCls, labelCls } from "./styles";

export interface RepairData {
  item_type: string;
  item_description: string;
  metal_type: string;
  stones: string;
  size_length: string;
  identifying_details: string;
  condition_notes: string;
  issue_type: string;
  work_description: string;
  risk_notes: string;
  priority: string;
  due_date: string;
  quoted_price: string;
  deposit_amount: string;
  payment_received: string;
  payment_method: string;
}

interface RepairFormProps {
  data: RepairData;
  onChange: (data: RepairData) => void;
}

export default function RepairForm({ data, onChange }: RepairFormProps) {
  const update = (field: keyof RepairData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <>
      {/* Item Intake */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-4">
          Item Details
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Item Type *</label>
            <select
              value={data.item_type}
              onChange={(e) => update("item_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select type...</option>
              {JEWELLERY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
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
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Stones</label>
            <input
              type="text"
              value={data.stones}
              onChange={(e) => update("stones", e.target.value)}
              placeholder="e.g. 1x diamond, 2x sapphire"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Size / Length</label>
            <input
              type="text"
              value={data.size_length}
              onChange={(e) => update("size_length", e.target.value)}
              placeholder="e.g. Size M, 45cm"
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls}>Identifying Details</label>
          <input
            type="text"
            value={data.identifying_details}
            onChange={(e) => update("identifying_details", e.target.value)}
            placeholder="Serial number, hallmarks, engravings..."
            className={inputCls}
          />
        </div>
        <div className="mt-4">
          <label className={labelCls}>Condition Notes</label>
          <textarea
            value={data.condition_notes}
            onChange={(e) => update("condition_notes", e.target.value)}
            placeholder="Note any existing damage, scratches, or wear..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>
      </section>

      {/* Work Required */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-4">
          Work Required
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Issue Type</label>
            <select
              value={data.issue_type}
              onChange={(e) => update("issue_type", e.target.value)}
              className={selectCls}
            >
              <option value="">Select issue...</option>
              {REPAIR_ISSUES.map((i) => (
                <option key={i} value={i}>
                  {i}
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
          <label className={labelCls}>Work Description</label>
          <textarea
            value={data.work_description}
            onChange={(e) => update("work_description", e.target.value)}
            placeholder="Detailed instructions for the repair..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div className="mt-4">
          <label className={labelCls}>Risk / Damage Notes</label>
          <textarea
            value={data.risk_notes}
            onChange={(e) => update("risk_notes", e.target.value)}
            placeholder="Any risks or potential issues to note..."
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
