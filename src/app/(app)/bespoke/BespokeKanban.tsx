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
      className={`bg-white rounded-lg border ${
        overdue ? "border-nexpura-oxblood/40" : "border-stone-200"
      } p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing touch-none`}
    >
      <Link href={`/bespoke/${job.id}`} onClick={(e) => e.stopPropagation()} className="block">
        <p className="text-xs font-mono text-stone-500">{job.job_number ?? job.id.slice(0, 8)}</p>
        <p className="text-sm font-medium text-stone-900 mt-1 line-clamp-2">
          {job.title || job.description || "—"}
        </p>
        {job.due_date && (
          <p className={`text-xs mt-1 ${overdue ? "text-nexpura-oxblood font-medium" : "text-stone-500"}`}>
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
      className={`bg-stone-50 rounded-xl p-3 min-h-[400px] flex-shrink-0 w-60 ${
        isOver ? "ring-2 ring-amber-500/50" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">{label}</h3>
        <span className="text-xs text-stone-500">{jobs.length}</span>
      </div>
      <div>
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
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
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
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
