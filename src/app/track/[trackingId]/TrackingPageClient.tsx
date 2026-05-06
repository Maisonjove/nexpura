"use client";

import { useState } from "react";
import Image from "next/image";
import TrackingMessages from "@/components/tracking/TrackingMessages";
import BespokeDecisionCard from "@/components/tracking/BespokeDecisionCard";
import type { OrderMessage } from "@/lib/messaging";

interface OrderData {
  id: string;
  tracking_id: string;
  order_type: "repair" | "bespoke";
  status: string;
  item_description: string;
  item_type?: string;
  estimated_completion_date: string | null;
  created_at: string;
  // Bespoke-only — drives BespokeDecisionCard.
  approval_status?: "pending" | "approved" | "changes_requested" | null;
  approval_notes?: string | null;
  approved_at?: string | null;
  tenant: {
    business_name: string;
    logo_url?: string;
  };
  attachments: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_type: string | null;
    description: string | null;
    created_at: string;
  }>;
  status_history: Array<{
    id: string;
    status: string;
    notes: string | null;
    changed_at: string;
  }>;
}

// Status configurations for visual progress.
// CRITICAL: keys here MUST match the DB CHECK constraints
// (`repairs_stage_valid`, `bespoke_jobs_stage_valid` from migration
// 20260421_stage_check_constraints.sql). Earlier the customer's
// progress tracker referenced `quality_check`, `cad`, `production` —
// none allowed by the constraint, so any in-flight job hit
// `findIndex` → -1 → bar rendered 0% width regardless of progress.
const REPAIR_STAGES = [
  { key: "intake", label: "Received" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
];

const BESPOKE_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "consultation", label: "Consultation" },
  { key: "design", label: "Design" },
  { key: "design_review", label: "Review" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "Production" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getFileIcon(fileType: string | null): string {
  if (!fileType) return "📄";
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType.includes("pdf")) return "📑";
  if (fileType.includes("cad") || fileType.includes("stl") || fileType.includes("obj")) return "💎";
  return "📄";
}

function getStatusBadgeClasses(status: string): string {
  const k = status.toLowerCase().replace(/\s+/g, "_");
  if (["ready", "collected", "completed"].includes(k)) {
    return "text-emerald-700 bg-emerald-50 border border-emerald-200";
  }
  if (["in_progress", "assessed", "design"].includes(k)) {
    return "text-nexpura-bronze bg-amber-50 border border-amber-200";
  }
  return "text-stone-600 bg-stone-100 border border-stone-200";
}

export default function TrackingPageClient({
  order,
  initialMessages,
}: {
  order: OrderData;
  initialMessages: OrderMessage[];
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const stages = order.order_type === "repair" ? REPAIR_STAGES : BESPOKE_STAGES;
  const currentStageIndex = stages.findIndex(
    (s) => s.key === order.status.toLowerCase().replace(/\s+/g, "_")
  );

  const imageAttachments = order.attachments.filter((a) =>
    a.file_type?.startsWith("image/")
  );
  const videoAttachments = order.attachments.filter((a) =>
    a.file_type?.startsWith("video/")
  );
  const otherAttachments = order.attachments.filter(
    (a) => !a.file_type?.startsWith("image/") && !a.file_type?.startsWith("video/")
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F6F3EE] to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-stone-200/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            {/* Jeweller identity */}
            <div className="flex items-center gap-4">
              {order.tenant.logo_url ? (
                <Image
                  src={order.tenant.logo_url}
                  alt={order.tenant.business_name}
                  width={44}
                  height={44}
                  className="rounded-xl border border-stone-200 shadow-sm object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-stone-900 flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="font-serif text-white text-xl font-light">
                    {order.tenant.business_name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                  {order.tenant.business_name}
                </h1>
                <p className="text-xs text-stone-400 mt-0.5 font-sans tracking-wide uppercase">
                  Order Tracking
                </p>
              </div>
            </div>

            {/* Tracking ID */}
            <div className="text-right flex-shrink-0">
              <p className="text-[0.6875rem] text-stone-400 uppercase tracking-widest font-sans mb-1">
                Tracking ID
              </p>
              <p className="font-mono text-sm font-semibold text-stone-800 bg-stone-100 px-3 py-1 rounded-lg border border-stone-200">
                {order.tracking_id}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-5">
        {/* Order Summary Card */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 sm:p-8">
          {/* Type badge + status */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-medium border ${
                  order.order_type === "repair"
                    ? "text-stone-600 bg-stone-50 border-stone-200"
                    : "text-stone-600 bg-stone-50 border-stone-200"
                }`}
              >
                {order.order_type === "repair" ? "Repair" : "Bespoke"}
              </span>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(order.status)}`}>
              {formatStatus(order.status)}
            </span>
          </div>

          {/* Item heading */}
          <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 leading-snug tracking-tight mb-2">
            {order.item_type || "Jewellery Item"}
          </h2>
          <p className="text-stone-500 text-sm leading-relaxed font-sans">
            {order.item_description}
          </p>

          {/* Divider */}
          <div className="border-t border-stone-100 mt-6 pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[0.6875rem] text-stone-400 uppercase tracking-widest font-sans mb-1.5">
                  Order Date
                </p>
                <p className="text-sm font-medium text-stone-900">
                  {formatDate(order.created_at)}
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-stone-400 uppercase tracking-widest font-sans mb-1.5">
                  Est. Completion
                </p>
                <p className="text-sm font-medium text-stone-900">
                  {order.estimated_completion_date
                    ? formatDate(order.estimated_completion_date)
                    : "To be confirmed"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 sm:p-8">
          <h3 className="font-serif text-lg text-stone-900 mb-7 tracking-tight">
            Progress
          </h3>

          {/* Progress bar track */}
          <div className="relative mb-2">
            {/* Track line */}
            <div className="absolute top-4 left-[calc(100/(stages.length*2)%)] right-[calc(100/(stages.length*2)%)] h-px bg-stone-200" />
            <div
              className="absolute top-4 left-0 h-px bg-nexpura-bronze transition-all duration-700"
              style={{
                width: currentStageIndex <= 0
                  ? "0%"
                  : `${(currentStageIndex / (stages.length - 1)) * 100}%`,
              }}
            />

            <div className="relative flex justify-between">
              {stages.map((stage, index) => {
                const isCompleted = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const isPending = index > currentStageIndex;

                return (
                  <div
                    key={stage.key}
                    className="flex flex-col items-center"
                    style={{ width: `${100 / stages.length}%` }}
                  >
                    {/* Dot */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isCurrent
                          ? "bg-nexpura-bronze text-white shadow-md ring-4 ring-nexpura-bronze/15"
                          : isCompleted
                          ? "bg-nexpura-bronze text-white"
                          : "bg-stone-100 border border-stone-200"
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isCurrent ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-stone-300" />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`mt-2.5 text-[0.6875rem] text-center leading-tight font-sans ${
                        isCurrent
                          ? "font-semibold text-stone-900"
                          : isCompleted
                          ? "text-stone-500"
                          : "text-stone-300"
                      } ${isPending ? "" : ""}`}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Attachments */}
        {order.attachments.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 sm:p-8">
            <h3 className="font-serif text-lg text-stone-900 mb-5 tracking-tight">
              Attachments
            </h3>

            {/* Image Gallery */}
            {imageAttachments.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {imageAttachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() => setSelectedImage(attachment.file_url)}
                      className="aspect-square rounded-xl overflow-hidden bg-stone-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/40 focus:ring-offset-2"
                    >
                      <Image
                        src={attachment.file_url}
                        alt={attachment.file_name}
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {videoAttachments.length > 0 && (
              <div className="mb-4 space-y-3">
                {videoAttachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-xl overflow-hidden bg-stone-900">
                    <video
                      src={attachment.file_url}
                      controls
                      controlsList="nodownload"
                      preload="metadata"
                      className="w-full max-h-[480px] bg-stone-900"
                    >
                      Your browser does not support inline video playback.{" "}
                      <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="underline">
                        Download {attachment.file_name}
                      </a>
                    </video>
                    {attachment.description && (
                      <p className="text-xs text-stone-500 px-3 py-2 bg-stone-50">
                        {attachment.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Other Files */}
            {otherAttachments.length > 0 && (
              <div className="space-y-2">
                {otherAttachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-100 transition-colors"
                  >
                    <span className="text-xl">{getFileIcon(attachment.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {attachment.file_name}
                      </p>
                      {attachment.description && (
                        <p className="text-xs text-stone-500 truncate">
                          {attachment.description}
                        </p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status History Timeline */}
        {order.status_history.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 sm:p-8">
            <h3 className="font-serif text-lg text-stone-900 mb-6 tracking-tight">
              Activity Timeline
            </h3>
            <div className="space-y-0">
              {order.status_history.map((entry, index) => (
                <div key={entry.id} className="flex gap-4">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center pt-0.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${
                        index === 0 ? "bg-nexpura-bronze" : "bg-stone-300"
                      }`}
                    />
                    {index < order.status_history.length - 1 && (
                      <div className="w-px flex-1 bg-stone-100 my-2" />
                    )}
                  </div>

                  <div className={`flex-1 ${index < order.status_history.length - 1 ? "pb-6" : "pb-0"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-stone-900 font-sans leading-snug">
                        {formatStatus(entry.status)}
                      </p>
                      <time className="text-[0.6875rem] text-stone-400 font-sans flex-shrink-0 mt-0.5">
                        {formatDateTime(entry.changed_at)}
                      </time>
                    </div>
                    {entry.notes && (
                      <p className="mt-1.5 text-sm text-stone-500 leading-relaxed font-sans">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bespoke-only: customer Approve / Decline on the design. */}
        {order.order_type === "bespoke" && (
          <BespokeDecisionCard
            trackingId={order.tracking_id}
            approvalStatus={order.approval_status ?? null}
            approvalNotes={order.approval_notes ?? null}
            approvedAt={order.approved_at ?? null}
            businessName={order.tenant.business_name}
          />
        )}

        {/* Customer ↔ Jeweller messaging */}
        <TrackingMessages
          trackingId={order.tracking_id}
          orderType={order.order_type}
          businessName={order.tenant.business_name}
          initialMessages={initialMessages}
        />

        {/* Footer */}
        <div className="text-center py-10">
          <p className="text-xs text-stone-400 font-sans">
            Questions? Contact{" "}
            <span className="font-medium text-stone-600">
              {order.tenant.business_name}
            </span>{" "}
            directly.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5">
            <span className="text-xs text-stone-300">Powered by</span>
            <a
              href="https://nexpura.com"
              className="text-xs font-semibold text-stone-400 hover:text-nexpura-bronze transition-colors font-sans"
            >
              Nexpura
            </a>
          </div>
        </div>
      </main>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 transition-colors"
            aria-label="Close"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <Image
            src={selectedImage}
            alt="Full size"
            width={1200}
            height={1200}
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
