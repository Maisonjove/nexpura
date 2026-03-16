export const StatusBadge = ({ status }: { status: string; type?: string }) => {
  const key = status.toLowerCase().replace(/\s+/g, '_');

  const getClasses = (k: string): string => {
    // Green — paid/done/complete/ready
    if (['active', 'paid', 'completed', 'delivered', 'in_stock', 'ready', 'collected', 'approved',
         'ready_for_pickup', 'accepted', 'confirmed'].includes(k)) {
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    }
    // Blue — actively in progress
    if (['in_progress', 'in_workshop', 'processing', 'stone_sourcing', 'cad', 'setting', 'polish',
         'casting', 'polishing'].includes(k)) {
      return 'text-amber-700 bg-amber-50 border-amber-200';
    }
    // Amber — pending/waiting/quoted/draft/sent (awaiting action)
    if (['pending', 'draft', 'sent', 'awaiting_approval', 'waiting_parts', 'enquiry', 'quote_sent',
         'assessed', 'intake', 'low_stock', 'quoted', 'consultation', 'deposit_paid',
         'partially_paid', 'partial'].includes(k)) {
      return 'text-amber-700 bg-amber-50 border-amber-200';
    }
    // Red — overdue/cancelled/bad
    if (['overdue', 'cancelled', 'rejected', 'out_of_stock', 'inactive', 'archived',
         'unpaid', 'expired', 'void', 'voided'].includes(k)) {
      return 'text-red-700 bg-red-50 border-red-200';
    }
    // Grey — neutral end states
    if (['converted', 'closed', 'refunded'].includes(k)) {
      return 'text-stone-600 bg-stone-100 border-stone-200';
    }
    // Default
    return 'text-stone-600 bg-stone-100 border-stone-200';
  };

  // Pretty-print the label
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getClasses(key)}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
