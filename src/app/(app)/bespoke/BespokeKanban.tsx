"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { advanceJobStage } from "./actions";

interface BespokeJob {
  id: string;
  job_number?: string | null;
  title?: string | null;
  description?: string | null;
  stage: string;
  due_date?: string | null;
  customers?: { full_name?: string | null } | null;
}

const KANBAN_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "consultation", label: "Consultation" },
  { key: "deposit_received", label: "Deposit" },
  { key: "stone_sourcing", label: "Sourcing" },
  { key: "cad", label: "CAD" },
  { key: "approval", label: "Approval" },
  { key: "setting", label: "Setting" },
  { key: "polish", label: "Polish" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
];

function fmtDue(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function isOverdue(stage: string, due: string | null | undefined) {
  if (!due) return false;
  if (["collected", "cancelled", "ready"].includes(stage)) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

function JobCard({ job }: { job: BespokeJob }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;
  const overdue = isOverdue(job.stage, job.due_date);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-xl border ${
        overdue ? "border-red-200" : "border-stone-200"
      } p-3.5 mb-2.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:border-stone-300 transition-all duration-300 cursor-grab active:cursor-grabbing touch-none`}
    >
      <Link href={`/bespoke/${job.id}`} onClick={(e) => e.stopPropagation()} className="block">
        <p className="font-mono text-[0.6875rem] text-stone-400 tabular-nums">
          {job.job_number ?? job.id.slice(0, 8)}
        </p>
        <p className="font-serif text-base text-stone-900 leading-snug tracking-tight mt-1 line-clamp-2">
          {job.title || job.description || "Untitled piece"}
        </p>
        {job.customers?.full_name && (
          <p className="text-xs text-stone-500 mt-1.5 truncate">
            {job.customers.full_name}
          </p>
        )}
        {job.due_date && (
          <p className={`text-xs mt-2 ${overdue ? "text-red-600 font-medium" : "text-stone-500"}`}>
            Due {fmtDue(job.due_date)}
          </p>
        )}
      </Link>
    </div>
  );
}

function StageColumn({
  stage,
  label,
  jobs,
}: {
  stage: string;
  label: string;
  jobs: BespokeJob[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`bg-white border rounded-2xl p-4 min-h-[440px] flex-shrink-0 w-64 transition-colors duration-200 ${
        isOver ? "border-nexpura-bronze ring-2 ring-nexpura-bronze/15" : "border-stone-200"
      }`}
    >
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-stone-100">
        <h3 className="text-[0.6875rem] font-semibold text-stone-500 uppercase tracking-luxury">
          {label}
        </h3>
        <span className="text-xs text-stone-400 tabular-nums">
          {jobs.length}
        </span>
      </div>
      <div>
        {jobs.length === 0 ? (
          <p className="text-xs text-stone-300 text-center py-8 italic">
            No jobs
          </p>
        ) : (
          jobs.map((j) => <JobCard key={j.id} job={j} />)
        )}
      </div>
    </div>
  );
}

export default function BespokeKanban({ initialJobs }: { initialJobs: BespokeJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const jobId = event.active.id as string;
    const newStage = event.over?.id as string | undefined;
    if (!newStage) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.stage === newStage) return;

    const previousStage = job.stage;
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, stage: newStage } : j)));

    startTransition(async () => {
      const result = await advanceJobStage(jobId, newStage, "Stage changed via kanban drag");
      if (result?.error) {
        setError(result.error);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, stage: previousStage } : j)));
        setTimeout(() => setError(null), 4000);
      }
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-5 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">
          {error}
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage.key}
              label={stage.label}
              jobs={jobs.filter((j) => j.stage === stage.key)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
