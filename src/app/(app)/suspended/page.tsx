import Link from "next/link";

export const metadata = { title: "Account Suspended — Nexpura" };

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-10 text-center max-w-md w-full">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Account Suspended</h1>
        <p className="text-stone-500 mb-6 leading-relaxed">
          Your Nexpura account has been suspended due to a payment issue. 
          Please update your payment method to restore access.
        </p>
        <p className="text-stone-400 text-sm mb-6">
          Your data is safe and will be kept for 90 days.
        </p>
        <Link
          href="/billing"
          className="inline-block w-full py-3 bg-[#52B788] text-white rounded-xl font-semibold hover:bg-[#3d9068] transition-colors"
        >
          Update Payment Method
        </Link>
        <p className="text-xs text-stone-400 mt-4">
          Questions? Contact <a href="mailto:support@nexpura.com" className="text-amber-700 hover:underline">support@nexpura.com</a>
        </p>
      </div>
    </div>
  );
}
