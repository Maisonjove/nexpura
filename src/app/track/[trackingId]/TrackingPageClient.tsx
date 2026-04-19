"use client";

import { useState } from "react";
import Image from "next/image";
import TrackingMessages from "@/components/tracking/TrackingMessages";
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

// Status configurations for visual progress
const REPAIR_STAGES = [
  { key: "intake", label: "Received", icon: "📥" },
  { key: "assessed", label: "Assessed", icon: "🔍" },
  { key: "in_progress", label: "In Progress", icon: "⚒️" },
  { key: "quality_check", label: "Quality Check", icon: "✅" },
  { key: "ready", label: "Ready", icon: "🎉" },
  { key: "collected", label: "Collected", icon: "🏠" },
];

const BESPOKE_STAGES = [
  { key: "enquiry", label: "Enquiry", icon: "💬" },
  { key: "consultation", label: "Consultation", icon: "🤝" },
  { key: "design", label: "Design", icon: "✏️" },
  { key: "cad", label: "CAD Model", icon: "💎" },
  { key: "approved", label: "Approved", icon: "👍" },
  { key: "production", label: "Production", icon: "⚒️" },
  { key: "quality_check", label: "Quality Check", icon: "✅" },
  { key: "ready", label: "Ready", icon: "🎉" },
  { key: "collected", label: "Collected", icon: "🏠" },
];

function getStatusColor(status: string): string {
  const lowerStatus = status.toLowerCase().replace(/\s+/g, "_");
  
  // Green - completed/ready
  if (["ready", "collected", "completed", "approved", "quality_check"].includes(lowerStatus)) {
    return "bg-emerald-500";
  }
  // Amber - in progress
  if (["in_progress", "production", "cad", "design", "assessed"].includes(lowerStatus)) {
    return "bg-amber-500";
  }
  // Default - pending/early stages
  return "bg-stone-400";
}

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
  const otherAttachments = order.attachments.filter(
    (a) => !a.file_type?.startsWith("image/")
  );

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {order.tenant.logo_url ? (
                <Image
                  src={order.tenant.logo_url}
                  alt={order.tenant.business_name}
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-stone-900 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {order.tenant.business_name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-semibold text-stone-900">
                  {order.tenant.business_name}
                </h1>
                <p className="text-xs text-stone-500">Order Tracking</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 uppercase tracking-wider">
                Tracking ID
              </p>
              <p className="font-mono font-semibold text-stone-900">
                {order.tracking_id}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Order Summary Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                  order.order_type === "repair"
                    ? "text-blue-700 bg-blue-50 border-blue-200"
                    : "text-purple-700 bg-purple-50 border-purple-200"
                }`}
              >
                {order.order_type === "repair" ? "🔧 Repair" : "✨ Bespoke"}
              </span>
              <h2 className="mt-3 text-xl font-semibold text-stone-900">
                {order.item_type || "Jewellery Item"}
              </h2>
              <p className="mt-1 text-stone-600 text-sm">
                {order.item_description}
              </p>
            </div>
            <div
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                order.status.toLowerCase() === "ready" ||
                order.status.toLowerCase() === "collected"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {formatStatus(order.status)}
            </div>
          </div>

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                Order Date
              </p>
              <p className="font-medium text-stone-900">
                {formatDate(order.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                Est. Completion
              </p>
              <p className="font-medium text-stone-900">
                {order.estimated_completion_date
                  ? formatDate(order.estimated_completion_date)
                  : "To be confirmed"}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900 mb-6">
            Progress
          </h3>
          
          {/* Progress Bar */}
          <div className="relative mb-8">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-stone-200" />
            <div
              className="absolute top-4 left-0 h-0.5 bg-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.max(0, (currentStageIndex / (stages.length - 1)) * 100)}%`,
              }}
            />
            
            <div className="relative flex justify-between">
              {stages.map((stage, index) => {
                const isCompleted = index <= currentStageIndex;
                const isCurrent = index === currentStageIndex;
                
                return (
                  <div
                    key={stage.key}
                    className="flex flex-col items-center"
                    style={{ width: `${100 / stages.length}%` }}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                        isCurrent
                          ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                          : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-stone-200 text-stone-400"
                      }`}
                    >
                      {isCompleted ? "✓" : stage.icon}
                    </div>
                    <span
                      className={`mt-2 text-xs text-center ${
                        isCurrent
                          ? "font-semibold text-stone-900"
                          : isCompleted
                          ? "text-stone-600"
                          : "text-stone-400"
                      }`}
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
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900 mb-4">
              Attachments
            </h3>

            {/* Image Gallery */}
            {imageAttachments.length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-3">
                  {imageAttachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() => setSelectedImage(attachment.file_url)}
                      className="aspect-square rounded-lg overflow-hidden bg-stone-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
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

            {/* Other Files */}
            {otherAttachments.length > 0 && (
              <div className="space-y-2">
                {otherAttachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors"
                  >
                    <span className="text-xl">
                      {getFileIcon(attachment.file_type)}
                    </span>
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
                    <svg
                      className="w-5 h-5 text-stone-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status History Timeline */}
        {order.status_history.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-stone-900 mb-4">
              Activity Timeline
            </h3>
            <div className="space-y-4">
              {order.status_history.map((entry, index) => (
                <div key={entry.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        index === 0 ? getStatusColor(entry.status) : "bg-stone-300"
                      }`}
                    />
                    {index < order.status_history.length - 1 && (
                      <div className="w-px flex-1 bg-stone-200 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-stone-900">
                        {formatStatus(entry.status)}
                      </p>
                      <time className="text-xs text-stone-500">
                        {formatDateTime(entry.changed_at)}
                      </time>
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-sm text-stone-600">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer ↔ Jeweller messaging on this order */}
        <TrackingMessages
          trackingId={order.tracking_id}
          orderType={order.order_type}
          businessName={order.tenant.business_name}
          initialMessages={initialMessages}
        />

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-stone-400">
            Questions about your order? Contact{" "}
            <span className="font-medium text-stone-600">
              {order.tenant.business_name}
            </span>
          </p>
          <p className="mt-4 text-xs text-stone-400">
            Powered by{" "}
            <a
              href="https://nexpura.com"
              className="font-semibold text-stone-900 hover:underline"
            >
              Nexpura
            </a>
          </p>
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
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            aria-label="Close"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <Image
            src={selectedImage}
            alt="Full size"
            width={1200}
            height={1200}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
