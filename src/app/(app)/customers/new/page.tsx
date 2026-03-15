import Link from "next/link";
import CustomerForm from "../CustomerForm";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={returnTo || "/customers"}
          className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:border-stone-900/30 hover:text-stone-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-semibold text-2xl font-semibold text-stone-900">New Customer</h1>
          <p className="text-stone-500 mt-0.5 text-sm">Add a new customer to your database</p>
        </div>
      </div>

      <CustomerForm mode="create" returnTo={returnTo} />
    </div>
  );
}
