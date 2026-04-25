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
 * NO behavioural change — `name`/`id`/`type`/submit handler / router push
 * are all preserved. Only colours, typography, button, input, and the
 * heavy custom shadow are aligned to the global token system: ivory
 * background, charcoal serif headline, m-form-input + 60px charcoal
 * pill button, no neon-glow drop shadows.
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
      setError("Please enter a passport identity number");
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
        <div className="w-full max-w-[520px] text-center py-20 lg:py-28">
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
            className="text-[16px] leading-[1.55] text-[#6A6A6A] max-w-[460px] mx-auto mb-8"
          >
            Enter the passport identity number to confirm authenticity and view the full certificate.
          </motion.p>

          {/* Form */}
          <motion.form onSubmit={handleSubmit} {...fadeUp(0.5)} className="space-y-4">
            <div className="text-left">
              <label htmlFor="identity" className="m-form-label">
                Identity Number
              </label>
              <input
                id="identity"
                name="identity"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 100000001"
                value={identityNumber}
                onChange={(e) => {
                  setIdentityNumber(e.target.value);
                  setError(null);
                }}
                className="m-form-input h-[60px] rounded-[16px]"
              />
              {error && <p className="m-form-error">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full h-[60px] rounded-full bg-m-charcoal text-white text-[15px] font-semibold border-0 shadow-[0_8px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 hover:bg-m-charcoal-soft transition-all duration-200 [transition-timing-function:var(--m-ease)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying…
                </>
              ) : (
                "Verify Passport"
              )}
            </button>
          </motion.form>

          {/* Trust signals */}
          <motion.div {...fadeUp(0.7)} className="mt-12 pt-8 border-t border-m-border-soft-2">
            <div className="flex items-center justify-center gap-3.5 text-[13px] text-m-text-faint">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" />
                </svg>
                Authentic
              </span>
              <span className="text-[#D8D2C7]">|</span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
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
