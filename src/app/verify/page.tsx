"use client";

import { useState, useRef, useCallback } from "react";
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

export default function VerifyPassportPage() {
  const router = useRouter();
  const [identityNumber, setIdentityNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.08}px, ${y * 0.15}px)`;
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    el.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "";
    const onEnd = () => {
      el.style.transition = "";
      el.removeEventListener("transitionend", onEnd);
    };
    el.addEventListener("transitionend", onEnd);
  }, []);

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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl border-b border-black/[0.04] bg-white/85">
        <nav className="flex items-center justify-center max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-20 h-[72px]">
          <Link
            href="/"
            className="font-serif text-[1.75rem] tracking-[0.12em] text-stone-900 transition-opacity duration-300 hover:opacity-70"
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
            className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-5"
          >
            Passport Verification
          </motion.p>

          <motion.h1
            {...fadeBlur}
            className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-6"
          >
            Verify Your
            <br />
            Jewellery Passport
          </motion.h1>

          <motion.p
            {...fadeUp(0.3)}
            className="text-base lg:text-lg font-normal leading-relaxed text-stone-500 max-w-[440px] mx-auto mb-12"
          >
            Enter the passport identity number to confirm authenticity and view the full certificate.
          </motion.p>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            {...fadeUp(0.5)}
            className="space-y-6"
          >
            <div>
              <label
                htmlFor="identity"
                className="block text-[0.75rem] tracking-[0.15em] text-stone-400 uppercase mb-3 font-medium"
              >
                Identity Number
              </label>
              <input
                id="identity"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 100000001"
                value={identityNumber}
                onChange={(e) => {
                  setIdentityNumber(e.target.value);
                  setError(null);
                }}
                className="w-full px-5 py-4 text-lg font-mono text-center bg-white border border-stone-200 rounded-2xl text-stone-900 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all duration-400"
              />
              {error && (
                <p className="text-red-500 text-sm mt-3">{error}</p>
              )}
            </div>

            <button
              ref={btnRef}
              type="submit"
              disabled={isSearching}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="
                inline-flex items-center justify-center gap-2
                w-full px-10 py-4
                bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
                rounded-full
                shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]
                transition-shadow duration-400
                hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]
                active:shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]
                relative overflow-hidden cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
              {isSearching ? (
                <span className="text-base font-medium text-white tracking-[0.01em] relative z-10 flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
                  Verify Passport
                </span>
              )}
            </button>
          </motion.form>

          {/* Trust signals */}
          <motion.div
            {...fadeUp(0.7)}
            className="mt-16 pt-10 border-t border-stone-100"
          >
            <div className="flex items-center justify-center gap-8">
              <div className="flex items-center gap-2 text-stone-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-[0.8125rem]">Authentic</span>
              </div>
              <div className="w-px h-4 bg-stone-200" />
              <div className="flex items-center gap-2 text-stone-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-[0.8125rem]">Secure</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] py-8 text-center">
        <p className="text-[0.8125rem] text-stone-400">
          Powered by{" "}
          <Link href="/" className="font-serif tracking-[0.08em] text-stone-900 transition-opacity duration-300 hover:opacity-70">
            NEXPURA
          </Link>
        </p>
      </footer>
    </div>
  );
}
