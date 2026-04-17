"use client";

import type { Repair, Customer, Invoice, JobAttachment } from "./types";

interface AlertsCardProps {
  repair: Repair;
  customer: Customer | null;
  invoice: Invoice | null;
  attachments: JobAttachment[];
  balanceDue: number;
}

interface Alert {
  icon: string;
  message: string;
  type: "warning" | "info";
}

export default function AlertsCard({
  repair,
  customer,
  invoice,
  attachments,
  balanceDue,
}: AlertsCardProps) {
  const isTerminal = ["collected", "cancelled"].includes(repair.stage);
  const isOverdue = repair.due_date && new Date(repair.due_date) < new Date(new Date().toDateString()) && !isTerminal;
  const noContactInfo = customer && !customer.email && !customer.mobile;
  const noInvoice = !invoice && !isTerminal;
  const hasBalance = balanceDue > 0 && !isTerminal;
  const noPhotos = attachments.length === 0;

  const alerts: Alert[] = [];

  if (isOverdue) {
    alerts.push({ icon: "⚠️", message: "Job is overdue", type: "warning" });
  }
  if (noContactInfo) {
    alerts.push({ icon: "📵", message: "No contact info on file", type: "info" });
  }
  if (noInvoice) {
    alerts.push({ icon: "📄", message: "No invoice generated", type: "info" });
  }
  if (hasBalance) {
    alerts.push({ icon: "💰", message: "Balance due on account", type: "warning" });
  }
  if (noPhotos) {
    alerts.push({ icon: "📷", message: "No photos uploaded", type: "info" });
  }

  // Don't render if no alerts
  if (alerts.length === 0) return null;

  return (
    <div className="bg-white border-l-4 border-l-amber-400 border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Alerts</h2>
      <div className="space-y-2">
        {alerts.map((alert, idx) => (
          <div 
            key={idx} 
            className={`flex items-center gap-2 text-sm ${
              alert.type === "warning" ? "text-amber-700" : "text-stone-600"
            }`}
          >
            <span>{alert.icon}</span>
            <span>{alert.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
