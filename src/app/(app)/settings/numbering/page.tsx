import { getSequenceInfo } from "./actions";
import NumberingClient from "./NumberingClient";

export default async function NumberingPage() {
  const { data, error } = await getSequenceInfo();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Numbering Sequences</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Configure the starting number for each document type. Use this when migrating from another
          system so your new numbers continue from where you left off.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          Failed to load sequence info: {error}
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm text-amber-700">
          <strong>Warning:</strong> Setting a lower number than the current highest may cause duplicate document numbers.
          Always set a number <em>higher</em> than your current maximum.
        </p>
      </div>

      <NumberingClient initialData={data} />
    </div>
  );
}
