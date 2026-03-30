"use client";

import { useState, forwardRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function SectionHeader({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div className={`border-b border-stone-100 pb-3 mb-5 ${className}`}>
      <h2 className="font-semibold text-base text-stone-900 uppercase tracking-wider">{title}</h2>
    </div>
  );
}

export function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = false,
  badge 
}: { 
  title: string; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-stone-900 uppercase tracking-wider text-sm">{title}</span>
          {badge && (
            <span className="bg-amber-700/10 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 border-t border-stone-50 pt-6">
          {children}
        </div>
      )}
    </div>
  );
}

export function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { className?: string }>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 transition-colors ${className}`}
      />
    );
  }
);
Input.displayName = "Input";

export function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 focus:outline-none focus:border-amber-600 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        {...props}
        className={`w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 transition-colors resize-none ${className}`}
      />
    );
  }
);
Textarea.displayName = "Textarea";
