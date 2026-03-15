export const revalidate = 60;

const features = [
  "Item tracking with status",
  "Due-back date reminders",
  "Memo-to-sale conversion",
  "Full audit trail",
];

export default function ReviewMemoPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Memo &amp; Consignment</h1>
        <p className="text-sm text-stone-400 mt-0.5">Goods held on memo — not yet sold</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">About this module</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          Memo &amp; Consignment tracks jewellery items sent to customers or other jewellers on a memo basis —
          goods are held but not yet sold. Nexpura tracks memo item status, due-back dates, and converts to sale
          or return when resolved.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="text-amber-600">✓</span> {f}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-stone-50 rounded-xl border border-dashed border-stone-200 p-8 text-center">
        <p className="text-sm font-medium text-stone-500">No memo records in this demo tenant</p>
        <p className="text-xs text-stone-400 mt-1">
          This module is available in the full product. No memo records have been seeded in this review tenant.
        </p>
      </div>
    </div>
  );
}
