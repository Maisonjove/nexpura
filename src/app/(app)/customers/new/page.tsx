import Link from "next/link";
import CustomerForm from "../CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/customers"
          className="w-8 h-8 rounded-lg border border-platinum flex items-center justify-center text-forest/50 hover:border-forest/30 hover:text-forest transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-fraunces text-2xl font-semibold text-forest">New Customer</h1>
          <p className="text-forest/60 mt-0.5 text-sm">Add a new customer to your database</p>
        </div>
      </div>

      <CustomerForm mode="create" />
    </div>
  );
}
