export const revalidate = 60;

const features = [
  "Insurance valuation certificates",
  "PDF export & email delivery",
  "Metal & stone specification capture",
  "Photo documentation",
];

export default function ReviewAppraisalsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Appraisals</h1>
        <p className="text-sm text-stone-400 mt-0.5">Insurance &amp; valuation certificates</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">About this module</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          The Appraisals module lets you generate formal insurance valuation certificates for customer jewellery.
          Each appraisal records item details, photographs, metal and stone specifications, and a certified replacement value.
          Certificates can be emailed directly to customers or exported as PDF.
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
        <p className="text-sm font-medium text-stone-500">No appraisal records in demo tenant</p>
        <p className="text-xs text-stone-400 mt-1">
          This module is available in the full product. No appraisal records have been seeded in this review tenant.
        </p>
      </div>
    </div>
  );
}
