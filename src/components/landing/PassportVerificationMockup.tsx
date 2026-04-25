/**
 * PassportVerificationMockup — purely decorative recreation of the
 * customer-facing passport verification screen, used inside the
 * "See Nexpura in action" Passport tab (Kaitlyn Fix #4).
 *
 * The previous Passport tab rendered the bespoke / admin dashboard
 * screenshot, which set wrong expectations about what a "Digital
 * Passport" surface looks like to the customer. This mockup recreates
 * the actual public-facing /verify-style screen: NEXPURA wordmark,
 * eyebrow, serif headline, subheading, IDENTITY NUMBER input, primary
 * "Verify Passport" button, divider, and Authentic / Secure trust row.
 *
 * The input + button are decorative only — `readOnly`, `tabIndex={-1}`,
 * `aria-hidden`. They are never wired to a form; they only exist to
 * make the panel visually read as a verification page.
 */
export default function PassportVerificationMockup() {
  return (
    <div className="bg-white border border-[#E8E1D6] rounded-[24px] shadow-[0_24px_60px_rgba(0,0,0,0.08)] overflow-hidden px-8 py-12 sm:px-8 sm:py-12 min-h-[460px] sm:min-h-[520px] w-full flex items-center justify-center">
      <div className="w-full max-w-[520px] flex flex-col items-center text-center">
        <div className="font-serif text-[22px] font-medium tracking-[0.32em] text-m-charcoal mb-9">
          NEXPURA
        </div>

        <div className="text-[12px] tracking-[0.18em] uppercase text-[#A7A19A] font-medium mb-4">
          Passport Verification
        </div>

        <h3 className="font-serif text-[32px] sm:text-[44px] font-normal leading-[1.05] text-m-charcoal m-0 mb-[18px]">
          Verify Your Jewellery Passport
        </h3>

        <p className="text-[16px] leading-[1.55] text-[#6A6A6A] max-w-[460px] m-0 mb-8">
          Enter the passport identity number to confirm authenticity and view the full certificate.
        </p>

        <div className="w-full flex flex-col items-stretch mb-[14px]">
          <label
            className="text-[11px] tracking-[0.14em] uppercase text-[#A7A19A] font-medium mb-2.5 text-left"
            htmlFor="passport-id-mock"
          >
            Identity Number
          </label>
          <input
            id="passport-id-mock"
            type="text"
            placeholder="e.g. 100000001"
            className="w-full h-[60px] border border-[#E4DED4] rounded-[16px] bg-white px-5 text-[16px] text-m-charcoal outline-none placeholder:text-[#C4BDB3]"
            readOnly
            tabIndex={-1}
            aria-hidden
          />
        </div>

        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="w-full h-[60px] rounded-full bg-m-charcoal text-white text-[15px] font-semibold border-0 shadow-[0_8px_20px_rgba(0,0,0,0.12)] mb-7 cursor-default"
        >
          Verify Passport
        </button>

        <div className="w-full h-px bg-[#EFEAE1] mb-[18px]" />

        <div className="flex items-center gap-3.5 text-[13px] text-[#A7A19A]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldIcon /> Authentic
          </span>
          <span className="text-[#D8D2C7]">|</span>
          <span className="inline-flex items-center gap-1.5">
            <LockIcon /> Secure
          </span>
        </div>
      </div>
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A7A19A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A7A19A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
