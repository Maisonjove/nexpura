'use client'

// ============================================
// "Ask Nexpura what needs attention" — flagship AI section
// Per Kaitlyn 2026-04-26 brief. Verbatim from spec except:
//  - "use client" added (uses useState + onClick)
//  - inline <style> keyframe block removed; the response paragraph
//    now references a uniquely-named keyframe (nxFadeInUpAI, 8px)
//    added to globals.css. This avoids stomping the existing
//    @keyframes fadeInUp (16px translate) used elsewhere on the
//    landing page.
// ============================================

import { useState } from "react"

type Prompt = {
  id: string
  question: string
  output: string
}

const PROMPTS: Prompt[] = [
  {
    id: "overdue-repairs",
    question: "Which repairs are overdue this week?",
    output:
      "7 repairs are overdue. 3 are assigned to workshop, 2 are waiting on customer approval, and 2 are ready but not collected.",
  },
  {
    id: "slow-stock",
    question: "What stock has not moved in 90 days?",
    output:
      "12 pieces have had no movement in 90 days. 4 are high-value items and 3 are currently reserved.",
  },
  {
    id: "customer-summary",
    question: "Summarise this customer before their appointment.",
    output:
      "Customer has purchased 2 diamond pieces, completed 1 resize, and has an active bespoke enquiry.",
  },
  {
    id: "draft-update",
    question: "Draft a repair update message.",
    output:
      "Hi Sarah, your ring repair is now in polishing and is expected to be ready by Friday.",
  },
  {
    id: "sales-summary",
    question: "What changed in sales this month?",
    output:
      "Sales are up 12%, but average order value is down 6%. Bridal enquiries increased across two locations.",
  },
]

export default function LandingAICopilot() {
  const [activeId, setActiveId] = useState<string>(PROMPTS[0].id)
  const active = PROMPTS.find((p) => p.id === activeId)!

  return (
    <section
      id="ai-copilot"
      className="bg-m-ivory px-6 py-20 md:py-24 lg:py-28"
      aria-labelledby="ai-copilot-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
          <span className="inline-block font-sans text-[0.78rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
            AI Copilot
          </span>
          <h2
            id="ai-copilot-heading"
            className="font-serif text-m-charcoal text-[1.85rem] leading-[1.15] tracking-[-0.005em] md:text-[2.4rem]"
          >
            Ask Nexpura what needs attention
          </h2>
          <p className="mt-5 text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.55] max-w-[680px] mx-auto">
            The AI Copilot helps jewellers turn daily operational data into
            clear next steps across repairs, stock, customers, bespoke jobs,
            and sales performance.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-8 lg:gap-10 items-stretch">

          {/* LEFT — Dark AI chat panel */}
          <div
            className="relative rounded-3xl overflow-hidden bg-[#0E0E10] border border-white/5 p-7 md:p-9 flex flex-col min-h-[480px]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 0%, rgba(201, 162, 74, 0.08), transparent 50%), radial-gradient(circle at 100% 100%, rgba(201, 162, 74, 0.05), transparent 60%)",
            }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="relative inline-flex w-2 h-2 rounded-full bg-[#C9A24A]">
                  <span className="absolute inset-0 rounded-full bg-[#C9A24A] animate-ping opacity-60" />
                </span>
                <span className="font-sans text-[0.82rem] uppercase tracking-[0.18em] text-white/60">
                  Nexpura Copilot
                </span>
              </div>
              <span className="font-sans text-[0.78rem] text-white/40">
                Live data · just now
              </span>
            </div>

            {/* User question bubble */}
            <div className="mb-6">
              <div className="font-sans text-[0.72rem] uppercase tracking-[0.16em] text-white/40 mb-2">
                You
              </div>
              <p className="font-serif text-white text-[1.15rem] md:text-[1.3rem] leading-[1.4]">
                {active.question}
              </p>
            </div>

            {/* AI response */}
            <div className="mb-auto">
              <div className="font-sans text-[0.72rem] uppercase tracking-[0.16em] text-[#C9A24A] mb-2">
                Nexpura
              </div>
              <p
                key={active.id}
                className="text-white/85 text-[1rem] md:text-[1.05rem] leading-[1.65] animate-[nxFadeInUpAI_400ms_ease-out]"
              >
                {active.output}
              </p>
            </div>

            {/* Glowing input row */}
            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="relative flex items-center gap-3 rounded-full bg-white/[0.04] border border-white/10 px-5 py-3.5 transition-all duration-300 focus-within:border-[#C9A24A]/60 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_4px_rgba(201,162,74,0.08),0_0_40px_-10px_rgba(201,162,74,0.4)]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-white/40 flex-shrink-0"
                  aria-hidden="true"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <input
                  type="text"
                  placeholder="Ask Nexpura anything about your business…"
                  aria-label="Ask Nexpura"
                  readOnly
                  className="flex-1 bg-transparent border-none outline-none text-white/90 placeholder-white/35 text-[0.95rem] font-sans"
                />
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#C9A24A] text-[#0E0E10]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT — Prompt cards */}
          <div className="flex flex-col gap-3">
            <div className="font-sans text-[0.78rem] uppercase tracking-[0.18em] text-[#8A8276] mb-1">
              Try a prompt
            </div>
            {PROMPTS.map((p) => {
              const isActive = p.id === activeId
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  aria-pressed={isActive}
                  className={`
                    group text-left rounded-2xl border p-5
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-[#0E0E10] border-[#0E0E10] text-white"
                        : "bg-white/60 border-[#E4DBC9] text-m-charcoal hover:border-[#C9BFA9] hover:bg-white/80"
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`
                        mt-0.5 inline-flex items-center justify-center
                        w-6 h-6 rounded-full flex-shrink-0
                        text-[0.7rem] font-medium
                        transition-colors duration-200
                        ${
                          isActive
                            ? "bg-[#C9A24A] text-[#0E0E10]"
                            : "bg-[#F1E9D8] text-m-charcoal group-hover:bg-[#E8DEC4]"
                        }
                      `}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                    <span className={`text-[0.95rem] leading-[1.45] ${isActive ? "text-white" : "text-m-charcoal"}`}>
                      {p.question}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
