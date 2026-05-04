"use client";

import { useState, forwardRef } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

/**
 * Section card. Wraps a group of fields in an `nx-card` style surface with
 * a serif heading, an uppercase eyebrow, and a quiet stone description.
 */
export function SectionHeader({
  title,
  eyebrow,
  description,
  className = "",
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-7 ${className}`}>
      <div>
        {eyebrow && (
          <p className="text-[0.6875rem] uppercase tracking-luxury text-stone-400 mb-2.5">
            {eyebrow}
          </p>
        )}
        <h2 className="font-serif text-2xl tracking-tight text-stone-900 leading-[1.2]">
          {title}
        </h2>
        {description && (
          <p className="text-[0.8125rem] text-stone-500 mt-2 leading-relaxed max-w-xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Card-style section wrapper. Use this for any form section that should sit
 * on its own white surface inside the ivory page background.
 */
export function FormSection({
  title,
  eyebrow,
  description,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-stone-200 rounded-2xl p-7 lg:p-10">
      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        description={description}
        action={action}
      />
      {children}
    </section>
  );
}

/**
 * Collapsible card-style section. Same surface as FormSection, but the body
 * folds away by default for optional/advanced fields.
 */
export function CollapsibleSection({
  title,
  eyebrow,
  description,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-7 lg:px-10 py-6 flex items-center justify-between text-left hover:bg-stone-50/40 transition-colors duration-200"
      >
        <div className="flex items-start gap-3">
          <div>
            {eyebrow && (
              <p className="text-[0.6875rem] uppercase tracking-luxury text-stone-400 mb-2">
                {eyebrow}
              </p>
            )}
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-2xl tracking-tight text-stone-900 leading-[1.2]">
                {title}
              </h2>
              {badge && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-medium border border-stone-200 bg-stone-50 text-stone-500 uppercase tracking-[0.12em]">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="text-[0.8125rem] text-stone-500 mt-2 leading-relaxed max-w-xl">
                {description}
              </p>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="w-4 h-4 text-stone-400 shrink-0" />
        ) : (
          <ChevronDownIcon className="w-4 h-4 text-stone-400 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-7 lg:px-10 pb-7 lg:pb-10 pt-2 border-t border-stone-100">
          <div className="pt-7">{children}</div>
        </div>
      )}
    </section>
  );
}

export function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[0.8125rem] font-medium text-stone-700 mb-1.5"
    >
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { className?: string }
>(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      {...props}
      className={`w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 ${className}`}
    />
  );
});
Input.displayName = "Input";

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 ${className}`}
    >
      {children}
    </select>
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }
>(({ className = "", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      {...props}
      className={`w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none ${className}`}
    />
  );
});
Textarea.displayName = "Textarea";
