// Stage values MUST match the DB CHECK constraint
// `bespoke_jobs_stage_valid` (verified 2026-04-25 against
// vkpjocnrefjfpuovzinn). Pre-fix this file shipped `brief`, `cad`,
// `delivered` — none of which the constraint allows. Clicking any of
// those rows in StageTimeline / WorkflowActionsCard raised
// `new row for relation "bespoke_jobs" violates check constraint
//  "bespoke_jobs_stage_valid"` and the staff saw an opaque error.
//
// Allowed: enquiry, consultation, intake, design, design_review,
// assessed, quoted, approved, in_progress, ready, collected, completed,
// cancelled, on_hold.
export const BESPOKE_STAGES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "consultation", label: "Consultation" },
  { key: "design", label: "Design" },
  { key: "design_review", label: "Design Review" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
];

export const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  enquiry: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  consultation: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  design: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
  design_review: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  quoted: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
  approved: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-700" },
  ready: { bg: "bg-stone-200", text: "text-stone-900", dot: "bg-amber-700" },
  collected: { bg: "bg-stone-900", text: "text-white", dot: "bg-white" },
  completed: { bg: "bg-stone-900", text: "text-white", dot: "bg-white" },
  cancelled: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  on_hold: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
};

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "cheque", "store_credit"];
