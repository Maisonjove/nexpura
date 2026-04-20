import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShopDisplayName } from "@/lib/shop/display-name";

interface Props {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ category?: string; metal?: string; stone?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const name = await getShopDisplayName(subdomain);
  return { title: `Catalogue — ${name}` };
}

export default function CataloguePageWrapper(props: Props) {
  return (
    <Suspense fallback={null}>
      <CataloguePage {...props} />
    </Suspense>
  );
}

async function CataloguePage({ params, searchParams }: Props) {
  const { subdomain } = await params;
  const { category, metal, stone } = await searchParams;
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

  // Build query
  let query = supabase
    .from("inventory")
    .select("id, name, primary_image, images, metal_type, stone_type, retail_price, category, description, sku")
    .eq("tenant_id", config.tenant_id)
    .eq("status", "active")
    .eq("is_published", true)
    .gt("quantity", 0)
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (metal) query = query.eq("metal_type", metal);
  if (stone) query = query.eq("stone_type", stone);

  const { data: items } = await query.limit(100);

  // Fetch filter options
  const { data: categories } = await supabase
    .from("inventory")
    .select("category")
    .eq("tenant_id", config.tenant_id)
    .eq("status", "active")
    .not("category", "is", null);

  const { data: metals } = await supabase
    .from("inventory")
    .select("metal_type")
    .eq("tenant_id", config.tenant_id)
    .eq("status", "active")
    .not("metal_type", "is", null);

  const { data: stones } = await supabase
    .from("inventory")
    .select("stone_type")
    .eq("tenant_id", config.tenant_id)
    .eq("status", "active")
    .not("stone_type", "is", null);

  const uniqueCategories = [...new Set((categories || []).map((c) => c.category).filter(Boolean))];
  const uniqueMetals = [...new Set((metals || []).map((m) => m.metal_type).filter(Boolean))];
  const uniqueStones = [...new Set((stones || []).map((s) => s.stone_type).filter(Boolean))];

  const showPrices = config.mode !== "A" && config.show_prices;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: `'${font}', sans-serif` }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: secondaryColor }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logo_url && (
              <Image src={config.logo_url} alt="Logo" width={120} height={32} className="h-8 object-contain" unoptimized />
            )}
            <Link href={`/${subdomain}`} className="text-white font-semibold text-lg hover:opacity-80 transition-opacity">
              {config.business_name || subdomain}
            </Link>
          </div>
          <div className="flex items-center gap-6">
            <Link href={`/${subdomain}/catalogue`} className="text-white text-sm font-medium">
              Catalogue
            </Link>
            {config.allow_enquiry !== false && (
              <Link
                href={`/${subdomain}/enquiry`}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: primaryColor }}
              >
                Enquire
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Page header */}
      <div className="py-12 px-4" style={{ backgroundColor: `${primaryColor}10` }}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold" style={{ color: secondaryColor }}>
            Our Catalogue
          </h1>
          <p className="text-stone-500 mt-2">
            {items?.length || 0} piece{(items?.length || 0) !== 1 ? "s" : ""} available
            {category && ` in ${category}`}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Filters sidebar */}
          <aside className="w-56 flex-shrink-0 hidden sm:block">
            <div className="space-y-6">
              {uniqueCategories.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Category</h3>
                  <div className="space-y-1">
                    <Link
                      href={`/${subdomain}/catalogue`}
                      className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${!category ? "text-white" : "text-stone-600 hover:bg-stone-100"}`}
                      style={!category ? { backgroundColor: primaryColor } : {}}
                    >
                      All
                    </Link>
                    {uniqueCategories.map((cat) => (
                      <Link
                        key={cat}
                        href={`/${subdomain}/catalogue?category=${encodeURIComponent(cat)}`}
                        className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${category === cat ? "text-white" : "text-stone-600 hover:bg-stone-100"}`}
                        style={category === cat ? { backgroundColor: primaryColor } : {}}
                      >
                        {cat}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {uniqueMetals.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Metal</h3>
                  <div className="space-y-1">
                    {uniqueMetals.map((m) => (
                      <Link
                        key={m}
                        href={`/${subdomain}/catalogue?${metal === m ? "" : `metal=${encodeURIComponent(m)}`}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
                        className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${metal === m ? "text-white" : "text-stone-600 hover:bg-stone-100"}`}
                        style={metal === m ? { backgroundColor: primaryColor } : {}}
                      >
                        {m}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {uniqueStones.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Stone</h3>
                  <div className="space-y-1">
                    {uniqueStones.map((s) => (
                      <Link
                        key={s}
                        href={`/${subdomain}/catalogue?${stone === s ? "" : `stone=${encodeURIComponent(s)}`}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
                        className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${stone === s ? "text-white" : "text-stone-600 hover:bg-stone-100"}`}
                        style={stone === s ? { backgroundColor: primaryColor } : {}}
                      >
                        {s}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1">
            {(items?.length ?? 0) === 0 ? (
              <div className="text-center py-24">
                <div className="text-5xl mb-4">💎</div>
                <p className="text-stone-500">No items found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {items?.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${subdomain}/catalogue/${item.id}`}
                    className="group rounded-xl overflow-hidden border border-stone-100 hover:shadow-lg transition-all hover:-translate-y-0.5"
                  >
                    <div className="aspect-square bg-stone-50 overflow-hidden">
                      {(item.primary_image || item.images?.[0]) ? (
                        <Image
                          src={item.primary_image || item.images![0]}
                          alt={item.name}
                          width={300}
                          height={300}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">💎</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-stone-900 text-sm truncate">{item.name}</p>
                      {item.metal_type && (
                        <p className="text-xs text-stone-500 mt-0.5 truncate">
                          {item.metal_type}{item.stone_type ? ` · ${item.stone_type}` : ""}
                        </p>
                      )}
                      {showPrices && item.retail_price && (
                        <p className="text-sm font-semibold mt-1.5" style={{ color: primaryColor }}>
                          ${Number(item.retail_price).toLocaleString()}
                        </p>
                      )}
                      {!showPrices && (
                        <p className="text-xs text-stone-400 mt-1.5 italic">Enquire for price</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-4 text-center mt-16" style={{ backgroundColor: secondaryColor }}>
        <p className="text-white/60 text-sm">
          © {new Date().getFullYear()} {config.business_name || subdomain}
        </p>
        <p className="text-white/30 text-xs mt-2">Powered by Nexpura</p>
      </footer>
    </div>
  );
}
