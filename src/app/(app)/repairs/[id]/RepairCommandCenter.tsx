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
  CustomerCard,
  ItemRepairCard,
  StageTimeline,
  PhotosCard,
  ActivityTimeline,
  FinancialSummaryCard,
  QuickActionsCard,
  DocumentsCard,
  WorkflowActionsCard,
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
} from "./components/types";

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
    <div className="max-w-7xl mx-auto px-4 pb-16">
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
        {storeSubdomain && (
          <a
            href={`/${storeSubdomain}/track/${repair.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Customer Tracking Link
          </a>
        )}
      </div>

      {/* Status Strip */}
      <StatusStrip repair={repair} customer={customer} invoice={invoice} currency={currency} readOnly={readOnly} />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5 items-start">
        {/* Left Column */}
        <div className="space-y-5">
          <CustomerCard customer={customer} />
          <ItemRepairCard repair={repair} />
          <StageTimeline
            currentStage={repair.stage}
            onStageChange={handleStageChange}
            readOnly={readOnly}
            isTerminal={isTerminal}
          />
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
          <ActivityTimeline events={localEvents} />

          {/* Line Items Card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Line Items</h2>
              {invoice && (() => {
                const label = { draft: "Draft", unpaid: "Sent", partial: "Partial", paid: "Paid", voided: "Voided", overdue: "Overdue" }[invoice.status] || invoice.status;
                return (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${invoice.status === "paid" ? "bg-stone-900 text-white" : invoice.status === "partial" ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
                    {label}
                  </span>
                );
              })()}
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

            {!readOnly && (
              <div className="flex gap-2">
                <button onClick={() => { setFormError(null); setShowAddManual(true); }} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Manual Item
                </button>
                {inventory.length > 0 && (
                  <button onClick={() => { setFormError(null); setShowAddStock(true); }} className="flex items-center gap-1.5 text-xs font-medium text-stone-600 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Add Stock Item
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Linked Invoice Card */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Invoice</h2>
            {invoice ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{invoice.invoice_number}</p>
                  <p className="text-xs text-stone-400 mt-0.5 capitalize">{invoice.status}</p>
                </div>
                <Link href={`/invoices/${invoice.id}`} className="text-xs font-medium text-amber-700 hover:underline border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-lg">
                  View Invoice →
                </Link>
              </div>
            ) : !readOnly ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-stone-400 flex-1">No invoice generated yet.</p>
                <button onClick={handleGenerateInvoice} disabled={isPending} className="text-xs font-medium bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
                  Generate Invoice
                </button>
              </div>
            ) : (
              <p className="text-sm text-stone-400">No invoice generated.</p>
            )}
          </div>
        </div>

        {/* Right Sticky Sidebar */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <FinancialSummaryCard repair={repair} invoice={invoice} currency={currency} balanceDue={balanceDue} />
          {!readOnly && (
            <QuickActionsCard
              repair={repair}
              invoice={invoice}
              currency={currency}
              balanceDue={balanceDue}
              isPending={isPending}
              onOpenPaymentModal={openPaymentModal}
              onMarkFullyPaid={handleMarkFullyPaid}
              onGenerateInvoice={handleGenerateInvoice}
            />
          )}
          <DocumentsCard
            repair={repair}
            invoice={invoice}
            customer={customer}
            readOnly={readOnly}
            emailSending={emailSending}
            emailSuccess={emailSuccess}
            emailError={emailError}
            onEmailInvoice={handleEmailInvoice}
            onEmailReady={handleEmailReady}
            onGenerateInvoice={handleGenerateInvoice}
          />
          {!readOnly && !isTerminal && (
            <WorkflowActionsCard repair={repair} isPending={isPending} onStageChange={handleStageChange} />
          )}
        </div>
      </div>

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
