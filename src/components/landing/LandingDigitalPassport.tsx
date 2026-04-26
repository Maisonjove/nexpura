// ============================================
// "Give every piece a digital identity"
// Per Kaitlyn 2026-04-26 brief — replaces the prior plural
// LandingDigitalPassports section. Pure SVG/HTML, no external assets.
// (Old plural file LandingDigitalPassports.tsx kept on disk for repurposing.)
// ============================================

import React from "react"
import { SECTION_PADDING, HEADING, INTRO_SPACING, CARD, CONTAINER } from "./_tokens"

type Card = {
  title: string
  body: string
  icon: React.ReactNode
}

const Icon = {
  qr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3" />
      <path d="M21 14v3" />
      <path d="M14 21h7" />
      <path d="M17 17h4" />
    </svg>
  ),
  materials: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9 12 3l6 6-6 12L6 9Z" />
      <path d="M3 9h18" />
    </svg>
  ),
  service: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  resale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12l2 2 4-4" />
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  ),
}

const CARDS: Card[] = [
  {
    title: "QR verification",
    body: "Customers can scan and verify key piece details instantly.",
    icon: Icon.qr,
  },
  {
    title: "Materials & provenance",
    body: "Record metals, stones, sourcing details, craftsmanship, and item history.",
    icon: Icon.materials,
  },
  {
    title: "Service history",
    body: "Attach repairs, resizing, cleaning, inspections, and aftercare records to the piece.",
    icon: Icon.service,
  },
  {
    title: "Resale confidence",
    body: "Support trust beyond the original sale with a record that stays connected to the jewellery.",
    icon: Icon.resale,
  },
]

export default function LandingDigitalPassport() {
  return (
    <section
      id="digital-passport"
      className={`bg-m-ivory ${SECTION_PADDING.premium}`}
      aria-labelledby="digital-passport-heading"
    >
      <div className={CONTAINER.wide}>
        {/* Intro */}
        <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
          <span className={HEADING.eyebrow}>
            Digital Passport
          </span>
          <h2
            id="digital-passport-heading"
            className={HEADING.h2}
          >
            Give every piece a digital identity
          </h2>
          <p className={`${HEADING.subhead} max-w-[700px] mx-auto`}>
            Create QR-verifiable digital passports that connect each eligible
            piece to its materials, provenance, craftsmanship, service history,
            and aftercare journey.
          </p>
        </div>

        {/* Two-column: passport visual left, cards right */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-center">

          {/* LEFT — Luxury passport visual */}
          <div className="order-2 lg:order-1">
            <PassportVisual />
          </div>

          {/* RIGHT — 4 cards stacked */}
          <ul role="list" className="order-1 lg:order-2 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {CARDS.map((c) => (
              <li
                key={c.title}
                className={`group relative flex flex-col ${CARD.base} ${CARD.paddingStandard} ${CARD.hover}`}
              >
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#F1E9D8] text-m-charcoal mb-4"
                  aria-hidden="true"
                >
                  <span className="block" style={{ width: "18px", height: "18px" }}>
                    {c.icon}
                  </span>
                </span>

                <h3 className="font-serif text-m-charcoal text-[1.1rem] md:text-[1.2rem] leading-[1.25] mb-2.5">
                  {c.title}
                </h3>

                <p className="text-m-text-secondary text-[0.93rem] leading-[1.55]">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ============================================
// Passport Visual — luxury jewellery record card
// All SVG/HTML, no external assets needed
// ============================================
function PassportVisual() {
  return (
    <div className="relative mx-auto max-w-[440px]">
      {/* Soft ambient glow behind card */}
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-[40px] blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(201,162,74,0.18), transparent 60%)",
        }}
      />

      <div className="relative rounded-3xl bg-gradient-to-br from-[#FAF6EC] to-[#F1E9D8] border border-[#E4DBC9] p-7 md:p-8 shadow-[0_30px_80px_-30px_rgba(60,40,20,0.25)]">
        {/* Decorative corner ornaments */}
        <CornerOrnament className="absolute top-3 left-3" />
        <CornerOrnament className="absolute top-3 right-3 rotate-90" />
        <CornerOrnament className="absolute bottom-3 left-3 -rotate-90" />
        <CornerOrnament className="absolute bottom-3 right-3 rotate-180" />

        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-5 border-b border-[#E4DBC9]">
          <div>
            <div className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#8A8276] mb-1.5">
              Digital Passport
            </div>
            <div className="font-serif text-m-charcoal text-[1.1rem] leading-tight">
              Maison Jové
            </div>
          </div>
          <div className="text-right">
            <div className="font-sans text-[0.65rem] uppercase tracking-[0.18em] text-[#8A8276] mb-1.5">
              Verified
            </div>
            <div className="inline-flex items-center gap-1.5 font-sans text-[0.78rem] text-[#5A7A4F]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Authenticated
            </div>
          </div>
        </div>

        {/* Item identity */}
        <div className="mb-6">
          <div className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#8A8276] mb-2">
            Piece
          </div>
          <div className="font-serif text-m-charcoal text-[1.5rem] leading-[1.15] mb-1">
            Solitaire Engagement Ring
          </div>
          <div className="font-sans text-[0.85rem] text-[#5A554C]">
            Reference · NX-EN-04219
          </div>
        </div>

        {/* QR + key facts */}
        <div className="grid grid-cols-[auto_1fr] gap-5 mb-6">
          <QRCodeMark />
          <div className="space-y-2.5 text-[0.85rem]">
            <PassportRow label="Metal" value="18ct White Gold · 4.2g" />
            <PassportRow label="Centre Stone" value="1.04ct Round Brilliant" />
            <PassportRow label="Clarity / Colour" value="VS1 · F" />
            <PassportRow label="Origin" value="Botswana · Ethically Sourced" />
          </div>
        </div>

        {/* Service history */}
        <div className="mb-6 pt-5 border-t border-[#E4DBC9]">
          <div className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#8A8276] mb-3">
            Service History
          </div>
          <div className="space-y-2">
            <ServiceRow date="14 Mar 2026" label="Professional clean & inspection" />
            <ServiceRow date="22 Sep 2025" label="Resize · L → N" />
            <ServiceRow date="08 Feb 2025" label="Original handover" />
          </div>
        </div>

        {/* Aftercare */}
        <div className="pt-5 border-t border-[#E4DBC9]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#8A8276] mb-0.5">
                Next Aftercare
              </div>
              <div className="font-serif text-m-charcoal text-[0.95rem]">
                Complimentary clean · Sep 2026
              </div>
            </div>
            <div className="text-right">
              <div className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#8A8276] mb-0.5">
                Issued
              </div>
              <div className="font-sans text-[0.85rem] text-m-charcoal">08.02.2025</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PassportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#E4DBC9]/60 pb-2 last:border-none last:pb-0">
      <span className="font-sans text-[0.7rem] uppercase tracking-[0.16em] text-[#8A8276] flex-shrink-0">
        {label}
      </span>
      <span className="font-sans text-m-charcoal text-right">{value}</span>
    </div>
  )
}

function ServiceRow({ date, label }: { date: string; label: string }) {
  return (
    <div className="flex items-center gap-3 text-[0.85rem]">
      <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-[#C9A24A] flex-shrink-0" />
      <span className="font-sans text-[#8A8276] tabular-nums w-[88px] flex-shrink-0">
        {date}
      </span>
      <span className="font-sans text-m-charcoal">{label}</span>
    </div>
  )
}

function CornerOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C9A24A"
      strokeWidth="1"
      strokeLinecap="round"
      className={`w-5 h-5 opacity-50 ${className}`}
      aria-hidden="true"
    >
      <path d="M2 8V2h6" />
      <path d="M5 5l3 3" />
    </svg>
  )
}

// Stylised QR code — purely decorative, evokes a real QR without being one
function QRCodeMark() {
  return (
    <div className="relative w-[110px] h-[110px] rounded-xl bg-white border border-[#E4DBC9] p-2.5 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full" aria-label="QR code">
        {/* Position markers */}
        <rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="#1A1A1A" strokeWidth="3" />
        <rect x="8" y="8" width="8" height="8" rx="1.5" fill="#1A1A1A" />
        <rect x="58" y="2" width="20" height="20" rx="3" fill="none" stroke="#1A1A1A" strokeWidth="3" />
        <rect x="64" y="8" width="8" height="8" rx="1.5" fill="#1A1A1A" />
        <rect x="2" y="58" width="20" height="20" rx="3" fill="none" stroke="#1A1A1A" strokeWidth="3" />
        <rect x="8" y="64" width="8" height="8" rx="1.5" fill="#1A1A1A" />

        {/* Data dots — pseudo-random pattern */}
        <g fill="#1A1A1A">
          <rect x="28" y="4" width="3" height="3" rx="0.5" />
          <rect x="34" y="4" width="3" height="3" rx="0.5" />
          <rect x="44" y="4" width="3" height="3" rx="0.5" />
          <rect x="50" y="4" width="3" height="3" rx="0.5" />
          <rect x="28" y="10" width="3" height="3" rx="0.5" />
          <rect x="40" y="10" width="3" height="3" rx="0.5" />
          <rect x="48" y="10" width="3" height="3" rx="0.5" />
          <rect x="32" y="16" width="3" height="3" rx="0.5" />
          <rect x="38" y="16" width="3" height="3" rx="0.5" />
          <rect x="46" y="16" width="3" height="3" rx="0.5" />
          <rect x="52" y="16" width="3" height="3" rx="0.5" />

          <rect x="4" y="28" width="3" height="3" rx="0.5" />
          <rect x="10" y="28" width="3" height="3" rx="0.5" />
          <rect x="16" y="28" width="3" height="3" rx="0.5" />
          <rect x="26" y="28" width="3" height="3" rx="0.5" />
          <rect x="34" y="28" width="3" height="3" rx="0.5" />
          <rect x="42" y="28" width="3" height="3" rx="0.5" />
          <rect x="50" y="28" width="3" height="3" rx="0.5" />
          <rect x="58" y="28" width="3" height="3" rx="0.5" />
          <rect x="66" y="28" width="3" height="3" rx="0.5" />
          <rect x="72" y="28" width="3" height="3" rx="0.5" />

          <rect x="4" y="34" width="3" height="3" rx="0.5" />
          <rect x="14" y="34" width="3" height="3" rx="0.5" />
          <rect x="22" y="34" width="3" height="3" rx="0.5" />
          <rect x="30" y="34" width="3" height="3" rx="0.5" />
          <rect x="38" y="34" width="3" height="3" rx="0.5" />
          <rect x="46" y="34" width="3" height="3" rx="0.5" />
          <rect x="56" y="34" width="3" height="3" rx="0.5" />
          <rect x="64" y="34" width="3" height="3" rx="0.5" />
          <rect x="74" y="34" width="3" height="3" rx="0.5" />

          <rect x="8" y="40" width="3" height="3" rx="0.5" />
          <rect x="20" y="40" width="3" height="3" rx="0.5" />
          <rect x="28" y="40" width="3" height="3" rx="0.5" />
          <rect x="36" y="40" width="3" height="3" rx="0.5" />
          <rect x="44" y="40" width="3" height="3" rx="0.5" />
          <rect x="54" y="40" width="3" height="3" rx="0.5" />
          <rect x="62" y="40" width="3" height="3" rx="0.5" />
          <rect x="70" y="40" width="3" height="3" rx="0.5" />

          <rect x="4" y="46" width="3" height="3" rx="0.5" />
          <rect x="12" y="46" width="3" height="3" rx="0.5" />
          <rect x="22" y="46" width="3" height="3" rx="0.5" />
          <rect x="32" y="46" width="3" height="3" rx="0.5" />
          <rect x="40" y="46" width="3" height="3" rx="0.5" />
          <rect x="50" y="46" width="3" height="3" rx="0.5" />
          <rect x="60" y="46" width="3" height="3" rx="0.5" />
          <rect x="68" y="46" width="3" height="3" rx="0.5" />

          <rect x="28" y="58" width="3" height="3" rx="0.5" />
          <rect x="36" y="58" width="3" height="3" rx="0.5" />
          <rect x="44" y="58" width="3" height="3" rx="0.5" />
          <rect x="52" y="58" width="3" height="3" rx="0.5" />
          <rect x="60" y="58" width="3" height="3" rx="0.5" />
          <rect x="68" y="58" width="3" height="3" rx="0.5" />
          <rect x="74" y="58" width="3" height="3" rx="0.5" />

          <rect x="32" y="64" width="3" height="3" rx="0.5" />
          <rect x="40" y="64" width="3" height="3" rx="0.5" />
          <rect x="48" y="64" width="3" height="3" rx="0.5" />
          <rect x="58" y="64" width="3" height="3" rx="0.5" />
          <rect x="66" y="64" width="3" height="3" rx="0.5" />

          <rect x="28" y="70" width="3" height="3" rx="0.5" />
          <rect x="36" y="70" width="3" height="3" rx="0.5" />
          <rect x="46" y="70" width="3" height="3" rx="0.5" />
          <rect x="54" y="70" width="3" height="3" rx="0.5" />
          <rect x="62" y="70" width="3" height="3" rx="0.5" />
          <rect x="72" y="70" width="3" height="3" rx="0.5" />
        </g>
      </svg>
    </div>
  )
}
