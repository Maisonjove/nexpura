interface StatusBadgeProps {
  status: string;
  className?: string;
}

function getStatusStyle(status: string): string {
  const s = status.toLowerCase().replace(/[_\s]+/g, " ");

  if (["ready", "ready for pickup", "completed", "paid", "in stock", "collected"].some((k) => s.includes(k))) {
    return "bg-green-50 text-green-700 border border-green-200";
  }
  if (["in workshop", "in progress", "confirmed", "approved", "setting", "cad", "casting", "polishing"].some((k) => s.includes(k))) {
    return "bg-blue-50 text-blue-700 border border-blue-200";
  }
  if (["awaiting", "quote sent", "pending", "quoted", "low stock", "on order"].some((k) => s.includes(k))) {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  if (["overdue", "out of stock", "cancelled", "rejected"].some((k) => s.includes(k))) {
    return "bg-red-50 text-red-700 border border-red-200";
  }
  if (["enquiry", "draft", "received", "intake", "assessed"].some((k) => s.includes(k))) {
    return "bg-gray-100 text-gray-600 border border-gray-200";
  }
  return "bg-gray-100 text-gray-600 border border-gray-200";
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(status)} ${className}`}
    >
      {status}
    </span>
  );
}
