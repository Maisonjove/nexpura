"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addBespokeLineItem,
  removeBespokeLineItem,
  recordBespokePayment,
  generateBespokeInvoice,
  updateBespokeStage,
  emailBespokeInvoice,
} from "./actions";

import {
  StatusStrip,
  CustomerCard,
  JobBriefCard,
  StageTimeline,
  PhotosCard,
  ActivityTimeline,
  FinancialSummaryCard,
  QuickActionsCard,
  LineItemsCard,
  DocumentsCard,
  WorkflowActionsCard,
  QuoteInvoiceCard,
  MilestoneCard,
  ApprovalCard,
  AddManualItemModal,
  AddStockItemModal,
  RecordPaymentModal,
  StageChangeModal,
} from "./components";
import type { Milestone } from "./components/MilestoneCard";

import type { BespokeCommandCenterProps, JobAttachment, JobEvent } from "./components/types";

export default function BespokeCommandCenter({
  job,
  customer,
  invoice,
  inventory,
  tenantId,
  currency,
  readOnly = false,
  attachments = [],
  events = [],
}: BespokeCommandCenterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localAttachments, setLocalAttachments] = useState(attachments);
  const [localEvents, setLocalEvents] = useState(events);
  const [localMilestones, setLocalMilestones] = useState<Milestone[]>((job as BespokeCommandCenterProps['job'] & { milestones?: Milestone[] }).milestones ?? []);

  const [showAddManual, setShowAddManual] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [targetStage, setTargetStage] = useState("");
  const [paymentPrefill, setPaymentPrefill] = useState<number | undefined>();
  const [toast, setToast] = useState<string | null>(null);

  const isTerminal = ["delivered", "cancelled"].includes(job.stage);

  // Escape key closes any open modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowAddManual(false);
        setShowAddStock(false);
        setShowPayment(false);
        setShowStageModal(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
      setLocalEvents(prev => [
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
    const res = await fetch("/api/job-attachment/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: a.id, tenantId, fileUrl: a.file_url }),
    });
    if (res.ok) {
      setLocalAttachments(prev => prev.filter(x => x.id !== a.id));
      await logJobEvent("bespoke", job.id, tenantId, "photo_removed", `Photo removed: ${a.caption ?? a.file_name}`);
    }
  }

  function handlePhotoUploaded(att: JobAttachment) {
    setLocalAttachments(prev => [...prev, att]);
    logJobEvent("bespoke", job.id, tenantId, "photo_uploaded", `Photo uploaded: ${att.caption ?? att.file_name}`);
  }

  async function handleAddManual(data: { description: string; qty: number; unitPrice: number }) {
    setShowAddManual(false);
    startTransition(async () => {
      const result = await addBespokeLineItem(job.id, tenantId, {
        description: data.description,
        qty: data.qty,
        unitPrice: data.unitPrice,
      });
      if (result.error) {
        showToast(`Error: ${result.error}`);
        return;
      }
      refresh();
    });
  }

  async function handleAddStock(inventoryId: string) {
    const item = inventory.find(i => i.id === inventoryId);
    if (!item) return;
    setShowAddStock(false);
    startTransition(async () => {
      const result = await addBespokeLineItem(job.id, tenantId, {
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
      const result = await removeBespokeLineItem(id, job.id, tenantId);
      if (result.error) showToast(`Error: ${result.error}`);
      else refresh();
    });
  }

  async function handlePayment(data: { amount: number; method: string; notes: string }) {
    if (!invoice) return;
    setShowPayment(false);
    startTransition(async () => {
      const result = await recordBespokePayment(job.id, invoice.id, tenantId, data.amount, data.method, data.notes);
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
      const result = await recordBespokePayment(job.id, invoice.id, tenantId, remaining, "card", "Marked fully paid");
      if (result.error) showToast(`Error: ${result.error}`);
      else {
        showToast("✓ Marked as fully paid");
        refresh();
      }
    });
  }

  async function handleGenerateInvoice() {
    startTransition(async () => {
      const result = await generateBespokeInvoice(job.id, tenantId);
      if (result.error) showToast(`Error: ${result.error}`);
      else {
        showToast("✓ Invoice generated");
        refresh();
      }
    });
  }

  function handleStageChange(stage: string) {
    setTargetStage(stage);
    setShowStageModal(true);
  }

  async function confirmStageChange() {
    const stage = targetStage;
    setShowStageModal(false);
    startTransition(async () => {
      const result = await updateBespokeStage(job.id, tenantId, stage);
      if (result.error) showToast(`Error: ${result.error}`);
      else {
        showToast(`✓ Stage updated`);
        refresh();
      }
    });
  }

  function openPaymentModal(prefill?: number) {
    setPaymentPrefill(prefill);
    setShowPayment(true);
  }

  async function handleEmailInvoice(): Promise<{ error?: string; message?: string; note?: string }> {
    if (!invoice) return { error: "No invoice" };
    const result = await emailBespokeInvoice(job.id, invoice.id);
    if (!result.error) {
      await logJobEvent("bespoke", job.id, tenantId, "email_sent", result.message ?? "Invoice email attempted");
      refresh();
    }
    return result;
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
        <Link href="/bespoke" className="text-sm text-stone-400 hover:text-stone-700 transition-colors">← Bespoke Jobs</Link>
      </div>

      {/* Status Strip */}
      <StatusStrip
        job={job}
        customer={customer}
        invoice={invoice}
        currency={currency}
        readOnly={readOnly}
      />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-5 items-start">
        {/* Left Column */}
        <div className="space-y-5">
          <CustomerCard customer={customer} />
          <JobBriefCard job={job} />
          <StageTimeline
            currentStage={job.stage}
            readOnly={readOnly}
            isTerminal={isTerminal}
            isPending={isPending}
            onStageChange={handleStageChange}
          />
          <MilestoneCard
            jobId={job.id}
            tenantId={tenantId}
            milestones={localMilestones}
            readOnly={readOnly}
            onMilestoneChange={refresh}
          />
          <PhotosCard
            attachments={localAttachments}
            jobId={job.id}
            tenantId={tenantId}
            readOnly={readOnly}
            onPhotoUploaded={handlePhotoUploaded}
            onPhotoDeleted={(id) => setLocalAttachments(prev => prev.filter(x => x.id !== id))}
            onDeletePhoto={handleDeletePhoto}
          />
          <ActivityTimeline events={localEvents} />
          <LineItemsCard
            invoice={invoice}
            inventory={inventory}
            currency={currency}
            readOnly={readOnly}
            isPending={isPending}
            onRemoveLineItem={handleRemoveLineItem}
            onShowAddManual={() => setShowAddManual(true)}
            onShowAddStock={() => setShowAddStock(true)}
          />
          <QuoteInvoiceCard
            invoice={invoice}
            readOnly={readOnly}
            isPending={isPending}
            onGenerateInvoice={handleGenerateInvoice}
          />
        </div>

        {/* Right Sticky Sidebar */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <FinancialSummaryCard
            job={job}
            invoice={invoice}
            currency={currency}
            isTerminal={isTerminal}
          />
          <ApprovalCard
            jobId={job.id}
            tenantId={tenantId}
            jobNumber={job.job_number}
            customerEmail={customer?.email}
            approvalStatus={job.approval_status}
            approvalToken={job.approval_token}
            approvalRequestedAt={job.approval_requested_at}
            approvedAt={job.approved_at}
            approvalNotes={job.approval_notes}
            readOnly={readOnly}
            onRefresh={refresh}
          />
          {!readOnly && (
            <QuickActionsCard
              job={job}
              invoice={invoice}
              currency={currency}
              isPending={isPending}
              onTakeDeposit={openPaymentModal}
              onRecordPayment={() => openPaymentModal()}
              onMarkFullyPaid={handleMarkFullyPaid}
              onGenerateInvoice={handleGenerateInvoice}
            />
          )}
          <DocumentsCard
            job={job}
            invoice={invoice}
            customer={customer}
            readOnly={readOnly}
            onGenerateInvoice={handleGenerateInvoice}
            onEmailInvoice={handleEmailInvoice}
          />
          {!readOnly && !isTerminal && (
            <WorkflowActionsCard
              stage={job.stage}
              isPending={isPending}
              onStageChange={handleStageChange}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <AddManualItemModal
        isOpen={showAddManual}
        currency={currency}
        isPending={isPending}
        onClose={() => setShowAddManual(false)}
        onSubmit={handleAddManual}
      />
      <AddStockItemModal
        isOpen={showAddStock}
        inventory={inventory}
        currency={currency}
        isPending={isPending}
        onClose={() => setShowAddStock(false)}
        onSubmit={handleAddStock}
      />
      <RecordPaymentModal
        isOpen={showPayment}
        currency={currency}
        isPending={isPending}
        initialAmount={paymentPrefill}
        hasInvoice={!!invoice}
        onClose={() => setShowPayment(false)}
        onSubmit={handlePayment}
      />
      <StageChangeModal
        isOpen={showStageModal}
        targetStage={targetStage}
        isPending={isPending}
        onClose={() => setShowStageModal(false)}
        onConfirm={confirmStageChange}
      />
    </div>
  );
}
