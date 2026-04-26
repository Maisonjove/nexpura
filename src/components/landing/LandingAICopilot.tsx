'use client'

// ============================================
// "Ask Nexpura what needs attention" — flagship AI section.
//
// Originally a static demo (Kaitlyn 2026-04-26 brief). Per Joey 2026-04-26
// the section is now LIVE — the input + prompt cards both call
// /api/ai/landing-copilot which answers Nexpura questions via OpenAI
// (gpt-4o-mini), rate-limited per IP via the Postgres "ai" bucket.
//
// Visual frame is unchanged from Kaitlyn's design (dark panel, gold
// accents, pulsing dot, glowing input). Behaviour:
//   - Initial state: a welcome message in the response slot
//   - Prompt-card click: pre-fills the input + auto-submits
//   - Input submit (Enter or arrow button): asks the API
//   - Loading: pulsing "Thinking…" placeholder
//   - Error: friendly fallback line + suggestion to email the team
//   - 429: shows rate-limit message
//   - The prompt set was rewritten from Kaitlyn's operational examples
//     (which the public bot can't answer — no tenant data) to
//     product-Q&A questions the system prompt CAN answer well.
// ============================================

import { useState, type FormEvent } from "react"
import { SECTION_PADDING, HEADING, INTRO_SPACING, CONTAINER } from "./_tokens"

type Prompt = { id: string; question: string }

const PROMPTS: Prompt[] = [
  { id: "what-is-nexpura", question: "What does Nexpura actually do?" },
  { id: "repairs", question: "How does Nexpura handle repairs?" },
  { id: "migration", question: "Can I migrate from another POS?" },
  { id: "passports", question: "How do digital passports work?" },
  { id: "trial", question: "What's included in the free trial?" },
]

const WELCOME =
  "Ask me anything about Nexpura — features, workflows, migration, pricing, the free trial. I'm here to help."

export default function LandingAICopilot() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [question, setQuestion] = useState<string>("") // last submitted
  const [answer, setAnswer] = useState<string>(WELCOME)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")

  async function ask(q: string) {
    if (status === "loading") return
    const trimmed = q.trim()
    if (trimmed.length < 2) return
    setQuestion(trimmed)
    setStatus("loading")
    setAnswer("")
    try {
      const res = await fetch("/api/ai/landing-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus("error")
        setAnswer(
          body.error ||
            "Couldn't reach the assistant. Email hello@nexpura.com or book a demo at nexpura.com/contact."
        )
        return
      }
      setStatus("idle")
      setAnswer(body.answer || "")
    } catch {
      setStatus("error")
      setAnswer(
        "Couldn't reach the assistant. Email hello@nexpura.com or book a demo at nexpura.com/contact."
      )
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void ask(input)
  }

  function handlePromptClick(p: Prompt) {
    setActiveId(p.id)
    setInput(p.question)
    void ask(p.question)
  }

  return (
    <section
      id="ai-copilot"
      className={`bg-m-ivory ${SECTION_PADDING.premium}`}
      aria-labelledby="ai-copilot-heading"
    >
      <div className={CONTAINER.wide}>
        {/* Intro */}
        <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
          <span className={HEADING.eyebrow}>AI Copilot</span>
          <h2 id="ai-copilot-heading" className={HEADING.h2}>
            Ask Nexpura what needs attention
          </h2>
          <p className={`${HEADING.subhead} max-w-[680px] mx-auto`}>
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
                {status === "loading" ? "Thinking…" : "Live · ready"}
              </span>
            </div>

            {/* User question bubble (only after first ask) */}
            {question && (
              <div className="mb-6">
                <div className="font-sans text-[0.72rem] uppercase tracking-[0.16em] text-white/40 mb-2">
                  You
                </div>
                <p className="font-serif text-white text-[1.15rem] md:text-[1.3rem] leading-[1.4]">
                  {question}
                </p>
              </div>
            )}

            {/* AI response */}
            <div className="mb-auto">
              <div className="font-sans text-[0.72rem] uppercase tracking-[0.16em] text-[#C9A24A] mb-2">
                Nexpura
              </div>
              {status === "loading" ? (
                <p
                  aria-live="polite"
                  className="text-white/60 text-[1rem] md:text-[1.05rem] leading-[1.65] animate-pulse"
                >
                  Thinking…
                </p>
              ) : (
                <p
                  // key prompts the fade-in animation on each new answer
                  key={`${question}-${answer.slice(0, 16)}`}
                  aria-live="polite"
                  className={
                    status === "error"
                      ? "text-white/85 text-[1rem] md:text-[1.05rem] leading-[1.65] animate-[nxFadeInUpAI_400ms_ease-out]"
                      : "text-white/85 text-[1rem] md:text-[1.05rem] leading-[1.65] animate-[nxFadeInUpAI_400ms_ease-out]"
                  }
                >
                  {answer}
                </p>
              )}
            </div>

            {/* Input row */}
            <form
              onSubmit={handleSubmit}
              className="mt-8 pt-6 border-t border-white/5"
              aria-label="Ask Nexpura"
            >
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
                  placeholder="Ask Nexpura anything about the platform…"
                  aria-label="Ask Nexpura"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={status === "loading"}
                  maxLength={500}
                  className="flex-1 bg-transparent border-none outline-none text-white/90 placeholder-white/35 text-[0.95rem] font-sans disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || input.trim().length < 2}
                  aria-label="Send"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#C9A24A] text-[#0E0E10] transition-opacity duration-200 hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT — Prompt cards (click to pre-fill + auto-submit) */}
          <div className="flex flex-col gap-3">
            <div className="font-sans text-[0.78rem] uppercase tracking-[0.18em] text-[#8A8276] mb-1">
              Try a prompt
            </div>
            {PROMPTS.map((p) => {
              const isActive = p.id === activeId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePromptClick(p)}
                  disabled={status === "loading"}
                  aria-pressed={isActive}
                  className={`
                    group text-left rounded-2xl border p-5
                    transition-all duration-200
                    disabled:opacity-60 disabled:cursor-not-allowed
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
