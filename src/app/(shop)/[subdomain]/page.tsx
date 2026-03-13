import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const supabase = createAdminClient();
  const { data: config } = await supabase
    .from("website_config")
    .select("business_name, meta_title, meta_description")
    .eq("subdomain", subdomain)
    .maybeSingle();

  return {
    title: config?.meta_title || config?.business_name || subdomain,
    description: config?.meta_description || undefined,
  };
}

export default async function ShopHomePage({ params, searchParams }: Props) {
  const { subdomain } = await params;
  const { preview } = await searchParams;
  const supabase = createAdminClient();

  // Fetch website config — allow unpublished for preview mode
  const query = supabase
    .from("website_config")
    .select("*")
    .eq("subdomain", subdomain);

  if (!preview) {
    query.eq("published", true);
  }

  const { data: config } = await query.maybeSingle();

  if (!config) notFound();

  // Fetch featured inventory — use real column names
  const { data: items } = await supabase
    .from("inventory")
    .select("id, name, primary_image, metal_type, stone_type, retail_price, description")
    .eq("tenant_id", config.tenant_id)
    .eq("status", "active")
    .gt("quantity", 0)
    .limit(8)
    .order("created_at", { ascending: false });

  const primaryColor = config.primary_color || "#8B7355";
  const secondaryColor = config.secondary_color || "#1A1A1A";
  const font = config.font || "Inter";
  const base = `/${subdomain}`;

  const fontImport = font !== "Inter"
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700&display=swap`
    : null;

  return (
    <>
      {fontImport && <link rel="stylesheet" href={fontImport} />}

      {preview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs text-center py-2 px-4">
          🔍 Preview mode — this page is not yet published publicly
        </div>
      )}

      <div className="min-h-screen bg-white" style={{ fontFamily: `'${font}', sans-serif` }}>

        {/* ── Navigation ── */}
        <nav
          className="sticky top-0 z-50 border-b"
          style={{ backgroundColor: secondaryColor, borderColor: `${primaryColor}30` }}
        >
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.logo_url} alt="Logo" className="h-8 object-contain" />
              )}
              <span className="text-white font-semibold text-lg">
                {config.business_name || subdomain}
              </span>
            </div>
            <div className="flex items-center gap-6">
              <Link href={`${base}/catalogue`} className="text-white/80 hover:text-white text-sm transition-colors">
                Catalogue
              </Link>
              {config.allow_enquiry !== false && (
                <Link
                  href={`${base}/enquiry`}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: primaryColor }}
                >
                  Enquire
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section
          className="relative py-24 px-4 text-center overflow-hidden"
          style={{ backgroundColor: secondaryColor }}
        >
          {config.hero_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.hero_image_url}
              alt="Hero"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className="relative max-w-2xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              {config.business_name || "Welcome"}
            </h1>
            {config.tagline && (
              <p className="text-white/80 text-lg sm:text-xl">{config.tagline}</p>
            )}
            <div className="flex items-center justify-center gap-3 mt-8">
              <Link
                href={`${base}/catalogue`}
                className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Browse Catalogue
              </Link>
              {config.allow_enquiry !== false && (
                <Link
                  href={`${base}/enquiry`}
                  className="px-6 py-3 rounded-xl text-sm font-medium text-white/90 border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Get in Touch
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Featured Items ── */}
        {(items?.length ?? 0) > 0 && (
          <section className="py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <h2
                className="text-2xl font-bold text-center mb-2"
                style={{ color: secondaryColor }}
              >
                Featured Collection
              </h2>
              <p className="text-stone-500 text-center mb-10">Handcrafted pieces for every occasion</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {items?.map((item) => (
                  <Link
                    key={item.id}
                    href={`${base}/catalogue/${item.id}`}
                    className="group rounded-xl overflow-hidden border border-stone-100 hover:shadow-lg transition-all hover:-translate-y-0.5"
                  >
                    <div className="aspect-square bg-stone-50 overflow-hidden">
                      {item.primary_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.primary_image}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">💎</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-stone-900 text-sm truncate">{item.name}</p>
                      {item.metal_type && (
                        <p className="text-xs text-stone-500 truncate mt-0.5">
                          {item.metal_type}{item.stone_type ? ` · ${item.stone_type}` : ""}
                        </p>
                      )}
                      {config.mode !== "A" && config.show_prices && item.retail_price && (
                        <p className="text-sm font-semibold mt-1" style={{ color: primaryColor }}>
                          ${Number(item.retail_price).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              <div className="text-center mt-10">
                <Link
                  href={`${base}/catalogue`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium border-2 transition-colors"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  View Full Catalogue →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── About ── */}
        {config.about_text && (
          <section className="py-16 px-4" style={{ backgroundColor: `${primaryColor}08` }}>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-6" style={{ color: secondaryColor }}>
                Our Story
              </h2>
              <p className="text-stone-600 leading-relaxed text-lg whitespace-pre-line">
                {config.about_text}
              </p>
            </div>
          </section>
        )}

        {/* ── Contact ── */}
        {(config.contact_email || config.contact_phone || config.contact_address) && (
          <section className="py-16 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-8" style={{ color: secondaryColor }}>
                Visit Us
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                {config.contact_address && (
                  <div>
                    <div className="text-2xl mb-2">📍</div>
                    <p className="text-stone-600 text-sm">{config.contact_address}</p>
                  </div>
                )}
                {config.contact_phone && (
                  <div>
                    <div className="text-2xl mb-2">📞</div>
                    <a href={`tel:${config.contact_phone}`} className="text-stone-600 text-sm hover:underline">
                      {config.contact_phone}
                    </a>
                  </div>
                )}
                {config.contact_email && (
                  <div>
                    <div className="text-2xl mb-2">✉️</div>
                    <a href={`mailto:${config.contact_email}`} className="text-stone-600 text-sm hover:underline">
                      {config.contact_email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="py-8 px-4 text-center" style={{ backgroundColor: secondaryColor }}>
          <p className="text-white/60 text-sm">
            © {new Date().getFullYear()} {config.business_name || subdomain}. All rights reserved.
          </p>
          {(config.social_instagram || config.social_facebook) && (
            <div className="flex items-center justify-center gap-4 mt-4">
              {config.social_instagram && (
                <a href={`https://instagram.com/${config.social_instagram}`} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white text-sm transition-colors">
                  Instagram
                </a>
              )}
              {config.social_facebook && (
                <a href={`https://facebook.com/${config.social_facebook}`} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white text-sm transition-colors">
                  Facebook
                </a>
              )}
            </div>
          )}
          <p className="text-white/30 text-xs mt-4">Powered by Nexpura</p>
        </footer>
      </div>
    </>
  );
}
