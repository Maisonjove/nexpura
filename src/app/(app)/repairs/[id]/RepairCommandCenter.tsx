"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import JobReadySMSModal from "@/components/JobReadySMSModal";
import {
  addRepairLineItem,
  removeRepairLineItem,
  recordRepairPayment,
  generateRepairInvoice,
  updateRepairStage,
  emailRepairInvoice,
  emailJobReady,
  sendJobReadySms,
} from "./actions";
import {
  StatusStrip,
  TrackingLinkActions,
  CustomerCard,
  ItemRepairCard,
  StageTimeline,
  PhotosCard,
  ActivityTimeline,
  JobOverviewCard,
  FinancialSnapshotCard,
  WorkflowChecklist,
  AlertsCard,
  SidebarQuickActions,
  AddManualItemModal,
  AddStockItemModal,
  RecordPaymentModal,
  StageChangeModal,
  REPAIR_STAGES,
} from "./components";
import type {
  Customer,
  Invoice,
  InventoryItem,
  JobAttachment,
  JobEvent,
  Repair,
  LineItem,
  Payment,
} from "./components/types";

import OrderMessagesPanel from "@/components/orders/OrderMessagesPanel";
import type { OrderMessage } from "@/lib/messaging";

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
  twilioConnected?: boolean;
  businessName?: string;
  defaultSmsTemplate?: string;
  storeSubdomain?: string | null;
  messages?: OrderMessage[];
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function RepairCommandCenter({
  repair,
  customer,
  invoice,
  inventory,
  tenantId,
  currency,
  readOnly = false,
  attachments = [],
  events = [],
  twilioConnected = false,
  businessName = "",
  defaultSmsTemplate = "",
  storeSubdomain = null,
  messages = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localAttachments, setLocalAttachments] = useState(attachments);
  const [localEvents, setLocalEvents] = useState(events);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Modal states
  const [showAddManual, setShowAddManual] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [targetStage, setTargetStage] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [showReadySmsModal, setShowReadySmsModal] = useState(false);

  // Form state
  const [manualDesc, setManualDesc] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualPrice, setManualPrice] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Internal notes editable state
  const [internalNotesValue, setInternalNotesValue] = useState(repair.internal_notes || "");

  // Collapsible workshop notes
  const [showWorkshopNotes, setShowWorkshopNotes] = useState(false);

  // Escape key closes any open modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowAddManual(false);
        setShowAddStock(false);
        setShowPayment(false);
        setShowStageModal(false);
        setFormError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isTerminal = ["collected", "cancelled"].includes(repair.stage);
  const currentStageIndex = REPAIR_STAGES.findIndex((s) => s.key === repair.stage);
  const currentStageLabel = REPAIR_STAGES.find((s) => s.key === repair.stage)?.label ?? repair.stage;
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

  async function logJobEvent(jobType: string, jobId: string, tId: string, eventType: string, description: string) {
    const res = await fetch("/api/job-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: tId, jobType, jobId, eventType, description }),
    });
    if (res.ok) {
      setLocalEvents((prev) => [
        {
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          event_type: eventType,
          description,
          actor: "demo@nexpura.com",
        },
        ...prev,
      ]);
    }
  }

  async function handleDeletePhoto(a: JobAttachment) {
    if (!confirm(`Remove "${a.caption ?? a.file_name}"?`)) return;
    setDeletingPhotoId(a.id);
    try {
      const res = await fetch("/api/job-attachment/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId: a.id, tenantId, fileUrl: a.file_url }),
      });
      if (res.ok) {
        setLocalAttachments((prev) => prev.filter((x) => x.id !== a.id));
        await logJobEvent("repair", repair.id, tenantId, "photo_removed", `Photo removed: ${a.caption ?? a.file_name}`);
      }
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function handleAddManual() {
    setFormError(null);
    const qty = parseInt(manualQty) || 1;
    const price = parseFloat(manualPrice) || 0;
    const desc = manualDesc.trim();
    if (!desc) {
      setFormError("Description is required");
      return;
    }
    setShowAddManual(false);
    setManualDesc("");
    setManualQty("1");
    setManualPrice("");
    startTransition(async () => {
      const result = await addRepairLineItem(repair.id, tenantId, { description: desc, qty, unitPrice: price });
      if (result.error) {
        showToast(`Error: ${result.error}`);
        return;
      }
      refresh();
    });
  }

  async function handleAddStock() {
    setFormError(null);
    if (!selectedInventoryId) {
      setFormError("Select an item");
      return;
    }
    const item = inventory.find((i) => i.id === selectedInventoryId);
    if (!item) return;
    setShowAddStock(false);
    setSelectedInventoryId("");
    startTransition(async () => {
      const result = await addRepairLineItem(repair.id, tenantId, {
        description: item.name,
        qty: 1,
        unitPrice: item.retail_price ?? 0,
        inventoryId: item.id,
      });
      if (result.error) {
        showToast(`Error: ${result.error}`);
        return;
      }
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
    if (!amount || amount <= 0) {
      setFormError("Enter a valid amount");
      return;
    }
    if (!invoice) {
      setFormError("No invoice linked. Add a line item first.");
      return;
    }
    const method = paymentMethod;
    const notes = paymentNotes;
    setShowPayment(false);
    setPaymentAmount("");
    setPaymentNotes("");
    startTransition(async () => {
      const result = await recordRepairPayment(repair.id, invoice.id, tenantId, amount, method, notes);
      if (result.error) {
        showToast(`Error: ${result.error}`);
        return;
      }
      refresh();
    });
  }

  async function handleMarkFullyPaid() {
    if (!invoice) {
      showToast("No invoice — add a line item first");
      return;
    }
    const remaining = invoice.total - invoice.amount_paid;
    if (remaining <= 0) {
      showToast("Invoice is already fully paid");
      return;
    }
    startTransition(async () => {
      const result = await recordRepairPayment(repair.id, invoice.id, tenantId, remaining, "card", "Marked fully paid");
      if (result.error) showToast(`Error: ${result.error}`);
      else {
        showToast("✓ Marked as fully paid");
        refresh();
      }
    });
  }

  async function handleGenerateInvoice() {
    startTransition(async () => {
      const result = await generateRepairInvoice(repair.id, tenantId);
      if (result.error) showToast(`Error: ${result.error}`);
      else {
        showToast("✓ Invoice generated");
        refresh();
      }
    });
  }

  function handleStageChange(stage: string) {
    if (stage === "ready") {
      setShowReadySmsModal(true);
      return;
    }
    setTargetStage(stage);
    setShowStageModal(true);
  }

  async function handleMarkReadyWithSms(sendSms: boolean, message: string) {
    setShowReadySmsModal(false);
    startTransition(async () => {
      const stageResult = await updateRepairStage(repair.id, tenantId, "ready");
      if (stageResult.error) {
        showToast(`Error: ${stageResult.error}`);
        return;
      }
      if (sendSms && customer?.mobile) {
        const smsResult = await sendJobReadySms({
          repairId: repair.id,
          customerId: customer.id,
          customerName: customer.full_name,
          customerPhone: customer.mobile,
          jobType: repair.item_description || repair.item_type,
          message,
        });
        if (smsResult.error) {
          showToast(`Stage updated, but SMS failed: ${smsResult.error}`);
        } else {
          showToast("✓ Marked ready & SMS sent");
        }
      } else {
        showToast("✓ Stage updated to Ready");
      }
      refresh();
    });
  }

  async function confirmStageChange() {
    const stage = targetStage;
    setShowStageModal(false);
    startTransition(async () => {
      const result = await updateRepairStage(repair.id, tenantId, stage);
      if (result.error) showToast(`Error: ${result.error}`);
      else {
        showToast(`✓ Stage updated to ${stage}`);
        refresh();
      }
    });
  }

  function openPaymentModal(prefill?: number) {
    setPaymentAmount(prefill ? String(prefill) : "");
    setPaymentMethod("card");
    setPaymentNotes("");
    setFormError(null);
    setShowPayment(true);
  }

  async function handleEmailInvoice() {
    if (!invoice) return;
    setEmailSending(true);
    setEmailSuccess(null);
    setEmailError(null);
    const result = await emailRepairInvoice(repair.id, invoice.id);
    setEmailSending(false);
    if (result.error) {
      setEmailError(result.error);
    } else {
      const msg = result.message ?? (result.note === "sent" ? "Email sent ✓" : "Email queued — delivery requires a verified sending domain.");
      setEmailSuccess(msg);
      setTimeout(() => setEmailSuccess(null), 4000);
      await logJobEvent("repair", repair.id, tenantId, "email_sent", result.message ?? "Invoice email attempted");
      refresh();
    }
  }

  async function handleEmailReady() {
    setEmailSending(true);
    const result = await emailJobReady("repair", repair.id);
    setEmailSending(false);
    if (result.error) showToast(`Error: ${result.error}`);
    else {
      showToast("✓ Ready for collection email sent");
      await logJobEvent("repair", repair.id, tenantId, "email_sent", `Ready-for-collection email to ${customer?.email ?? "customer"} — sent`);
      refresh();
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="py-4 flex items-center justify-between">
        <Link href="/repairs" className="text-sm text-stone-400 hover:text-stone-700 transition-colors">
          ← Repairs
        </Link>
        {repair.tracking_id && (
          <TrackingLinkActions trackingId={repair.tracking_id} onCopied={() => showToast("✓ Tracking link copied")} />
        )}
      </div>

      {/* Status Strip */}
      <StatusStrip repair={repair} customer={customer} invoice={invoice} currency={currency} readOnly={readOnly} tenantId={tenantId} />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5 items-start mt-4">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* 1. CustomerCard */}
          <CustomerCard customer={customer} />

          {/* 2. ItemRepairCard */}
          <ItemRepairCard repair={repair} />

          {/* 3. Work Required Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-[0.75rem] font-semibold text-stone-400 uppercase tracking-[0.15em] mb-3">Work Required</h2>
            
            {/* Work Description */}
            {repair.work_description ? (
              <p className="text-sm text-stone-700 leading-relaxed mb-4">{repair.work_description}</p>
            ) : (
              <p className="text-sm text-stone-400 mb-4">No work description provided</p>
            )}

            {/* Workshop Notes - Collapsible */}
            {repair.workshop_notes && (
              <div className="mb-4">
                <button 
                  onClick={() => setShowWorkshopNotes(!showWorkshopNotes)} 
                  className="text-xs text-amber-700 hover:underline font-medium"
                >
                  {showWorkshopNotes ? "Hide workshop notes ↑" : "Show workshop notes ↓"}
                </button>
                {showWorkshopNotes && (
                  <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3 mt-2">
                    <span className="font-semibold">Workshop:</span> {repair.workshop_notes}
                  </p>
                )}
              </div>
            )}

            {/* Internal Notes - Amber Box */}
            {repair.internal_notes && (
              <div className="mb-4">
                <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3">
                  <span className="font-semibold">Internal:</span> {repair.internal_notes}
                </p>
              </div>
            )}

            {/* Stage Timeline */}
            <StageTimeline
              currentStage={repair.stage}
              onStageChange={handleStageChange}
              readOnly={readOnly}
              isTerminal={isTerminal}
            />
          </div>

          {/* Customer ↔ Staff messages — sits right next to the stage workflow
              so amendment requests and questions are impossible to miss while
              the jeweller is moving the job through stages. */}
          {!readOnly && (
            <OrderMessagesPanel
              orderType="repair"
              orderId={repair.id}
              initialMessages={messages}
            />
          )}

          {/* 4. PhotosCard */}
          <PhotosCard
            attachments={localAttachments}
            readOnly={readOnly}
            repairId={repair.id}
            tenantId={tenantId}
            deletingPhotoId={deletingPhotoId}
            onDeletePhoto={handleDeletePhoto}
            onPhotoUploaded={(att) => {
              setLocalAttachments((prev) => [...prev, att]);
              logJobEvent("repair", repair.id, tenantId, "photo_uploaded", `Photo uploaded: ${att.caption ?? att.file_name}`);
            }}
          />

          {/* 5. Pricing & Payment Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-[0.75rem] font-semibold text-stone-400 uppercase tracking-[0.15em] mb-4">Pricing & Payment</h2>

            {/* Quote Strip - 3 columns */}
            <div className="grid grid-cols-3 gap-4 mb-5 pb-5 border-b border-stone-200">
              <div className="text-center">
                <p className="text-xs text-stone-500 mb-1">Quoted</p>
                <p className="text-lg font-semibold text-stone-900">{fmt(repair.quoted_price, currency)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-500 mb-1">Deposit</p>
                <p className={`text-lg font-semibold ${repair.deposit_paid ? "text-emerald-700" : "text-stone-400"}`}>
                  {fmt(repair.deposit_amount, currency)}
                  {repair.deposit_paid && <span className="text-xs ml-1">✓</span>}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-500 mb-1">Balance</p>
                <p className={`text-lg font-semibold ${balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {fmt(balanceDue, currency)}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            {invoice && invoice.lineItems.length > 0 ? (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.75rem] font-semibold text-stone-400 uppercase tracking-[0.15em]">Line Items</p>
                  {(() => {
                    const label = { draft: "Draft", unpaid: "Sent", partial: "Partial", paid: "Paid", voided: "Voided", overdue: "Overdue" }[invoice.status] || invoice.status;
                    const badgeClass = invoice.status === "paid" ? "nx-badge-success" : invoice.status === "partial" ? "nx-badge-warning" : invoice.status === "overdue" ? "nx-badge-danger" : "nx-badge-neutral";
                    return (
                      <span className={badgeClass}>
                        {label}
                      </span>
                    );
                  })()}
                </div>
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
                    {invoice.lineItems.map((li: LineItem) => (
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

            {/* Add Line Item Buttons */}
            {!readOnly && (
              <div className="flex gap-2 mb-5">
                <button onClick={() => { setFormError(null); setShowAddManual(true); }} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-md hover:bg-stone-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Manual Item
                </button>
                {inventory.length > 0 && (
                  <button onClick={() => { setFormError(null); setShowAddStock(true); }} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-md hover:bg-stone-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Add Stock Item
                  </button>
                )}
              </div>
            )}

            {/* Invoice Link / Generate */}
            <div className="border-t border-stone-200 pt-4 mb-4">
              {invoice ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{invoice.invoice_number}</p>
                    <p className="text-xs text-stone-400 mt-0.5 capitalize">{invoice.status}</p>
                  </div>
                  <Link href={`/invoices/${invoice.id}`} className="text-xs font-medium text-amber-700 hover:underline border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-md">
                    View Invoice →
                  </Link>
                </div>
              ) : !readOnly ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-stone-400 flex-1">No invoice generated yet.</p>
                  <button onClick={handleGenerateInvoice} disabled={isPending} className="nx-btn-primary cursor-pointer text-xs px-3 py-1.5 disabled:opacity-50">
                    Generate Invoice
                  </button>
                </div>
              ) : (
                <p className="text-sm text-stone-400">No invoice generated.</p>
              )}
            </div>

            {/* Payment History */}
            {invoice && invoice.payments.length > 0 && (
              <div className="border-t border-stone-200 pt-4">
                <p className="text-[0.75rem] font-semibold text-stone-400 uppercase tracking-[0.15em] mb-2">Payment History</p>
                <div className="space-y-2">
                  {invoice.payments.map((p: Payment) => (
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

          {/* 6. Notes Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-[0.75rem] font-semibold text-stone-400 uppercase tracking-[0.15em] mb-4">Notes & Activity</h2>

            {/* Internal Notes - Editable if not readOnly */}
            <div className="mb-4">
              <label className="text-xs font-medium text-stone-500 block mb-1.5">Internal Notes</label>
              {!readOnly ? (
                <textarea
                  value={internalNotesValue}
                  onChange={(e) => setInternalNotesValue(e.target.value)}
                  placeholder="Add internal notes..."
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 resize-none"
                  rows={3}
                />
              ) : (
                <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3">
                  {repair.internal_notes || <span className="text-stone-400">No internal notes</span>}
                </p>
              )}
            </div>

            {/* Intake Notes Display */}
            {repair.intake_notes && (
              <div className="mb-4 pb-4 border-b border-stone-200">
                <label className="text-xs font-medium text-stone-500 block mb-1.5">Intake Notes</label>
                <p className="text-sm text-stone-700 bg-stone-50 rounded-lg p-3">{repair.intake_notes}</p>
              </div>
            )}

            {/* Activity Timeline */}
            <ActivityTimeline events={localEvents} />
          </div>
        </div>

        {/* RIGHT SIDEBAR - sticky */}
        <div className="lg:sticky lg:top-24 space-y-4">
          {/* 1. JobOverviewCard */}
          <JobOverviewCard repair={repair} readOnly={readOnly} />

          {/* 2. FinancialSnapshotCard */}
          <FinancialSnapshotCard repair={repair} invoice={invoice} currency={currency} balanceDue={balanceDue} />

          {/* 3. WorkflowChecklist */}
          <WorkflowChecklist repair={repair} customer={customer} invoice={invoice} attachments={localAttachments} />

          {/* 4. AlertsCard - only renders if alerts */}
          <AlertsCard repair={repair} customer={customer} invoice={invoice} attachments={localAttachments} balanceDue={balanceDue} />

          {/* 5. SidebarQuickActions */}
          {!readOnly && (
            <SidebarQuickActions
              repair={repair}
              invoice={invoice}
              customer={customer}
              currency={currency}
              balanceDue={balanceDue}
              isPending={isPending}
              emailSending={emailSending}
              onOpenPaymentModal={openPaymentModal}
              onMarkFullyPaid={handleMarkFullyPaid}
              onGenerateInvoice={handleGenerateInvoice}
              onStageChange={handleStageChange}
              onEmailInvoice={handleEmailInvoice}
              onEmailReady={handleEmailReady}
            />
          )}
        </div>
      </div>

      {/* Sticky bottom bar - only if !readOnly */}
      {!readOnly && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-3 flex items-center justify-between z-40">
          <span className="text-xs text-stone-400">Stage: {currentStageLabel}</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="text-xs font-medium text-stone-600 border border-stone-200 px-3 py-1.5 rounded-md hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200">Print</button>
            <button onClick={handleEmailInvoice} className="text-xs font-medium text-stone-600 border border-stone-200 px-3 py-1.5 rounded-md hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200">Email</button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddManualItemModal
        show={showAddManual}
        onClose={() => setShowAddManual(false)}
        onSubmit={handleAddManual}
        isPending={isPending}
        formError={formError}
        manualDesc={manualDesc}
        setManualDesc={setManualDesc}
        manualQty={manualQty}
        setManualQty={setManualQty}
        manualPrice={manualPrice}
        setManualPrice={setManualPrice}
        currency={currency}
      />
      <AddStockItemModal
        show={showAddStock}
        onClose={() => setShowAddStock(false)}
        onSubmit={handleAddStock}
        isPending={isPending}
        formError={formError}
        selectedInventoryId={selectedInventoryId}
        setSelectedInventoryId={setSelectedInventoryId}
        inventory={inventory}
        currency={currency}
      />
      <RecordPaymentModal
        show={showPayment}
        onClose={() => setShowPayment(false)}
        onSubmit={handlePayment}
        isPending={isPending}
        formError={formError}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentNotes={paymentNotes}
        setPaymentNotes={setPaymentNotes}
        currency={currency}
      />
      <StageChangeModal
        show={showStageModal}
        targetStage={targetStage}
        onClose={() => setShowStageModal(false)}
        onConfirm={confirmStageChange}
        isPending={isPending}
      />
      <JobReadySMSModal
        isOpen={showReadySmsModal}
        onClose={() => setShowReadySmsModal(false)}
        onConfirm={handleMarkReadyWithSms}
        customerName={customer?.full_name || ""}
        customerPhone={customer?.mobile || null}
        jobType={repair.item_description || repair.item_type}
        businessName={businessName}
        defaultTemplate={defaultSmsTemplate || "Hi {{customer_name}}, great news! Your {{job_type}} is ready for pickup at {{business_name}}. See you soon!"}
        twilioConnected={twilioConnected}
      />
    </div>
  );
}
