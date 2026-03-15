export const revalidate = 60;

const features = [
  "Full item specifications & provenance",
  "Purchase & service history",
  "Digital customer access",
  "QR-code certificate links",
];

export default function ReviewPassportsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Jewellery Passports</h1>
        <p className="text-sm text-stone-400 mt-0.5">Permanent ownership records for high-value pieces</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">About this module</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          Jewellery Passports are permanent ownership records for high-value pieces — capturing full specifications,
          provenance, purchase details, and service history. Customers receive a digital passport they can access anytime,
          providing lasting confidence in the authenticity and value of their jewellery.
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
        <p className="text-sm font-medium text-stone-500">No passport records in demo tenant</p>
        <p className="text-xs text-stone-400 mt-1">
          No passport records have been seeded in this review tenant. This module is available in the full product.
        </p>
      </div>
    </div>
  );
}
