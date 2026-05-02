// Tone override for the workspace-redesign palette (Kaitlyn 2026-05-02).
// 'auto' (default) keeps the legacy status->color mapping below; the named
// tones force a specific palette regardless of `status`. Used by
// /workshop/jobs to render emerald-deep "Ready" rows and oxblood overdue
// rows even when the underlying stage value would map to a different
// colour by default.
type StatusTone =
  | 'auto'
  | 'overdue'   // oxblood emphasis
  | 'ready'     // emerald-deep emphasis
  | 'progress'  // amber-muted (active jobs)
  | 'pending'   // warm taupe (waiting)
  | 'neutral';  // stone

const TONE_CLASSES: Record<Exclude<StatusTone, 'auto'>, string> = {
  overdue: 'text-nexpura-oxblood bg-nexpura-oxblood-bg border-nexpura-oxblood/20',
  ready: 'text-nexpura-emerald-deep bg-nexpura-emerald-bg border-nexpura-emerald-deep/20',
  progress: 'text-nexpura-amber-muted bg-nexpura-amber-bg border-nexpura-amber-muted/20',
  pending: 'text-nexpura-charcoal-500 bg-nexpura-warm border-nexpura-taupe-100',
  neutral: 'text-stone-600 bg-stone-100 border-stone-200',
};

export const StatusBadge = ({
  status,
  tone = 'auto',
}: {
  status: string;
  type?: string;
  tone?: StatusTone;
}) => {
  const key = status.toLowerCase().replace(/\s+/g, '_');

  const getClasses = (k: string): string => {
    if (tone !== 'auto') return TONE_CLASSES[tone];
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
    // Oxblood — overdue/cancelled/bad. Uses the new workspace tokens
    // (Kaitlyn 2026-05-02 brief) so red-status pills sit on the warm
    // palette instead of clashing browser-red.
    if (['overdue', 'cancelled', 'rejected', 'out_of_stock', 'inactive', 'archived',
         'unpaid', 'expired', 'void', 'voided', 'critical'].includes(k)) {
      return 'text-nexpura-oxblood bg-nexpura-oxblood-bg border-nexpura-oxblood/20';
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
