"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import {
  addBespokeLineItem,
  removeBespokeLineItem,
  recordBespokePayment,
  generateBespokeInvoice,
  updateBespokeStage,
  emailBespokeInvoice,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string | null;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  tax_rate: number;
  total: number;
  amount_paid: number;
  lineItems: LineItem[];
  payments: Payment[];
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  retail_price: number | null;
}

interface JobAttachment {
  id: string;
  file_name: string;
  file_url: string;
  caption: string | null;
  created_at: string;
}

interface JobEvent {
  id: string;
  event_type: string;
  description: string;
  actor: string | null;
  created_at: string;
}

interface BespokeJob {
  id: string;
  job_number: string;
  title: string;
  description: string | null;
  jewellery_type: string | null;
  metal_type: string | null;
  metal_colour: string | null;
  metal_purity: string | null;
  stone_type: string | null;
  stone_carat: number | null;
  stone_colour: string | null;
  stone_clarity: string | null;
  ring_size: string | null;
  setting_style: string | null;
  stage: string;
  priority: string;
  quoted_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  due_date: string | null;
  invoice_id: string | null;
  internal_notes: string | null;
  workshop_notes: string | null;
}

interface Props {
  job: BespokeJob;
  customer: Customer | null;
  invoice: Invoice | null;
  inventory: InventoryItem[];
  tenantId: string;
  currency: string;
  readOnly?: boolean;
  attachments?: JobAttachment[];
  events?: JobEvent[];
}

// ─── Stage Config ─────────────────────────────────────────────────────────────

const BESPOKE_STAGES = [
  { key: "brief", label: "Brief" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "cad", label: "CAD" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
];

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  brief: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  assessed: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  quoted: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
  approved: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" },
  cad: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-[#B45309]" },
  ready: { bg: "bg-stone-200", text: "text-stone-900", dot: "bg-[#8B7355]" },
  delivered: { bg: "bg-stone-900", text: "text-white", dot: "bg-white" },
};

const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "cheque", "store_credit"];

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

function humanise(val: string | null | undefined) {
  if (!val) return null;
  return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function statusChip(invoice: Invoice | null, job: BespokeJob, currency: string) {
  if (!invoice) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">Unpaid</span>;
  }
  if (invoice.amount_paid >= invoice.total && invoice.total > 0) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-900 text-white">Fully Paid</span>;
  }
  if (invoice.amount_paid > 0 && invoice.amount_paid < invoice.total) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">Partially Paid ({fmt(invoice.amount_paid, currency)})</span>;
  }
  if (job.deposit_paid) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Deposit Paid</span>;
  }
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">Unpaid</span>;
}

export default function BespokeCommandCenter({ job, customer, invoice, inventory, tenantId, currency, readOnly = false, attachments = [], events = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showAddManual, setShowAddManual] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [targetStage, setTargetStage] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);

  const [manualDesc, setManualDesc] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualPrice, setManualPrice] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isTerminal = ["delivered", "cancelled"].includes(job.stage);
  const currentStageIndex = BESPOKE_STAGES.findIndex(s => s.key === job.stage);
  const sc = STAGE_COLORS[job.stage] ?? STAGE_COLORS.brief;
  const isOverdue = job.due_date && new Date(job.due_date) < new Date(new Date().toDateString()) && !isTerminal;

  const balanceDue = invoice
    ? Math.max(0, invoice.total - invoice.amount_paid)
    : (job.quoted_price ?? 0) - (job.deposit_paid ? (job.deposit_amount ?? 0) : 0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function refresh() { router.refresh(); }

  async function handleAddManual() {
    setFormError(null);
    const qty = parseInt(manualQty) || 1;
    const price = parseFloat(manualPrice) || 0;
    if (!manualDesc.trim()) { setFormError("Description is required"); return; }
    startTransition(async () => {
      const result = await addBespokeLineItem(job.id, tenantId, { description: manualDesc, qty, unitPrice: price });
      if (result.error) { setFormError(result.error); return; }
      setShowAddManual(false);
      setManualDesc(""); setManualQty("1"); setManualPrice("");
      refresh();
    });
  }

  async function handleAddStock() {
    setFormError(null);
    if (!selectedInventoryId) { setFormError("Select an item"); return; }
    const item = inventory.find(i => i.id === selectedInventoryId);
    if (!item) return;
    startTransition(async () => {
      const result = await addBespokeLineItem(job.id, tenantId, {
        description: item.name, qty: 1, unitPrice: item.retail_price ?? 0, inventoryId: item.id,
      });
      if (result.error) { setFormError(result.error); return; }
      setShowAddStock(false); setSelectedInventoryId("");
      refresh();
    });
  }

  async function handleRemoveLineItem(id: string) {
    startTransition(async () => {
      const result = await removeBespokeLineItem(id, job.id, tenantId);
      if (result.error) showToast(`Error: ${result.error}`);
      else refresh();
    });
  }

  async function handlePayment() {
    setFormError(null);
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) { setFormError("Enter a valid amount"); return; }
    if (!invoice) { setFormError("No invoice linked. Add a line item first."); return; }
    startTransition(async () => {
      const result = await recordBespokePayment(job.id, invoice.id, tenantId, amount, paymentMethod, paymentNotes);
      if (result.error) { setFormError(result.error); return; }
      setShowPayment(false);
      setPaymentAmount(""); setPaymentNotes("");
      refresh();
    });
  }

  async function handleMarkFullyPaid() {
    if (!invoice) { showToast("No invoice — add a line item first"); return; }
    const remaining = invoice.total - invoice.amount_paid;
    if (remaining <= 0) { showToast("Invoice is already fully paid"); return; }
    startTransition(async () => {
      const result = await recordBespokePayment(job.id, invoice.id, tenantId, remaining, "card", "Marked fully paid");
      if (result.error) showToast(`Error: ${result.error}`);
      else { showToast("✓ Marked as fully paid"); refresh(); }
    });
  }

  async function handleGenerateInvoice() {
    startTransition(async () => {
      const result = await generateBespokeInvoice(job.id, tenantId);
      if (result.error) showToast(`Error: ${result.error}`);
      else { showToast("✓ Invoice generated"); refresh(); }
    });
  }

  function handleStageChange(stage: string) {
    setTargetStage(stage);
    setShowStageModal(true);
  }

  async function confirmStageChange() {
    startTransition(async () => {
      const result = await updateBespokeStage(job.id, tenantId, targetStage);
      if (result.error) showToast(`Error: ${result.error}`);
      else { setShowStageModal(false); showToast(`✓ Stage updated`); refresh(); }
    });
  }

  function openPaymentModal(prefill?: number) {
    setPaymentAmount(prefill ? String(prefill) : "");
    setPaymentMethod("card"); setPaymentNotes(""); setFormError(null);
    setShowPayment(true);
  }

  async function handleEmailInvoice() {
    if (!invoice) return;
    setEmailSending(true);
    const result = await emailBespokeInvoice(job.id, invoice.id);
    setEmailSending(false);
    if (result.error) showToast(`Error: ${result.error}`);
    else { showToast("✓ Invoice emailed to customer"); refresh(); }
  }

  function formatDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  // Build specs list
  const specs: { label: string; value: string }[] = [];
  if (job.jewellery_type) specs.push({ label: "Type", value: humanise(job.jewellery_type) ?? "" });
  if (job.metal_type) specs.push({ label: "Metal", value: humanise(job.metal_type) ?? "" });
  if (job.metal_colour) specs.push({ label: "Metal Colour", value: humanise(job.metal_colour) ?? "" });
  if (job.metal_purity) specs.push({ label: "Purity", value: job.metal_purity });
  if (job.stone_type) specs.push({ label: "Stone", value: humanise(job.stone_type) ?? "" });
  if (job.stone_carat) specs.push({ label: "Carat", value: `${job.stone_carat}ct` });
  if (job.stone_colour) specs.push({ label: "Colour", value: job.stone_colour });
  if (job.stone_clarity) specs.push({ label: "Clarity", value: job.stone_clarity });
  if (job.ring_size) specs.push({ label: "Ring Size", value: job.ring_size });
  if (job.setting_style) specs.push({ label: "Setting", value: humanise(job.setting_style) ?? "" });

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="py-4">
        <Link href="/bespoke" className="text-sm text-stone-400 hover:text-stone-700 transition-colors">← Bespoke Jobs</Link>
      </div>

      {/* ── TOP STATUS STRIP ───────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-base font-semibold text-stone-900">{job.job_number}</span>
          <span className="text-stone-300">·</span>
          <span className="text-sm text-stone-700 font-medium">{customer?.full_name ?? "—"}</span>
          <span className="text-stone-300">·</span>
          <span className="text-sm text-stone-600 truncate max-w-xs font-medium">{job.title}</span>
          <span className="text-stone-300">·</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {BESPOKE_STAGES.find(s => s.key === job.stage)?.label ?? job.stage}
          </span>
          {statusChip(invoice, job, currency)}
          {job.due_date && (
            <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-stone-500"}`}>
              {isOverdue ? "⚠ Overdue · " : "Due: "}
              {new Date(job.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {!readOnly && (
            <Link href={`/bespoke/${job.id}/edit`} className="ml-auto text-xs text-stone-400 hover:text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg transition-colors">
              Edit
            </Link>
          )}
        </div>

        {/* Alert banners */}
        <div className="mt-3 flex flex-wrap gap-2">
          {isOverdue && <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium">⚠ Overdue</span>}
          {!customer?.email && !customer?.mobile && <span className="text-xs bg-stone-50 text-stone-600 border border-stone-200 px-3 py-1 rounded-full">📵 No contact info</span>}
          {!invoice && !isTerminal && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full">📄 No invoice yet</span>}
          {job.stage === "ready" && <span className="text-xs bg-stone-100 text-stone-800 border border-stone-300 px-3 py-1 rounded-full font-semibold">✅ Ready for pickup</span>}
          {balanceDue > 0 && !isTerminal && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-medium">
              Balance due: {fmt(balanceDue, currency)}
            </span>
          )}
        </div>
      </div>

      {/* ── TWO-COLUMN LAYOUT ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5 items-start">
        {/* ── LEFT COLUMN ───────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* 1. Customer card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Customer</h2>
            {customer ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-stone-900">{customer.full_name}</p>
                  {customer.email && <p className="text-sm text-stone-500 mt-0.5">{customer.email}</p>}
                  {customer.mobile && <p className="text-sm text-stone-500">{customer.mobile}</p>}
                </div>
                <Link href={`/customers/${customer.id}`} className="text-xs text-[#B45309] hover:underline font-medium shrink-0">View Customer →</Link>
              </div>
            ) : (
              <p className="text-sm text-stone-400">No customer linked</p>
            )}
          </div>

          {/* 2. Job Brief card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Job Brief</h2>
            <h3 className="text-base font-semibold text-stone-900 mb-1">{job.title}</h3>
            {job.description && <p className="text-sm text-stone-600 leading-relaxed mb-4">{job.description}</p>}

            {specs.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Specifications</p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {specs.map(s => (
                    <div key={s.label} className="bg-stone-50 rounded-lg p-2.5">
                      <dt className="text-xs text-stone-400 mb-0.5">{s.label}</dt>
                      <dd className="text-sm font-semibold text-stone-900">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {(job.internal_notes || job.workshop_notes) && (
              <div>
                <button onClick={() => setShowNotes(!showNotes)} className="text-xs text-[#B45309] hover:underline font-medium">
                  {showNotes ? "Hide notes ↑" : "Show notes ↓"}
                </button>
                {showNotes && (
                  <div className="mt-2 space-y-2">
                    {job.internal_notes && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3"><span className="font-semibold">Internal:</span> {job.internal_notes}</p>}
                    {job.workshop_notes && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3"><span className="font-semibold">Workshop:</span> {job.workshop_notes}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Stage timeline */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Stage Timeline</h2>
            <div className="relative">
              <div className="absolute left-3.5 top-4 bottom-4 w-0.5 bg-stone-100" />
              <div className="space-y-1">
                {BESPOKE_STAGES.map((s, idx) => {
                  const isPast = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  const isClickable = !readOnly && !isTerminal && idx > currentStageIndex;
                  return (
                    <div
                      key={s.key}
                      className={`flex items-center gap-3 px-2 py-2.5 rounded-lg relative transition-colors ${isClickable ? "cursor-pointer hover:bg-stone-50" : ""} ${isCurrent ? "bg-stone-50" : ""}`}
                      onClick={isClickable ? () => handleStageChange(s.key) : undefined}
                    >
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 z-10 flex items-center justify-center ${isPast ? "bg-[#B45309]" : isCurrent ? "bg-stone-900 ring-4 ring-stone-200" : "bg-white border-2 border-stone-200"}`}>
                        {isPast && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isCurrent && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className={`text-sm ${isPast ? "text-stone-400 line-through" : isCurrent ? "text-stone-900 font-semibold" : "text-stone-500"}`}>{s.label}</span>
                      {isCurrent && <span className="ml-auto text-xs bg-stone-900 text-white px-2 py-0.5 rounded-full">Current</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Photos & Attachments */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Photos &amp; Attachments</h2>
            {attachments.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {attachments.map(a => (
                  <div key={a.id} className="relative group">
                    <img src={a.file_url} alt={a.caption ?? a.file_name} className="w-full aspect-square object-cover rounded-lg" />
                    <p className="text-xs text-stone-500 mt-1 truncate">{a.caption ?? a.file_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">No photos attached</p>
            )}
            {!readOnly && (
              <p className="text-xs text-stone-400 mt-3">Photo upload via cloud storage — coming soon</p>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Activity</h2>
            <div className="space-y-2">
              {events.map(ev => (
                <div key={ev.id} className="flex items-start gap-2 text-sm">
                  <span className="text-stone-400 text-xs whitespace-nowrap mt-0.5">{formatDate(ev.created_at)}</span>
                  <span className="text-stone-600">{ev.description}</span>
                </div>
              ))}
              {events.length === 0 && <p className="text-sm text-stone-400">No activity yet</p>}
            </div>
          </div>

          {/* 4. Line items card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Line Items</h2>
              {invoice && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${invoice.status === "paid" ? "bg-stone-900 text-white" : invoice.status === "partial" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
                  {invoice.status}
                </span>
              )}
            </div>

            {invoice && invoice.lineItems.length > 0 ? (
              <div className="mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-stone-400 uppercase tracking-wider">
                      <th className="text-left pb-2 font-medium">Description</th>
                      <th className="text-right pb-2 font-medium w-12">Qty</th>
                      <th className="text-right pb-2 font-medium w-20">Price</th>
                      <th className="text-right pb-2 font-medium w-20">Total</th>
                      {!readOnly && <th className="w-8 pb-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {invoice.lineItems.map(li => (
                      <tr key={li.id}>
                        <td className="py-2.5 text-stone-800">{li.description}</td>
                        <td className="py-2.5 text-right text-stone-600">{li.quantity}</td>
                        <td className="py-2.5 text-right text-stone-600">{fmt(li.unit_price, currency)}</td>
                        <td className="py-2.5 text-right text-stone-900 font-medium">{fmt(li.total, currency)}</td>
                        {!readOnly && (
                          <td className="py-2.5 text-right">
                            <button onClick={() => handleRemoveLineItem(li.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-stone-200">
                      <td colSpan={readOnly ? 3 : 4} className="pt-2.5 text-xs text-stone-400">Subtotal</td>
                      <td className="pt-2.5 text-right text-sm text-stone-700">{fmt(invoice.subtotal, currency)}</td>
                    </tr>
                    <tr>
                      <td colSpan={readOnly ? 3 : 4} className="py-0.5 text-xs text-stone-400">GST ({Math.round((invoice.tax_rate ?? 0.1) * 100)}%)</td>
                      <td className="text-right text-sm text-stone-600">{fmt(invoice.tax_amount, currency)}</td>
                    </tr>
                    <tr>
                      <td colSpan={readOnly ? 3 : 4} className="py-1 text-sm font-semibold text-stone-900">Total</td>
                      <td className="text-right text-sm font-semibold text-stone-900">{fmt(invoice.total, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-stone-400 mb-4">No line items yet.</p>
            )}

            {!readOnly && (
              <div className="flex gap-2">
                <button onClick={() => { setFormError(null); setShowAddManual(true); }} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Manual Item
                </button>
                {inventory.length > 0 && (
                  <button onClick={() => { setFormError(null); setShowAddStock(true); }} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    Add Stock Item
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 5. Quote/Invoice card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Quote / Invoice</h2>
            {invoice ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{invoice.invoice_number}</p>
                  <p className="text-xs text-stone-400 mt-0.5 capitalize">{invoice.status}</p>
                </div>
                <Link href={`/invoices/${invoice.id}`} className="text-xs font-medium text-[#B45309] hover:underline border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg">
                  View Invoice →
                </Link>
              </div>
            ) : !readOnly ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-stone-400 flex-1">No invoice generated yet.</p>
                <button onClick={handleGenerateInvoice} disabled={isPending} className="text-xs font-medium bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50">
                  Generate Invoice
                </button>
              </div>
            ) : (
              <p className="text-sm text-stone-400">No invoice generated.</p>
            )}
          </div>
        </div>

        {/* ── RIGHT STICKY SIDEBAR ──────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 space-y-4">
          {/* Financial Summary */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Financial Summary</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Quoted</span>
                <span className="text-stone-700">{fmt(job.quoted_price, currency)}</span>
              </div>
              {invoice && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Subtotal</span>
                    <span className="text-stone-700">{fmt(invoice.subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">GST</span>
                    <span className="text-stone-700">{fmt(invoice.tax_amount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2">
                    <span className="text-stone-900">Total</span>
                    <span className="text-stone-900">{fmt(invoice.total, currency)}</span>
                  </div>
                </>
              )}
              {job.deposit_amount != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Deposit {job.deposit_paid ? "(paid)" : "(pending)"}</span>
                  <span className={job.deposit_paid ? "text-stone-700" : "text-stone-400"}>{fmt(job.deposit_amount, currency)}</span>
                </div>
              )}
              {invoice && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Total Paid</span>
                  <span className="text-stone-700">{fmt(invoice.amount_paid, currency)}</span>
                </div>
              )}
              {balanceDue > 0 ? (
                <div className="flex justify-between text-sm font-bold border-t border-amber-200 pt-2 mt-2">
                  <span className="text-amber-700">Balance Due</span>
                  <span className="text-amber-700">{fmt(balanceDue, currency)}</span>
                </div>
              ) : invoice && invoice.amount_paid > 0 ? (
                <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2">
                  <span className="text-[#B45309]">✓ Fully Paid</span>
                  <span className="text-[#B45309]">{fmt(invoice.amount_paid, currency)}</span>
                </div>
              ) : null}
            </div>

            {invoice && invoice.payments.length > 0 && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Payment History</p>
                <div className="space-y-2">
                  {invoice.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-stone-700 font-medium capitalize">{p.payment_method.replace(/_/g, " ")}</span>
                        {p.payment_date && <span className="text-stone-400 ml-1.5">{new Date(p.payment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                        {p.notes && <span className="text-stone-400 block">{p.notes}</span>}
                      </div>
                      <span className="font-semibold text-stone-800">{fmt(p.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {!readOnly && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Quick Actions</h2>
              <div className="space-y-2">
                {job.deposit_amount && !job.deposit_paid && (
                  <button onClick={() => openPaymentModal(job.deposit_amount ?? undefined)} className="w-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2.5 rounded-lg hover:bg-amber-100 transition-colors text-left">
                    💰 Take Deposit ({fmt(job.deposit_amount, currency)})
                  </button>
                )}
                <button onClick={() => openPaymentModal()} className="w-full text-sm font-medium bg-stone-50 text-stone-700 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-100 transition-colors text-left">
                  📥 Record Payment
                </button>
                {balanceDue > 0 && invoice && (
                  <button onClick={handleMarkFullyPaid} disabled={isPending} className="w-full text-sm font-medium bg-stone-900 text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition-colors text-left disabled:opacity-50">
                    ✓ Mark Fully Paid ({fmt(balanceDue, currency)})
                  </button>
                )}
                {invoice ? (
                  <Link href={`/invoices/${invoice.id}`} className="block w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors">
                    📄 View Invoice
                  </Link>
                ) : (
                  <button onClick={handleGenerateInvoice} disabled={isPending} className="w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-left disabled:opacity-50">
                    📄 Generate Invoice
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Documents</h2>
            <div className="space-y-2">
              <button onClick={() => window.open(`/print/bespoke/${job.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                🖨️ Print Job Sheet
              </button>
              {invoice?.id ? (
                <>
                  <button onClick={() => window.open(`/print/invoice/${invoice.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                    🖨️ Print Invoice
                  </button>
                  <button onClick={() => handleEmailInvoice()} disabled={emailSending} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 disabled:opacity-50 transition-colors">
                    ✉️ {emailSending ? "Sending..." : "Email Invoice"}
                  </button>
                </>
              ) : (
                <button onClick={() => handleGenerateInvoice()} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center gap-2 transition-colors">
                  📄 Generate Invoice
                </button>
              )}
              {customer?.email ? (
                <a href={`mailto:${customer.email}?subject=Re: Your bespoke order — Marcus & Co.`} className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                  ✉️ Email Customer
                </a>
              ) : (
                <div className="text-sm text-stone-400 px-3 py-2">No email on file</div>
              )}
              <div className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-100 text-stone-300 flex items-center gap-2 cursor-not-allowed" title="WhatsApp not connected — configure in Settings">
                💬 WhatsApp (not connected)
              </div>
            </div>
          </div>

          {/* Workflow Actions */}
          {!readOnly && !isTerminal && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Workflow Actions</h2>
              <div className="space-y-2">
                {job.stage !== "ready" && (
                  <button onClick={() => handleStageChange("ready")} disabled={isPending} className="w-full text-sm font-medium bg-[#B45309] text-white px-4 py-2.5 rounded-lg hover:bg-[#8B7355] transition-colors text-left disabled:opacity-50">
                    ✓ Mark Ready for Collection
                  </button>
                )}
                {job.stage === "ready" && (
                  <button onClick={() => handleStageChange("delivered")} disabled={isPending} className="w-full text-sm font-medium bg-stone-900 text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition-colors text-left disabled:opacity-50">
                    ✓ Mark Delivered
                  </button>
                )}
                {job.stage !== "in_progress" && job.stage !== "ready" && job.stage !== "delivered" && (
                  <button onClick={() => handleStageChange("in_progress")} disabled={isPending} className="w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-left disabled:opacity-50">
                    🔧 Mark In Progress
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────── */}

      {/* Add Manual Line Item */}
      {showAddManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddManual(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg text-stone-900 mb-4">Add Manual Line Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Description *</label>
                <input value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Custom platinum band" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Quantity</label>
                  <input type="number" value={manualQty} onChange={e => setManualQty(e.target.value)} min="1" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Unit Price ({currency})</label>
                  <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="0.00" step="0.01" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309]" />
                </div>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddManual(false)} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handleAddManual} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">{isPending ? "Adding…" : "Add Item"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Item */}
      {showAddStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddStock(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg text-stone-900 mb-4">Add Stock Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Select Item</label>
                <select value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309]">
                  <option value="">— Select inventory item —</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.sku}) — {fmt(item.retail_price, currency)}</option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddStock(false)} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handleAddStock} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">{isPending ? "Adding…" : "Add Item"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPayment(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg text-stone-900 mb-4">Record Payment</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Amount ({currency}) *</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" step="0.01" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309]">
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{m.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Notes (optional)</label>
                <input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. 50% deposit" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309]" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPayment(false)} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handlePayment} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">{isPending ? "Recording…" : "Record Payment"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Modal */}
      {showStageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStageModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-lg text-stone-900 mb-2">Advance Stage</h3>
            <p className="text-sm text-stone-500 mb-5">Move to <span className="font-semibold text-stone-900">{BESPOKE_STAGES.find(s => s.key === targetStage)?.label ?? targetStage}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowStageModal(false)} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={confirmStageChange} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">{isPending ? "Updating…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
