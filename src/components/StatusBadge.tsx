export const StatusBadge = ({ status }: { status: string; type?: string }) => {
  const key = status.toLowerCase().replace(/\s+/g, '_');

  const getClasses = (k: string): string => {
    // Success: active, paid, completed, delivered, in_stock, ready, collected, approved, ready_for_pickup
    if (['active', 'paid', 'completed', 'delivered', 'in_stock', 'ready', 'collected', 'approved', 'ready_for_pickup'].includes(k)) {
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
    // Warning: pending, processing, in_progress, draft, awaiting_approval, in_workshop, waiting_parts, cad, casting, setting, polishing, enquiry, quote_sent, assessed, intake
    if (['pending', 'processing', 'in_progress', 'draft', 'awaiting_approval', 'in_workshop', 'waiting_parts', 'cad', 'casting', 'setting', 'polishing', 'enquiry', 'quote_sent', 'assessed', 'intake', 'low_stock'].includes(k)) {
      return 'text-amber-700 bg-amber-50 border-amber-200';
    }
    // Danger: overdue, cancelled, rejected, out_of_stock, inactive, archived
    if (['overdue', 'cancelled', 'rejected', 'out_of_stock', 'inactive', 'archived'].includes(k)) {
      return 'text-red-700 bg-red-50 border-red-200';
    }
    // Default
    return 'text-stone-600 bg-stone-100 border-stone-200';
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getClasses(key)}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
