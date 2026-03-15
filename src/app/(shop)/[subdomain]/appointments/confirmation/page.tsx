import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Appointment Confirmed" };

export default async function AppointmentConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ ref?: string; name?: string; date?: string; time?: string; type?: string }>;
}) {
  const { subdomain } = await params;
  const sp = await searchParams;
  const name = sp.name ?? "";
  const ref = sp.ref ?? "";
  const date = sp.date ?? "";
  const time = sp.time ?? "";
  const type = sp.type ?? "Appointment";

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
        {/* Success icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">Appointment Confirmed!</h1>
          <p className="text-stone-500">
            {name ? `Thanks ${name}! Your` : "Your"} <strong>{type}</strong> appointment has been received.
          </p>
        </div>

        {/* Details card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-left space-y-3">
          {ref && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-stone-500">Reference</span>
              <span className="text-sm font-mono font-semibold text-stone-900">{ref}</span>
            </div>
          )}
          {date && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-stone-500">Date</span>
              <span className="text-sm font-medium text-stone-900">{date}</span>
            </div>
          )}
          {time && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-stone-500">Time</span>
              <span className="text-sm font-medium text-stone-900">{time}</span>
            </div>
          )}
          <div className="border-t border-stone-100 pt-3">
            <p className="text-sm text-stone-500">
              We&apos;ll send a confirmation to your email address. Please arrive a few minutes before your scheduled time.
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

        <p className="text-sm text-stone-400">
          Need to reschedule?{" "}
          <Link href={`/store/${subdomain}/appointments`} className="text-[#8B7355] hover:underline">
            Book a new appointment
          </Link>
        </p>

        <Link
          href={`/store/${subdomain}`}
          className="inline-block px-6 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-xl hover:bg-[#7a6447] transition-colors"
        >
          Back to Store
        </Link>
      </div>
    </div>
  );
}
