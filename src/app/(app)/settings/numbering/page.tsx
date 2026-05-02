import { AlertTriangle } from "lucide-react";
import { getSequenceInfo } from "./actions";
import NumberingClient from "./NumberingClient";

export default async function NumberingPage() {
  const { data, error } = await getSequenceInfo();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-[28px] leading-tight text-nexpura-charcoal">Numbering Sequences</h1>
        <p className="text-nexpura-charcoal-500 mt-1 text-sm">
          Configure the starting number for each document type.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          Failed to load sequence info: {error}
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-3 bg-nexpura-champagne/40 border border-nexpura-taupe-100 rounded-xl px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-nexpura-charcoal-700 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-sm text-nexpura-charcoal-700">
          <strong>Warning:</strong> Setting a lower number than the current highest may cause duplicate document numbers.
          Always set a number <em>higher</em> than your current maximum.
        </p>
      </div>

      <NumberingClient initialData={data} />
    </div>
  );
}
