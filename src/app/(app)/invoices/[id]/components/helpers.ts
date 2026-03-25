export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-stone-100 text-stone-600" },
  unpaid: { label: "Sent", className: "bg-stone-100 text-stone-700" },
  partial: { label: "Partially Paid", className: "bg-amber-50 text-amber-600" },
  paid: { label: "Paid", className: "bg-stone-100 text-amber-700" },
  overdue: { label: "Overdue", className: "bg-red-50 text-red-600" },
  voided: { label: "Voided", className: "bg-stone-100 text-stone-400" },
};

export const PAYMENT_METHODS = [
  "Cash",
  "Card (EFTPOS)",
  "Bank Transfer",
  "Afterpay",
  "Zip",
  "Cheque",
  "Other",
];

export function fmt(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00").toLocaleDateString(
    "en-AU",
    { day: "2-digit", month: "short", year: "numeric" }
  );
}
