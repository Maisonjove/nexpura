import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import EnquiryForm from "./EnquiryForm";

interface Props {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ item?: string }>;
}

export default async function EnquiryPage({ params, searchParams }: Props) {
  const { subdomain } = await params;
  const { item } = await searchParams;
  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from("website_config")
    .select("*")
    .eq("subdomain", subdomain)
    .eq("published", true)
    .maybeSingle();

  if (!config) notFound();

  const primaryColor = config.primary_color || "amber-700";
  const secondaryColor = config.secondary_color || "#1A1A1A";
  const font = config.font || "Inter";

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: `'${font}', sans-serif` }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: secondaryColor }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logo_url} alt="Logo" className="h-8 object-contain" />
            )}
            <Link href={`/${subdomain}`} className="text-white font-semibold text-lg hover:opacity-80">
              {config.business_name || subdomain}
            </Link>
          </div>
          <Link href={`/${subdomain}/catalogue`} className="text-white/70 hover:text-white text-sm">
            ← Catalogue
          </Link>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold" style={{ color: secondaryColor }}>
            Get in Touch
          </h1>
          <p className="text-stone-500 mt-3">
            {item
              ? `Enquiring about: ${item}`
              : "We'd love to hear from you. Send us a message and we'll get back to you shortly."}
          </p>
          {config.contact_phone && (
            <p className="text-stone-500 mt-2 text-sm">
              Or call us at{" "}
              <a href={`tel:${config.contact_phone}`} className="font-medium hover:underline" style={{ color: primaryColor }}>
                {config.contact_phone}
              </a>
            </p>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-8 shadow-sm">
          <EnquiryForm
            subdomain={subdomain}
            tenantId={config.tenant_id}
            defaultItem={item}
            primaryColor={primaryColor}
            contactEmail={config.contact_email}
          />
        </div>
      </div>

      <footer className="py-8 px-4 text-center mt-8" style={{ backgroundColor: secondaryColor }}>
        <p className="text-white/60 text-sm">© {new Date().getFullYear()} {config.business_name || subdomain}</p>
        <p className="text-white/30 text-xs mt-2">Powered by Nexpura</p>
      </footer>
    </div>
  );
}
