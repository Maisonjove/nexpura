import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import AppointmentForm from "./AppointmentForm";

interface Props {
  params: Promise<{ subdomain: string }>;
}

export default async function AppointmentPage({ params }: Props) {
  const { subdomain } = await params;
  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from("website_config")
    .select("*")
    .eq("subdomain", subdomain)
    .eq("published", true)
    .maybeSingle();

  if (!config) notFound();

  const primaryColor = (config.primary_color as string) || "amber-700";
  const font = (config.font as string) || "Inter";
  const businessName = (config.business_name as string) || subdomain;
  const tenantId = config.tenant_id as string;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: `'${font}', sans-serif` }}>
      {/* Nav */}
      <nav style={{ backgroundColor: primaryColor }} className="px-6 py-4 flex items-center justify-between">
        <a href={`/${subdomain}`} className="text-white font-bold text-lg">{businessName}</a>
        <div className="flex items-center gap-4 text-sm text-white/80">
          <a href={`/${subdomain}/catalogue`} className="hover:text-white transition-colors">Catalogue</a>
          <a href={`/${subdomain}/repairs`} className="hover:text-white transition-colors">Repairs</a>
          <a href={`/${subdomain}/appointments`} className="text-white font-medium">Book Appointment</a>
          <a href={`/${subdomain}/enquiry`} className="hover:text-white transition-colors">Contact</a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900" style={{ fontFamily: "'Georgia', serif" }}>
            Book an Appointment
          </h1>
          <p className="text-stone-500 mt-2">
            Request an appointment and we'll confirm your preferred time.
          </p>
        </div>

        <AppointmentForm
          subdomain={subdomain}
          tenantId={tenantId}
          primaryColor={primaryColor}
        />
      </div>
    </div>
  );
}
