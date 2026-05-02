"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Receipt,
  Wrench,
  Gem,
  Tag,
  Star,
  StickyNote,
  Printer,
  type LucideIcon,
} from "lucide-react";
import { markPrintJobDone, cancelPrintJob } from "./actions";
import type { PrintJob } from "./actions";

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  queued: { cls: "bg-nexpura-amber-bg text-nexpura-amber-muted", label: "Queued" },
  printing: { cls: "bg-nexpura-amber-bg text-nexpura-amber-muted", label: "Printing…" },
  done: { cls: "bg-nexpura-emerald-bg text-nexpura-emerald-deep", label: "Printed" },
  failed: { cls: "bg-nexpura-oxblood-bg text-nexpura-oxblood", label: "Failed" },
  cancelled: { cls: "bg-stone-100 text-stone-400", label: "Cancelled" },
};

const DOC_ICONS: Record<string, LucideIcon> = {
  invoice: FileText,
  receipt: Receipt,
  repair_ticket: Wrench,
  bespoke_sheet: Gem,
  stock_tag: Tag,
  appraisal: Star,
  memo: StickyNote,
  label: Tag,
};

interface Props {
  jobs: PrintJob[];
  tenantId: string;
}

export default function PrintQueueClient({ jobs: initialJobs, tenantId }: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("queued");
  const [error, setError] = useState<string | null>(null);

  const filtered = jobs.filter((j) => statusFilter === "all" || j.status === statusFilter);
  const queuedCount = jobs.filter((j) => j.status === "queued" || j.status === "printing").length;

  function handleDone(jobId: string) {
    startTransition(async () => {
      const result = await markPrintJobDone(jobId);
      if (result.error) { setError(result.error); return; }
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "done", printed_at: new Date().toISOString() } : j));
    });
  }

  function handleCancel(jobId: string) {
    startTransition(async () => {
      const result = await cancelPrintJob(jobId);
      if (result.error) { setError(result.error); return; }
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "cancelled" } : j));
    });
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Print Queue</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Manage pending print jobs · {queuedCount > 0 ? `${queuedCount} in queue` : "Queue is clear"}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["queued", "printing", "done", "failed", "cancelled", "all"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {s === "all" ? "All" : STATUS_STYLES[s]?.label ?? s}
            {s === "queued" && queuedCount > 0 && (
              <span className="ml-1.5 bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{queuedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Printer className="w-10 h-10 mx-auto mb-3 text-nexpura-taupe-400" strokeWidth={1.5} />
          <p className="text-stone-600 font-medium">No {statusFilter === "all" ? "" : statusFilter} print jobs</p>
          {statusFilter === "queued" && <p className="text-sm mt-1">Print jobs will appear here when documents are sent to print</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => {
            const Icon = DOC_ICONS[job.document_type] ?? FileText;
            const st = STATUS_STYLES[job.status] ?? { cls: "bg-stone-100 text-stone-600", label: job.status };
            const isPending2 = job.status === "queued" || job.status === "printing";

            return (
              <div key={job.id} className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-4">
                <Icon className="w-6 h-6 text-nexpura-taupe-400 flex-shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-stone-900 text-sm">
                      {job.document_title ?? job.document_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-stone-400 capitalize">{job.document_type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Printer className="w-3 h-3" strokeWidth={1.5} /> {job.printer_type}</span>
                    <span>×{job.copies} cop{job.copies === 1 ? "y" : "ies"}</span>
                    <span>{new Date(job.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    {job.printed_at && <span>Printed {new Date(job.printed_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                  {job.error_message && (
                    <p className="text-xs text-red-600 mt-1">{job.error_message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                  {isPending2 && (
                    <>
                      {job.pdf_url && (
                        <a
                          href={job.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-nexpura-charcoal text-white rounded-lg text-xs font-medium hover:bg-nexpura-charcoal-700"
                        >
                          <Printer className="w-3 h-3" strokeWidth={1.5} /> Print
                        </a>
                      )}
                      <button
                        onClick={() => handleDone(job.id)}
                        disabled={isPending}
                        className="px-2.5 py-1.5 border border-nexpura-emerald-deep/30 text-nexpura-emerald-deep rounded-lg text-xs hover:bg-nexpura-emerald-bg"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => handleCancel(job.id)}
                        disabled={isPending}
                        className="px-2.5 py-1.5 border border-stone-200 text-stone-500 rounded-lg text-xs hover:bg-stone-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
