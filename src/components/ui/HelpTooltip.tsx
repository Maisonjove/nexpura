'use client';

import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HelpTooltipProps {
  content: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  size?: number;
}

export function HelpTooltip({ content, className, side = 'top', size = 14 }: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded-full ${className ?? ''}`}
            aria-label="Help information"
          >
            <HelpCircle size={size} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Convenience wrapper for inline help next to labels
interface LabelWithHelpProps {
  label: string;
  helpText: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}

export function LabelWithHelp({ label, helpText, htmlFor, required, className }: LabelWithHelpProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <HelpTooltip content={helpText} />
    </div>
  );
}
