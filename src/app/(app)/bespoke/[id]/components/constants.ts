export const BESPOKE_STAGES = [
  { key: "brief", label: "Brief" },
  { key: "assessed", label: "Assessed" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "design", label: "Design" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "collected", label: "Collected" },
];

export const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  brief: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  assessed: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-400" },
  quoted: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400" },
  approved: { bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" },
  design: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  ready: { bg: "bg-stone-200", text: "text-stone-900", dot: "bg-amber-700" },
  collected: { bg: "bg-stone-900", text: "text-white", dot: "bg-white" },
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "text-stone-400",
  normal: "text-amber-700",
  high: "text-amber-600",
  urgent: "text-red-600",
};

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "cheque", "store_credit"];
