'use client'

// ============================================
// Refined editorial currency selector for /pricing.
// Per Kaitlyn 2026-04-26 — replaces the chunky pill-style
// CurrencyPicker that lived inline in PricingClient.tsx with a
// quieter inline control: small uppercase "CURRENCY" eyebrow, then
// the currency code with a thin bottom-border underline + chevron.
// Hover/focus shifts the underline to gold.
//
// One adaptation from Kaitlyn's spec: her snippet had an inline
// <style>{`@keyframes fadeInUp …`}</style> block. The marketing
// surface already has a global `fadeInUp` (16px translate) used
// elsewhere; the inline keyframe would override it globally. The
// dropdown's tighter 4px-translate fade lives in globals.css under
// the unique name `nxFadeInDropdown` so there's no clash.
// ============================================

import React, { useEffect, useRef, useState } from 'react'

export type CurrencyCode = 'AUD' | 'USD' | 'GBP' | 'EUR'

const CURRENCIES: { code: CurrencyCode; label: string; region: string }[] = [
  { code: 'AUD', label: 'AUD', region: 'Australian Dollar' },
  { code: 'USD', label: 'USD', region: 'US Dollar' },
  { code: 'GBP', label: 'GBP', region: 'British Pound' },
  { code: 'EUR', label: 'EUR', region: 'Euro' },
]

type Props = {
  value: CurrencyCode
  onChange: (next: CurrencyCode) => void
}

export default function CurrencySelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close on outside-click + Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const selected = CURRENCIES.find((c) => c.code === value) ?? CURRENCIES[0]

  return (
    <div className="inline-flex items-center gap-3" ref={wrapperRef}>
      {/* Quiet eyebrow-style label */}
      <span className="font-sans text-[0.68rem] font-medium uppercase tracking-[0.22em] text-[#8A8276]">
        Currency
      </span>

      <div className="relative">
        {/* Trigger — refined inline control, not a form input */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Currency: ${selected.region}`}
          className="inline-flex items-center gap-2 font-sans text-[0.88rem] font-medium tracking-[0.02em] text-m-charcoal bg-transparent border-b border-[#C9BFA9] pb-1 pr-1 transition-colors duration-200 hover:border-[#A8852C] focus:outline-none focus-visible:border-[#A8852C]"
        >
          <span>{selected.label}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={
              open
                ? 'w-3 h-3 text-[#8A8276] transition-transform duration-200 rotate-180'
                : 'w-3 h-3 text-[#8A8276] transition-transform duration-200 rotate-0'
            }
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* Dropdown panel */}
        {open && (
          <ul
            role="listbox"
            aria-label="Select currency"
            className="absolute right-0 mt-3 z-20 min-w-[180px] bg-[#FAF6EC] border border-[#E4DBC9] rounded-xl shadow-[0_20px_50px_-20px_rgba(60,40,20,0.18)] overflow-hidden animate-[nxFadeInDropdown_180ms_ease-out]"
          >
            {CURRENCIES.map((c) => {
              const isSelected = c.code === value
              return (
                <li key={c.code} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.code)
                      setOpen(false)
                    }}
                    className={
                      isSelected
                        ? 'w-full text-left flex items-baseline justify-between gap-4 px-4 py-2.5 font-sans transition-colors duration-150 bg-[#F1E9D8] text-m-charcoal'
                        : 'w-full text-left flex items-baseline justify-between gap-4 px-4 py-2.5 font-sans transition-colors duration-150 text-[#5A554C] hover:bg-[#F1E9D8]/60 hover:text-m-charcoal'
                    }
                  >
                    <span className="text-[0.88rem] font-medium tracking-[0.02em]">
                      {c.label}
                    </span>
                    <span className="text-[0.78rem] text-[#8A8276]">
                      {c.region}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
