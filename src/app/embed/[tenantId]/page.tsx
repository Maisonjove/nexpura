import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ mode?: string; theme?: string; category?: string }>;
}

export default async function EmbedCataloguePage({ params, searchParams }: Props) {
  const { tenantId } = await params;
  const { category } = await searchParams;
  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from("website_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!config) notFound();

  const primaryColor = config.primary_color || "amber-700";
  const font = config.font || "Inter";
  const showPrices = config.mode !== "A" && config.show_prices;

  let query = supabase
    .from("inventory")
    .select("id, name, images, metal, stone, retail_price, category")
    .eq("tenant_id", tenantId)
    .eq("status", "in_stock")
    .gt("quantity", 0)
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data: items } = await query.limit(60);

  const subdomain = config.subdomain;

  return (
    <div
      className="bg-white min-h-screen"
      style={{ fontFamily: `'${font}', sans-serif` }}
    >
      {/* Minimal header */}
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <span className="font-semibold text-stone-900 text-sm">
          {config.business_name || "Jewellery Catalogue"}
        </span>
        {subdomain && (
          <a
            href={`https://nexpura.com/${subdomain}/catalogue`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            View full site ↗
          </a>
        )}
      </div>

      {/* Grid */}
      <div className="p-4">
        {(items?.length ?? 0) === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💎</div>
            <p className="text-stone-400 text-sm">No items available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items?.map((item) => {
              const href = subdomain
                ? `https://nexpura.com/${subdomain}/catalogue/${item.id}`
                : "#";
              return (
                <a
                  key={item.id}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-xl overflow-hidden border border-stone-100 hover:shadow-md transition-all"
                >
                  <div className="aspect-square bg-stone-50 overflow-hidden">
                    {item.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        💎
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="font-medium text-stone-900 text-xs truncate">{item.name}</p>
                    {item.metal && (
                      <p className="text-[11px] text-stone-400 truncate mt-0.5">
                        {item.metal}
                        {item.stone ? ` · ${item.stone}` : ""}
                      </p>
                    )}
                    {showPrices && item.retail_price && (
                      <p className="text-xs font-semibold mt-1" style={{ color: primaryColor }}>
                        ${Number(item.retail_price).toLocaleString()}
                      </p>
                    )}
                    {!showPrices && (
                      <p className="text-[11px] text-stone-400 mt-1 italic">Enquire for price</p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Minimal footer */}
      <div className="p-4 text-center border-t border-stone-100 mt-4">
        <p className="text-[10px] text-stone-300">
          Powered by{" "}
          <a
            href="https://nexpura.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-stone-400"
          >
            Nexpura
          </a>
        </p>
      </div>
    </div>
  );
}
