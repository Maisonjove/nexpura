'use client'

import { useState, useId } from 'react'
import SectionHeader from './ui/SectionHeader'

/**
 * FAQ accordion per Kaitlyn's brief (section 17). 10 items, single-
 * open mode, plus icon rotates 45° to become × on open. Champagne
 * left border + subtle warm tint on the active item. Keyboard
 * accessible (Tab → focus, Enter/Space toggle, ARIA expanded/controls).
 */

interface FaqItem {
  q: string
  a: string
}

const FAQS: readonly FaqItem[] = [
  {
    q: 'How long does migration take?',
    a: 'Migration time depends on your current setup, the amount of data being imported, and the workflows your business needs. Nexpura supports guided migration to make the process structured and manageable.',
  },
  {
    q: 'Is migration included?',
    a: 'Guided migration support is available to help you move key customer, inventory, repair, and business data into Nexpura.',
  },
  {
    q: 'Can Nexpura replace my current POS?',
    a: 'Nexpura is designed to centralise jewellery retail workflows, including POS, inventory, customers, repairs, bespoke orders, and reporting. The exact setup depends on your current tools and business needs.',
  },
  {
    q: 'Does it support repair job tracking?',
    a: 'Yes. Nexpura lets teams log repairs, add details and photos, assign staff, track statuses, manage due dates, and record collection readiness.',
  },
  {
    q: 'Can I track bespoke orders?',
    a: 'Yes. The bespoke workflow keeps quotes, notes, photos, milestones, approvals, deposits, and sourcing decisions connected to the customer record from enquiry through to handover.',
  },
  {
    q: 'Can I manage multiple locations?',
    a: 'Nexpura centralises stock, customers, reporting, and visibility across every location, with per-location filtering on dashboards and inventory views.',
  },
  {
    q: 'What is a digital passport?',
    a: 'A QR-verifiable record attached to a piece — covering authenticity, materials, provenance, and service history. Customers can scan to verify, and the passport stays with the piece across resale and aftercare.',
  },
  {
    q: 'Can my team be trained?',
    a: 'Guided onboarding helps your staff understand Nexpura quickly. Practical walkthroughs cover the modules each role uses day-to-day, with continued support after go-live.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. The primary way to explore Nexpura is through a free trial, with guided setup and demo support available if needed.',
  },
  {
    q: 'Can I book a demo instead?',
    a: 'Yes. If you would like a guided walkthrough of how Nexpura fits your business, the team can map your current workflows and show the relevant modules in a personalised session.',
  },
] as const

export default function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0)
  const baseId = useId()

  return (
    <section className="bg-m-ivory py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[800px] mx-auto">
        <SectionHeader
          title="Questions about switching to Nexpura"
          subtitle="Everything you need to know before moving your jewellery workflows into one connected platform."
        />

        <div className="mt-14">
          {FAQS.map((faq, i) => {
            const isOpen = open === i
            const headingId = `${baseId}-h-${i}`
            const panelId = `${baseId}-p-${i}`
            return (
              <div
                key={faq.q}
                className={`border-t border-m-border-soft last:border-b transition-colors duration-200 ${
                  isOpen
                    ? 'bg-[#FDFAF4] border-l-[3px] border-l-m-champagne'
                    : 'border-l-[3px] border-l-transparent'
                }`}
              >
                <h3 id={headingId} className="m-0">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full flex items-center justify-between gap-6 py-6 px-4 sm:px-5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne rounded"
                  >
                    <span className="font-serif text-[18px] sm:text-[20px] text-m-charcoal leading-[1.3]">
                      {faq.q}
                    </span>
                    <span
                      aria-hidden
                      className={`shrink-0 w-6 h-6 flex items-center justify-center text-m-text-secondary transition-transform duration-[200ms] [transition-timing-function:var(--m-ease)] ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M8 2v12M2 8h12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={headingId}
                  className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-[250ms] [transition-timing-function:var(--m-ease)]"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="min-h-0">
                    <p className="text-[15px] leading-[1.6] text-m-text-secondary pb-7 px-4 sm:px-5 max-w-[680px]">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
