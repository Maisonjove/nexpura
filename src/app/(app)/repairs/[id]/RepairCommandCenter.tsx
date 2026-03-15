"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import JobPhotoUpload from "./JobPhotoUpload";
import {
  addRepairLineItem,
  removeRepairLineItem,
  recordRepairPayment,
  generateRepairInvoice,
  updateRepairStage,
  emailRepairInvoice,
  emailJobReady,
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

interface Repair {
  id: string;
  repair_number: string;
  item_type: string;
  item_description: string;
  repair_type: string;
  work_description: string | null;
  intake_notes: string | null;
  internal_notes: string | null;
  workshop_notes: string | null;
  stage: string;
  priority: string;
  quoted_price: number | null;
  final_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  due_date: string | null;
  invoice_id: string | null;
}

interface Props {
  repair: Repair;
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

const REPAIR_STAGES = [
  { key: "intake", label: "Intake" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
];

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  intake: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  assessed: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  quoted: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
  approved: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  ready: { bg: "bg-stone-200", text: "text-stone-900", dot: "bg-[#8B7355]" },
  collected: { bg: "bg-stone-900", text: "text-white", dot: "bg-white" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-stone-400",
  normal: "text-[#8B7355]",
  high: "text-amber-600",
  urgent: "text-red-600",
};

const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "cheque", "store_credit"];

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

function statusChip(invoice: Invoice | null, repair: Repair, currency: string) {
  if (!invoice) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
        Unpaid
      </span>
    );
  }
  if (invoice.amount_paid >= invoice.total && invoice.total > 0) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-900 text-white">
        Fully Paid
      </span>
    );
  }
  if (repair.deposit_paid && invoice.amount_paid > 0 && invoice.amount_paid < invoice.total) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
        Partially Paid ({fmt(invoice.amount_paid, currency)})
      </span>
    );
  }
  if (repair.deposit_paid && invoice.amount_paid === 0) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
        Deposit Paid
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
      Unpaid
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RepairCommandCenter({ repair, customer, invoice, inventory, tenantId, currency, readOnly = false, attachments = [], events = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localAttachments, setLocalAttachments] = useState(attachments);

  // Modal states
  const [showAddManual, setShowAddManual] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentPrefill, setPaymentPrefill] = useState<number | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [targetStage, setTargetStage] = useState<string>("");
  const [showNotes, setShowNotes] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);

  // Form state
  const [manualDesc, setManualDesc] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualPrice, setManualPrice] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isTerminal = ["collected", "cancelled"].includes(repair.stage);
  const currentStageIndex = REPAIR_STAGES.findIndex(s => s.key === repair.stage);
  const sc = STAGE_COLORS[repair.stage] ?? STAGE_COLORS.intake;

  const isOverdue = repair.due_date && new Date(repair.due_date) < new Date(new Date().toDateString()) && !isTerminal;

  const balanceDue = invoice
    ? Math.max(0, invoice.total - invoice.amount_paid)
    : (repair.quoted_price ?? 0) - (repair.deposit_paid ? (repair.deposit_amount ?? 0) : 0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function refresh() {
    router.refresh();
  }

  async function handleAddManual() {
    setFormError(null);
    const qty = parseInt(manualQty) || 1;
    const price = parseFloat(manualPrice) || 0;
    if (!manualDesc.trim()) { setFormError("Description is required"); return; }
    startTransition(async () => {
      const result = await addRepairLineItem(repair.id, tenantId, { description: manualDesc, qty, unitPrice: price });
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
      const result = await addRepairLineItem(repair.id, tenantId, {
        description: item.name,
        qty: 1,
        unitPrice: item.retail_price ?? 0,
        inventoryId: item.id,
      });
      if (result.error) { setFormError(result.error); return; }
      setShowAddStock(false);
      setSelectedInventoryId("");
      refresh();
    });
  }

  async function handleRemoveLineItem(id: string) {
    startTransition(async () => {
      const result = await removeRepairLineItem(id, repair.id, tenantId);
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
      const result = await recordRepairPayment(repair.id, invoice.id, tenantId, amount, paymentMethod, paymentNotes);
      if (result.error) { setFormError(result.error); return; }
      setShowPayment(false);
      setPaymentAmount(""); setPaymentNotes(""); setPaymentPrefill(null);
      refresh();
    });
  }

  async function handleMarkFullyPaid() {
    if (!invoice) { showToast("No invoice — add a line item first"); return; }
    const remaining = invoice.total - invoice.amount_paid;
    if (remaining <= 0) { showToast("Invoice is already fully paid"); return; }
    startTransition(async () => {
      const result = await recordRepairPayment(repair.id, invoice.id, tenantId, remaining, "card", "Marked fully paid");
      if (result.error) showToast(`Error: ${result.error}`);
      else { showToast("✓ Marked as fully paid"); refresh(); }
    });
  }

  async function handleGenerateInvoice() {
    startTransition(async () => {
      const result = await generateRepairInvoice(repair.id, tenantId);
      if (result.error) showToast(`Error: ${result.error}`);
      else { showToast("✓ Invoice generated"); refresh(); }
    });
  }

  async function handleStageChange(stage: string) {
    setTargetStage(stage);
    setShowStageModal(true);
  }

  async function confirmStageChange() {
    startTransition(async () => {
      const result = await updateRepairStage(repair.id, tenantId, targetStage);
      if (result.error) showToast(`Error: ${result.error}`);
      else { setShowStageModal(false); showToast(`✓ Stage updated to ${targetStage}`); refresh(); }
    });
  }

  function openPaymentModal(prefill?: number) {
    setPaymentPrefill(prefill ?? null);
    setPaymentAmount(prefill ? String(prefill) : "");
    setPaymentMethod("card");
    setPaymentNotes("");
    setFormError(null);
    setShowPayment(true);
  }

  async function handleEmailInvoice() {
    if (!invoice) return;
    setEmailSending(true);
    const result = await emailRepairInvoice(repair.id, invoice.id);
    setEmailSending(false);
    if (result.error) showToast(`Error: ${result.error}`);
    else if (result.note === "demo_limited") {
      showToast("Email logged (demo mode — configure a verified sending domain in Settings for external delivery)");
      refresh();
    } else { showToast("✓ Invoice emailed to customer"); refresh(); }
  }

  async function handleEmailReady() {
    setEmailSending(true);
    const result = await emailJobReady("repair", repair.id);
    setEmailSending(false);
    if (result.error) showToast(`Error: ${result.error}`);
    else { showToast("✓ Ready for collection email sent"); refresh(); }
  }

  function formatDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

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
        <Link href="/repairs" className="text-sm text-stone-400 hover:text-stone-700 transition-colors">← Repairs</Link>
      </div>

      {/* ── TOP STATUS STRIP ───────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-base font-semibold text-stone-900">{repair.repair_number}</span>
          <span className="text-stone-300">·</span>
          <span className="text-sm text-stone-700 font-medium">{customer?.full_name ?? "—"}</span>
          <span className="text-stone-300">·</span>
          <span className="text-sm text-stone-500 truncate max-w-xs">{repair.item_description || repair.item_type}</span>
          <span className="text-stone-300">·</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {REPAIR_STAGES.find(s => s.key === repair.stage)?.label ?? repair.stage}
          </span>
          {statusChip(invoice, repair, currency)}
          {repair.due_date && (
            <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : "text-stone-500"}`}>
              {isOverdue ? "⚠ Overdue · " : "Due: "}
              {new Date(repair.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {!readOnly && (
            <Link href={`/repairs/${repair.id}/edit`} className="ml-auto text-xs text-stone-400 hover:text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg transition-colors">
              Edit
            </Link>
          )}
        </div>

        {/* Alert banners */}
        <div className="mt-3 flex flex-wrap gap-2">
          {isOverdue && (
            <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full font-medium">⚠ Overdue</span>
          )}
          {!customer?.email && !customer?.mobile && (
            <span className="text-xs bg-stone-50 text-stone-600 border border-stone-200 px-3 py-1 rounded-full">📵 No contact info</span>
          )}
          {!invoice && !isTerminal && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full">📄 No invoice yet</span>
          )}
          {repair.stage === "ready" && (
            <span className="text-xs bg-stone-100 text-stone-800 border border-stone-300 px-3 py-1 rounded-full font-semibold">✅ Ready for pickup</span>
          )}
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
                <Link href={`/customers/${customer.id}`} className="text-xs text-[#B45309] hover:underline font-medium shrink-0">
                  View Customer →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-stone-400">No customer linked</p>
            )}
          </div>

          {/* 2. Item & Repair card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Item &amp; Repair</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full capitalize">
                  {repair.item_type}
                </span>
                <p className="text-sm font-medium text-stone-900">{repair.item_description}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Repair Type</p>
                <p className="text-sm text-stone-700">{repair.repair_type}</p>
              </div>
              {repair.work_description && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Work Description</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{repair.work_description}</p>
                </div>
              )}
              {(repair.intake_notes || repair.internal_notes || repair.workshop_notes) && (
                <div>
                  <button onClick={() => setShowNotes(!showNotes)} className="text-xs text-[#B45309] hover:underline font-medium">
                    {showNotes ? "Hide notes ↑" : "Show notes ↓"}
                  </button>
                  {showNotes && (
                    <div className="mt-2 space-y-2">
                      {repair.intake_notes && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3"><span className="font-semibold">Intake:</span> {repair.intake_notes}</p>}
                      {repair.internal_notes && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3"><span className="font-semibold">Internal:</span> {repair.internal_notes}</p>}
                      {repair.workshop_notes && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3"><span className="font-semibold">Workshop:</span> {repair.workshop_notes}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Stage timeline */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Stage Timeline</h2>
            <div className="relative">
              <div className="absolute left-3.5 top-4 bottom-4 w-0.5 bg-stone-100" />
              <div className="space-y-1">
                {REPAIR_STAGES.map((s, idx) => {
                  const isPast = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  const isClickable = !readOnly && !isTerminal && idx > currentStageIndex;
                  return (
                    <div
                      key={s.key}
                      className={`flex items-center gap-3 px-2 py-2.5 rounded-lg relative transition-colors ${
                        isClickable ? "cursor-pointer hover:bg-stone-50" : ""
                      } ${isCurrent ? "bg-stone-50" : ""}`}
                      onClick={isClickable ? () => handleStageChange(s.key) : undefined}
                    >
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 z-10 flex items-center justify-center ${
                        isPast ? "bg-[#B45309]" : isCurrent ? "bg-stone-900 ring-4 ring-stone-200" : "bg-white border-2 border-stone-200"
                      }`}>
                        {isPast && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isCurrent && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className={`text-sm ${isPast ? "text-stone-400 line-through" : isCurrent ? "text-stone-900 font-semibold" : "text-stone-500"}`}>
                        {s.label}
                      </span>
                      {isCurrent && <span className="ml-auto text-xs bg-stone-900 text-white px-2 py-0.5 rounded-full">Current</span>}
                      {isClickable && <span className="ml-auto text-xs text-stone-300 group-hover:text-stone-500">→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Photos & Attachments */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Photos &amp; Attachments</h2>
            {localAttachments.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {localAttachments.map(a => (
                  <div key={a.id} className="group relative">
                    <img
                      src={a.file_url}
                      alt={a.caption ?? a.file_name}
                      className="w-full aspect-square object-cover rounded-lg cursor-pointer"
                      onClick={() => window.open(a.file_url, "_blank")}
                    />
                    {a.caption && <p className="text-xs text-stone-500 mt-1 truncate">{a.caption}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400 mb-3">No photos yet</p>
            )}
            {!readOnly && (
              <JobPhotoUpload
                jobType="repair"
                jobId={repair.id}
                tenantId={tenantId}
                onUploaded={(att) => setLocalAttachments(prev => [...prev, att])}
              />
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
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  invoice.status === "paid" ? "bg-stone-900 text-white" :
                  invoice.status === "partial" ? "bg-amber-100 text-amber-800" :
                  "bg-stone-100 text-stone-600"
                }`}>{invoice.status}</span>
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
                            <button onClick={() => handleRemoveLineItem(li.id)} className="text-stone-300 hover:text-red-500 transition-colors" title="Remove">
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
                <button
                  onClick={() => { setFormError(null); setShowAddManual(true); }}
                  className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Manual Item
                </button>
                {inventory.length > 0 && (
                  <button
                    onClick={() => { setFormError(null); setShowAddStock(true); }}
                    className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Add Stock Item
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 5. Linked invoice card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Invoice</h2>
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
                <span className="text-stone-700">{fmt(repair.quoted_price, currency)}</span>
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
              {repair.deposit_amount != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Deposit {repair.deposit_paid ? "(paid)" : "(pending)"}</span>
                  <span className={repair.deposit_paid ? "text-stone-700" : "text-stone-400"}>{fmt(repair.deposit_amount, currency)}</span>
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

            {/* Payment history */}
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
                {repair.deposit_amount && !repair.deposit_paid && (
                  <button
                    onClick={() => openPaymentModal(repair.deposit_amount ?? undefined)}
                    className="w-full text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2.5 rounded-lg hover:bg-amber-100 transition-colors text-left"
                  >
                    💰 Take Deposit ({fmt(repair.deposit_amount, currency)})
                  </button>
                )}
                <button
                  onClick={() => openPaymentModal()}
                  className="w-full text-sm font-medium bg-stone-50 text-stone-700 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-100 transition-colors text-left"
                >
                  📥 Record Payment
                </button>
                {balanceDue > 0 && invoice && (
                  <button
                    onClick={handleMarkFullyPaid}
                    disabled={isPending}
                    className="w-full text-sm font-medium bg-stone-900 text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition-colors text-left disabled:opacity-50"
                  >
                    ✓ Mark Fully Paid ({fmt(balanceDue, currency)})
                  </button>
                )}
                {invoice ? (
                  <Link href={`/invoices/${invoice.id}`} className="block w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors">
                    📄 View Invoice
                  </Link>
                ) : (
                  <button
                    onClick={handleGenerateInvoice}
                    disabled={isPending}
                    className="w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-left disabled:opacity-50"
                  >
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
              <button onClick={() => window.open(`/print/repair/${repair.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                🖨️ Print Repair Ticket
              </button>
              <button onClick={() => window.open(`/print/receipt/repair/${repair.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                🧾 Print Receipt
              </button>
              {invoice?.id ? (
                <>
                  <button onClick={() => window.open(`/print/invoice/${invoice.id}`, "_blank")} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                    🖨️ Print Invoice
                  </button>
                  <button onClick={() => handleEmailInvoice()} disabled={emailSending} title="Sends invoice via email. In demo mode, external delivery requires a verified sending domain." className="w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 disabled:opacity-50 transition-colors">
                    ✉️ {emailSending ? "Sending..." : "Email Invoice"}
                  </button>
                </>
              ) : (
                <button onClick={() => handleGenerateInvoice()} className="w-full text-left text-sm px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 flex items-center gap-2 transition-colors">
                  📄 Generate Invoice
                </button>
              )}
              {customer?.email ? (
                <a href={`mailto:${customer.email}?subject=Re: Your repair — Marcus & Co.`} className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 flex items-center gap-2 transition-colors">
                  ✉️ Email Customer
                </a>
              ) : (
                <div className="text-sm text-stone-400 px-3 py-2">No email on file</div>
              )}
              {repair.stage === "ready" && customer?.email && (
                <button onClick={() => handleEmailReady()} disabled={emailSending} className="w-full text-left text-sm px-3 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 flex items-center gap-2 transition-colors disabled:opacity-50">
                  ✉️ Email Ready for Collection
                </button>
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
                {repair.stage !== "ready" && (
                  <button
                    onClick={() => handleStageChange("ready")}
                    disabled={isPending}
                    className="w-full text-sm font-medium bg-[#B45309] text-white px-4 py-2.5 rounded-lg hover:bg-[#8B7355] transition-colors text-left disabled:opacity-50"
                  >
                    ✓ Mark Ready for Pickup
                  </button>
                )}
                {repair.stage === "ready" && (
                  <button
                    onClick={() => handleStageChange("collected")}
                    disabled={isPending}
                    className="w-full text-sm font-medium bg-stone-900 text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition-colors text-left disabled:opacity-50"
                  >
                    ✓ Mark Collected
                  </button>
                )}
                {repair.stage !== "in_progress" && repair.stage !== "ready" && (
                  <button
                    onClick={() => handleStageChange("in_progress")}
                    disabled={isPending}
                    className="w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-left disabled:opacity-50"
                  >
                    🔧 Mark In Progress
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────── */}

      {/* Add Manual Line Item Modal */}
      {showAddManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddManual(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-lg text-stone-900 mb-4">Add Manual Line Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Description *</label>
                <input value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="e.g. Ring resizing labour" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]" />
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
              <button onClick={handleAddManual} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">
                {isPending ? "Adding…" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Item Modal */}
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
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku}) — {fmt(item.retail_price, currency)}
                    </option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddStock(false)} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handleAddStock} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">
                {isPending ? "Adding…" : "Add Item"}
              </button>
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
                <input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. Deposit received" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#B45309]" />
              </div>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPayment(false)} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handlePayment} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">
                {isPending ? "Recording…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Change Confirmation Modal */}
      {showStageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStageModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-lg text-stone-900 mb-2">Advance Stage</h3>
            <p className="text-sm text-stone-500 mb-5">
              Move to <span className="font-semibold text-stone-900">{REPAIR_STAGES.find(s => s.key === targetStage)?.label ?? targetStage}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowStageModal(false)} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={confirmStageChange} disabled={isPending} className="flex-1 bg-stone-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-stone-800 disabled:opacity-50">
                {isPending ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
