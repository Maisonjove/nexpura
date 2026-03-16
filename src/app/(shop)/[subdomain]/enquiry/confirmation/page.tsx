import Link from "next/link";

export const metadata = { title: "Enquiry Received" };

export default async function EnquiryConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ ref?: string; name?: string; type?: string }>;
}) {
  const { subdomain } = await params;
  const sp = await searchParams;
  const name = sp.name ?? "";
  const ref = sp.ref ?? "";
  const type = sp.type ?? "custom";

  const isCustom = type === "custom" || type === "bespoke";

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 bg-amber-700/10 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">💎</span>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">
            {isCustom ? "Custom Enquiry Received" : "Enquiry Received"}
          </h1>
          <p className="text-stone-500">
            {name ? `Thank you, ${name}! Your` : "Your"}{" "}
            {isCustom ? "custom jewellery enquiry" : "enquiry"} has been submitted.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-left space-y-3">
          {ref && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-stone-500">Reference</span>
              <span className="text-sm font-mono font-semibold text-amber-700">{ref}</span>
            </div>
          )}
          <div className="border-t border-stone-100 pt-3">
            <p className="text-sm text-stone-500">
              {isCustom
                ? "One of our designers will review your brief and reach out within 2–3 business days to discuss your vision and provide an initial quote."
                : "We've received your enquiry and will get back to you within 1–2 business days."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={`/${subdomain}`}
            className="inline-block px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-[#7a6447] transition-colors"
          >
            Back to Store
          </Link>
          {isCustom && (
            <p className="text-xs text-stone-400">
              Interested in browsing our collection while you wait?{" "}
              <Link href={`/${subdomain}/catalogue`} className="text-amber-700 hover:underline">
                View catalogue →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
