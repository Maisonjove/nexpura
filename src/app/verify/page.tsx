"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeBlur = {
  initial: { opacity: 0, filter: "blur(6px)" },
  animate: { opacity: 1, filter: "blur(0px)" },
  transition: { duration: 1.2, ease: EASE },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, filter: "blur(4px)", y: 16 },
  animate: { opacity: 1, filter: "blur(0px)", y: 0 },
  transition: { duration: 1.2, ease: EASE, delay },
});

/**
 * Customer-facing passport verification — restyled to match the homepage
 * PassportVerificationMockup aesthetic per Kaitlyn brief #2 Section 10E.
 *
 * Batch 2 (2026-04-28): added empty-state explainer card, polished
 * loading/error microcopy, and updated placeholder + microcopy per
 * spec. NO behavioural change — `name`/`id`/`type`/submit handler /
 * router push are all preserved. Only the surrounding visual chrome
 * + microcopy were touched.
 */
export default function VerifyPassportPage() {
  const router = useRouter();
  const [identityNumber, setIdentityNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = identityNumber.trim();
    if (!trimmed) {
      setError("Please enter your passport identity number to verify it.");
      return;
    }

    setIsSearching(true);
    router.push(`/verify/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-m-ivory flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl border-b border-m-border-soft bg-[rgba(250,247,242,0.78)]">
        <nav className="flex items-center justify-center max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-20 h-[72px]">
          <Link
            href="/"
            className="font-serif text-[1.5rem] tracking-[0.32em] text-m-charcoal transition-opacity duration-200 hover:opacity-70"
          >
            NEXPURA
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-[72px]">
        <div className="w-full max-w-[560px] text-center py-20 lg:py-24">
          <motion.p
            {...fadeUp()}
            className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-4"
          >
            Passport Verification
          </motion.p>

          <motion.h1
            {...fadeBlur}
            className="font-serif text-[32px] sm:text-[44px] font-normal leading-[1.05] text-m-charcoal mb-[18px]"
          >
            Verify Your Jewellery Passport
          </motion.h1>

          <motion.p
            {...fadeUp(0.3)}
            className="text-[16px] leading-[1.55] text-[#6A6A6A] max-w-[480px] mx-auto mb-10"
          >
            Confirm a piece is recorded in the jeweller&apos;s system and view
            its public certificate.
          </motion.p>

          {/* Empty-state explainer card — Batch 2.
              Sits above the form to set expectations before the user
              types anything. Three short bullets, no icons clutter. */}
          <motion.div
            {...fadeUp(0.4)}
            className="text-left bg-white/70 border border-m-border-soft rounded-[18px] p-6 mb-8 shadow-[0_2px_8px_-4px_rgba(60,40,20,0.08)]"
          >
            <p className="text-[12px] tracking-[0.18em] uppercase text-m-text-faint font-medium mb-3">
              What verification does
            </p>
            <ul role="list" className="space-y-2.5 text-[14px] leading-[1.55] text-m-text-secondary">
              {[
                "Confirms a passport is genuine and registered.",
                "Shows the public record of the piece — materials, provenance, service history.",
                "Never exposes the customer's private details.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mt-0.5 text-[#C9A24A] flex-shrink-0" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Form */}
          <motion.form onSubmit={handleSubmit} {...fadeUp(0.5)} className="space-y-3">
            <div className="text-left">
              <label htmlFor="identity" className="m-form-label">
                Passport identity number
              </label>
              <input
                id="identity"
                name="identity"
                type="text"
                placeholder="NX-EN-04219"
                value={identityNumber}
                onChange={(e) => {
                  setIdentityNumber(e.target.value);
                  setError(null);
                }}
                className="m-form-input h-[60px] rounded-[16px] tracking-wider"
                autoComplete="off"
                aria-describedby="identity-help identity-error"
              />
              <p id="identity-help" className="text-[13px] text-m-text-muted mt-2 leading-[1.55]">
                You can find this number on your digital passport, QR
                certificate, receipt, or aftercare email.
              </p>
              {error && (
                <p id="identity-error" role="alert" className="m-form-error mt-2">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full h-[60px] rounded-full bg-m-charcoal text-white text-[15px] font-semibold border-0 shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 hover:bg-m-charcoal-soft transition-all duration-200 [transition-timing-function:var(--m-ease)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 !mt-5"
              aria-busy={isSearching}
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Checking the record…
                </>
              ) : (
                "Verify Passport"
              )}
            </button>

            {/* Privacy note — Batch 2 spec */}
            <p className="text-[12px] italic text-m-text-faint mt-4 leading-[1.55]">
              Verification confirms the record without exposing private
              customer information.
            </p>
          </motion.form>

          {/* Trust signals */}
          <motion.div {...fadeUp(0.7)} className="mt-10 pt-8 border-t border-m-border-soft-2">
            <div className="flex items-center justify-center gap-3.5 text-[13px] text-m-text-faint">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" />
                </svg>
                Authentic
              </span>
              <span className="text-[#D8D2C7]">|</span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Secure
              </span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-m-border-soft py-8 text-center">
        <p className="text-[13px] text-m-text-faint">
          Powered by{" "}
          <Link href="/" className="font-serif tracking-[0.08em] text-m-charcoal transition-opacity duration-200 hover:opacity-70">
            NEXPURA
          </Link>
        </p>
      </footer>
    </div>
  );
}
