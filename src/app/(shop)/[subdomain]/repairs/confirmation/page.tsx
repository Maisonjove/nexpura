import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Repair Enquiry Received" };

export default async function RepairConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ ref?: string; name?: string; item?: string }>;
}) {
  const { subdomain } = await params;
  const sp = await searchParams;
  const name = sp.name ?? "";
  const ref = sp.ref ?? "";
  const item = sp.item ?? "";

  // Fetch store contact details for branding
  const admin = createAdminClient();
  const { data: config } = await admin
    .from("website_config")
    .select("business_name, tenant_id")
    .eq("subdomain", subdomain)
    .maybeSingle();
  let storePhone: string | null = null;
  let storeEmail: string | null = null;
  if (config?.tenant_id) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("phone, email")
      .eq("id", config.tenant_id)
      .maybeSingle();
    storePhone = tenant?.phone ?? null;
    storeEmail = tenant?.email ?? null;
  }
  const storeName = (config?.business_name as string | null) || null;

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 bg-[#8B7355]/10 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">Repair Enquiry Received</h1>
          <p className="text-stone-500">
            {name ? `Thanks ${name}! We've` : "We've"} received your repair enquiry
            {item ? ` for your <strong>${item}</strong>` : ""} and will be in touch shortly.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-left space-y-3">
          {ref && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-stone-500">Reference Number</span>
              <span className="text-sm font-mono font-semibold text-[#8B7355]">{ref}</span>
            </div>
          )}
          {item && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-stone-500">Item</span>
              <span className="text-sm font-medium text-stone-900">{item}</span>
            </div>
          )}
          <div className="border-t border-stone-100 pt-3">
            <p className="text-sm text-stone-500">
              Our team will review your enquiry and contact you within 1–2 business days with a quote or to arrange a drop-off appointment.
            </p>
            {(storePhone || storeEmail || storeName) && (
              <div className="mt-3 pt-3 border-t border-stone-100 space-y-1">
                {storeName && <p className="text-sm font-medium text-stone-700">{storeName}</p>}
                {storePhone && (
                  <a href={`tel:${storePhone}`} className="block text-sm text-[#8B7355] hover:underline">
                    📞 {storePhone}
                  </a>
                )}
                {storeEmail && (
                  <a href={`mailto:${storeEmail}`} className="block text-sm text-[#8B7355] hover:underline">
                    ✉️ {storeEmail}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-400">Please save your reference number for future correspondence.</p>

        <Link
          href={`/${subdomain}`}
          className="inline-block px-6 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-xl hover:bg-[#7a6447] transition-colors"
        >
          Back to Store
        </Link>
      </div>
    </div>
  );
}
