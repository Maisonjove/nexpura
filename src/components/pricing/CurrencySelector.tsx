'use client'

// ============================================
// Inline currency switcher — 4 visible tabs, no dropdown.
//
// Replaced the prior dropdown version (commit 5a15cbf) per Kaitlyn
// 2026-04-26: with only 4 options, the dropdown was overkill, and
// when opened it overlapped the pricing card content. Inline pill
// tabs are always visible, never overlap, and read as a deliberate
// page-level control above the plans.
//
// Pure declarative component — no state, no effects, no refs, no
// portals. value/onChange API unchanged from the previous version,
// so the import site on PricingClient.tsx didn't need a code change.
// ============================================

import React from 'react'

export type CurrencyCode = 'AUD' | 'USD' | 'GBP' | 'EUR'

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'AUD', label: 'AUD' },
  { code: 'USD', label: 'USD' },
  { code: 'GBP', label: 'GBP' },
  { code: 'EUR', label: 'EUR' },
]

type Props = {
  value: CurrencyCode
  onChange: (next: CurrencyCode) => void
}

export default function CurrencySelector({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Select currency"
      className="inline-flex items-center gap-4"
    >
      {/* Quiet eyebrow-style label */}
      <span className="font-sans text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#8A8276]">
        Currency
      </span>

      {/* Inline pill tabs */}
      <div className="inline-flex items-center rounded-full bg-[#F1E9D8]/60 border border-[#E4DBC9] p-0.5">
        {CURRENCIES.map((c) => {
          const isActive = c.code === value
          return (
            <button
              key={c.code}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(c.code)}
              className={
                isActive
                  ? 'relative rounded-full px-3.5 py-1.5 font-sans text-[0.78rem] font-medium tracking-[0.04em] transition-all duration-200 bg-white text-m-charcoal shadow-[0_2px_8px_-2px_rgba(60,40,20,0.12)]'
                  : 'relative rounded-full px-3.5 py-1.5 font-sans text-[0.78rem] font-medium tracking-[0.04em] transition-all duration-200 text-[#8A8276] hover:text-m-charcoal'
              }
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
