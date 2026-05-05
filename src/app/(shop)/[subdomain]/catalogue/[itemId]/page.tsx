import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveTenantConfig } from "@/lib/storefront/resolve-active-tenant";
import ItemEnquiryForm from "./ItemEnquiryForm";

interface Props {
  params: Promise<{ subdomain: string; itemId: string }>;
}

export default function ItemDetailPageWrapper(props: Props) {
  return (
    <Suspense fallback={null}>
      <ItemDetailPage {...props} />
    </Suspense>
  );
}

async function ItemDetailPage({ params }: Props) {
  const { subdomain, itemId } = await params;
  const supabase = createAdminClient();

  // P2-C: HARD CUTOFF on soft-deleted tenants.
  const resolved = await resolveActiveTenantConfig(subdomain);
  if (!resolved) notFound();
  const { config, tenant } = resolved;

  const { data: item } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", itemId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!item) notFound();

  const primaryColor = config.primary_color || "amber-700";
  const secondaryColor = config.secondary_color || "#1A1A1A";
  const font = config.font || "Inter";

  const showPrices = config.mode !== "A" && config.show_prices;
  const showEnquiry = config.allow_enquiry !== false;
  const showBuyButton = config.mode === "C" && config.stripe_enabled;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: `'${font}', sans-serif` }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ backgroundColor: secondaryColor }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logo_url && (
              <Image src={config.logo_url} alt="Logo" width={120} height={32} className="h-8 object-contain" unoptimized />
            )}
            <Link href={`/${subdomain}`} className="text-white font-semibold text-lg hover:opacity-80">
              {config.business_name || subdomain}
            </Link>
          </div>
          <Link href={`/${subdomain}/catalogue`} className="text-white/70 hover:text-white text-sm">
            ← Back to Catalogue
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl overflow-hidden bg-stone-50">
              {item.images?.[0] ? (
                <Image
                  src={item.images[0]}
                  alt={item.name}
                  width={600}
                  height={600}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">💎</div>
              )}
            </div>
            {item.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto">
                {item.images.slice(1).map((img: string, i: number) => (
                  <Image
                    key={i}
                    src={img}
                    alt={`${item.name} ${i + 2}`}
                    width={80}
                    height={80}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0 border border-stone-200"
                    unoptimized
                  />
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              {item.category && (
                <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: primaryColor }}>
                  {item.category}
                </p>
              )}
              <h1 className="text-3xl font-bold" style={{ color: secondaryColor }}>
                {item.name}
              </h1>
              {item.sku && (
                <p className="text-xs text-stone-400 mt-1">SKU: {item.sku}</p>
              )}
            </div>

            {showPrices && item.retail_price && (
              <div className="text-3xl font-bold" style={{ color: primaryColor }}>
                ${Number(item.retail_price).toLocaleString()}
              </div>
            )}

            {!showPrices && (
              <p className="text-stone-500 italic">Price available on enquiry</p>
            )}

            {item.description && (
              <p className="text-stone-600 leading-relaxed">{item.description}</p>
            )}

            {/* Specs */}
            <div className="grid grid-cols-2 gap-3">
              {item.metal_type && (
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-400 uppercase tracking-wide">Metal</p>
                  <p className="text-sm font-medium text-stone-900 mt-0.5">{item.metal_type}</p>
                </div>
              )}
              {item.stone_type && (
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-400 uppercase tracking-wide">Stone</p>
                  <p className="text-sm font-medium text-stone-900 mt-0.5">{item.stone_type}</p>
                </div>
              )}
              {item.stone_carat && (
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-400 uppercase tracking-wide">Carat</p>
                  <p className="text-sm font-medium text-stone-900 mt-0.5">{item.stone_carat}ct</p>
                </div>
              )}
              {item.metal_weight_grams && (
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="text-xs text-stone-400 uppercase tracking-wide">Weight</p>
                  <p className="text-sm font-medium text-stone-900 mt-0.5">{item.metal_weight_grams}g</p>
                </div>
              )}
            </div>

            {/* CTA buttons */}
            <div className="flex gap-3 pt-2">
              {showBuyButton && (
                <button
                  className="flex-1 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  Add to Cart
                </button>
              )}
              {showEnquiry && (
                <Link
                  href={`/${subdomain}/enquiry?item=${encodeURIComponent(item.name)}`}
                  className={`py-3 rounded-xl font-semibold transition-colors text-center ${
                    showBuyButton
                      ? "flex-1 border-2 text-stone-700 hover:bg-stone-50"
                      : "flex-1 text-white hover:opacity-90"
                  }`}
                  style={
                    showBuyButton
                      ? { borderColor: primaryColor, color: primaryColor }
                      : { backgroundColor: primaryColor }
                  }
                >
                  {config.mode === "A" ? "Enquire About This Piece" : "Enquire"}
                </Link>
              )}
            </div>

            {/* Inline enquiry for mode A */}
            {config.mode === "A" && showEnquiry && (
              <div className="border-t border-stone-100 pt-6">
                <ItemEnquiryForm
                  subdomain={subdomain}
                  tenantId={tenant.id}
                  itemName={item.name}
                  primaryColor={primaryColor}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="py-8 px-4 text-center mt-8" style={{ backgroundColor: secondaryColor }}>
        <p className="text-white/60 text-sm">© {new Date().getFullYear()} {config.business_name || subdomain}</p>
        <p className="text-white/30 text-xs mt-2">Powered by Nexpura</p>
      </footer>
    </div>
  );
}
