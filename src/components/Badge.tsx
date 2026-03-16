const variantClasses = {
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  complete: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  'in-progress': 'bg-amber-50 text-amber-700 border border-amber-200',
  draft: 'bg-stone-100 text-stone-600 border border-stone-200',
  queued: 'bg-stone-100 text-stone-600 border border-stone-200',
  neutral: 'bg-stone-100 text-stone-600 border border-stone-200',
  overdue: 'bg-rose-50 text-rose-700 border border-rose-200',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200',
  info: 'bg-stone-100 text-stone-600 border border-stone-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
};

type BadgeVariant = keyof typeof variantClasses;

interface BadgeProps {
  variant?: BadgeVariant;
  label: string;
  className?: string;
}

export function Badge({ variant = 'neutral', label, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${variantClasses[variant]} ${className}`}>
      {label}
    </span>
  );
}
