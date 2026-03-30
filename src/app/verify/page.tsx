"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    
    // Navigate to the verify page with the identity number
    router.push(`/verify/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-[#F8F5F0]">
      {/* Hero strip */}
      <div className="bg-[#071A0D] text-white px-4 py-12 text-center">
        <h1 className="font-semibold text-3xl sm:text-4xl font-bold tracking-tight">nexpura</h1>
        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-2">Digital Jewellery Passport Verification</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Main card */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-8 shadow-sm">
          {/* Shield icon */}
          <div className="w-16 h-16 rounded-full bg-[#52B788]/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#52B788]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-[#071A0D] text-center mb-2">
            Verify Your Jewellery Passport
          </h2>
          <p className="text-gray-500 text-center text-sm mb-8">
            Enter the passport identity number to verify authenticity and view details
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identity" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Passport Identity Number
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
                className="w-full px-4 py-3 text-lg font-mono text-center border border-[#E8E8E8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent transition-all"
              />
              {error && (
                <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full py-3.5 bg-[#071A0D] text-white font-semibold rounded-xl hover:bg-[#0a2614] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Verify Passport
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E8E8E8]">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              Every jewellery piece registered with Nexpura receives a unique identity number. 
              This verification confirms the passport was issued by an authorized jeweller on our platform.
            </p>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[#071A0D] mb-1">Authentic</h3>
            <p className="text-xs text-gray-500">Verified passports are issued by trusted jewellers</p>
          </div>

          <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[#071A0D] mb-1">Secure</h3>
            <p className="text-xs text-gray-500">Blockchain-level tamper protection</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-semibold text-[#071A0D]">Nexpura</span> · The trusted jewellery passport platform
          </p>
        </div>
      </div>
    </div>
  );
}
