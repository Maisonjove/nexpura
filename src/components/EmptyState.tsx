import React from 'react';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center mb-4 text-stone-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-stone-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <a
              href={action.href}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                action.variant === 'secondary'
                  ? 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                  : 'bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700'
              }`}
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                action.variant === 'secondary'
                  ? 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                  : 'bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700'
              }`}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
