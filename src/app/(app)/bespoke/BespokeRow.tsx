"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight } from "lucide-react";

type Customer = { id: string; full_name: string | null } | null;

export interface BespokeRowData {
  id: string;
  job_number: string;
  title: string;
  stage: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  customers: Customer;
}

const STAGE_BADGE_PROPS: Record<string, { label: string; className: string }> = {
  enquiry: { label: "Enquiry", className: "bg-stone-100 text-stone-600 border-stone-200" },
  consultation: { label: "Consultation", className: "bg-amber-50 text-amber-700 border-amber-200" },
  deposit_received: { label: "Deposit Received", className: "bg-amber-50 text-amber-700 border-amber-200" },
  stone_sourcing: { label: "Stone Sourcing", className: "bg-amber-50 text-amber-700 border-amber-200" },
  cad: { label: "CAD", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approval: { label: "Approval", className: "bg-amber-50 text-amber-700 border-amber-200" },
  setting: { label: "Setting", className: "bg-amber-50 text-amber-700 border-amber-200" },
  polish: { label: "Polish", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  collected: { label: "Collected", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
};
const DEFAULT_BADGE = { label: "Unknown", className: "bg-stone-100 text-stone-600 border-stone-200" };

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function formatInitials(name: string): string {
  const parts = name.split(" ");
  let result = "";
  for (const p of parts) if (p) result += p[0];
  return result.toUpperCase().slice(0, 2);
}

function isOverdue(due_date: string | null): boolean {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function BespokeRowInner({ job }: { job: BespokeRowData }) {
  const router = useRouter();
  const badge = STAGE_BADGE_PROPS[job.stage] ?? DEFAULT_BADGE;
  const name = job.customers?.full_name || "Unknown";
  const overdue = isOverdue(job.due_date);
  const dueText = job.due_date ? DATE_FMT.format(new Date(job.due_date)) : "—";

  return (
    <TableRow
      className="hover:bg-stone-50/60 border-stone-100 cursor-pointer"
      onClick={() => router.push(`/bespoke/${job.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-stone-100 text-stone-600 text-xs font-semibold">
              {formatInitials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-stone-900">{name}</span>
        </div>
      </TableCell>
      <TableCell>
        <p className="font-medium text-sm text-stone-900">{job.title || "Untitled"}</p>
        <p className="text-xs text-stone-400 mt-0.5">{job.job_number}</p>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
      </TableCell>
      <TableCell className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-stone-700"}`}>
        {dueText}
      </TableCell>
      <TableCell>
        <ArrowRight className="w-4 h-4 text-stone-300 hover:text-amber-700" />
      </TableCell>
    </TableRow>
  );
}

export const BespokeRow = memo(BespokeRowInner);
