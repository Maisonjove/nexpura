import { getAuthOrReviewContext } from "@/lib/auth/review";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const STORE_PAGES = [
  { slug: "/", name: "Home", desc: "Hero banner, featured products, about blurb", status: "published" },
  { slug: "/products", name: "Products", desc: "Full catalogue grid with category filters", status: "published" },
  { slug: "/about", name: "About", desc: "Store story, team, and craftsmanship statement", status: "published" },
  { slug: "/contact", name: "Contact", desc: "Enquiry form, address, and opening hours", status: "published" },
  { slug: "/repairs", name: "Repairs", desc: "Intake form for repair requests", status: "draft" },
];

const BUILDER_CAPABILITIES = [
  { label: "Theme & Branding", desc: "Logo, primary/secondary colours, font selection" },
  { label: "Pages & Content", desc: "Hero section, about text, feature highlights" },
  { label: "Domain & Subdomain", desc: "Custom domain or *.nexpura.com subdomain" },
  { label: "Store Mode", desc: "Catalogue-only, enquiry, or full e-commerce" },
  { label: "Pricing Visibility", desc: "Show or hide prices to public visitors" },
  { label: "Enquiry Forms", desc: "Customer contact and product enquiry forms" },
  { label: "Social Links", desc: "Instagram, Facebook, and other social channels" },
  { label: "SEO Metadata", desc: "Page title, meta description for search engines" },
];

const MODE_LABELS: Record<string, { title: string; desc: string; badge: string }> = {
  A: { title: "Catalogue Only", desc: "Public product catalogue — browse without checkout", badge: "bg-stone-100 text-stone-700" },
  B: { title: "Catalogue + Enquiry", desc: "Product catalogue with customer enquiry forms", badge: "bg-amber-50 text-amber-700" },
  C: { title: "Full Online Store", desc: "Full e-commerce with cart and checkout", badge: "bg-green-50 text-green-700" },
};

function ToggleDisplay({ label, enabled, desc }: { label: string; enabled: boolean; desc?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-stone-900">{label}</p>
        {desc && <p className="text-xs text-stone-400 mt-0.5">{desc}</p>}
      </div>
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        enabled ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-green-500" : "bg-stone-400"}`} />
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}

export default async function ReviewWebsitePage({ searchParams }: { searchParams: Promise<{ rt?: string }> }) {
  const { rt } = await searchParams;
  const { admin, tenantId } = await getAuthOrReviewContext(rt);

  if (!tenantId) {
    return <div>Unauthorized</div>;
  }

  const { data: config } = await admin
    .from("website_config")
    .select("id, mode, subdomain, custom_domain, published, show_prices, allow_enquiry, stripe_enabled, business_name, tagline, logo_url, hero_image_url, primary_color, secondary_color, about_text, contact_email, contact_phone, contact_address, social_instagram, meta_title, meta_description, website_type")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const modeInfo = MODE_LABELS[config?.mode ?? "B"] ?? MODE_LABELS["B"];
  const subdomainUrl = config?.subdomain ? `https://${config.subdomain}.nexpura.com` : "https://marcusco.nexpura.com";
  const primaryColor = config?.primary_color ?? "amber-700";
  const businessName = config?.business_name ?? "Marcus & Co. Fine Jewellery";
  const tagline = config?.tagline ?? "Exquisite jewellery, crafted for every moment";
  const metaTitle = (config as Record<string, unknown> | null)?.meta_title as string | null ?? "Marcus & Co. Fine Jewellery — Sydney";
  const metaDesc = (config as Record<string, unknown> | null)?.meta_description as string | null ?? "Bespoke fine jewellery, expert repairs, and timeless collections. Visit us in Sydney CBD.";
  const instagram = (config as Record<string, unknown> | null)?.social_instagram as string | null ?? "@marcuscojewellery";
  const contactAddress = (config as Record<string, unknown> | null)?.contact_address as string | null ?? "42 Crown Street, Sydney NSW 2000";
  const contactEmail = config?.contact_email ?? "hello@marcusco.com.au";
  const contactPhone = config?.contact_phone ?? "+61 2 9XXX XXXX";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Read-only banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <span className="text-lg flex-shrink-0">👁️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Read-only preview</p>
          <p className="text-sm text-amber-700 mt-0.5">
            This is a read-only preview of the Website Builder. In the live app, you can configure your store type, domain, branding, and content blocks from this screen.
          </p>
        </div>
      </div>

      {/* ── STORE PREVIEW MOCKUP ── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Live Store Preview</h2>
          <span className="text-xs text-amber-700 font-medium">marcusco.nexpura.com</span>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          {/* Browser chrome */}
          <div className="bg-stone-100 border-b border-stone-200 px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-300" />
              <span className="w-3 h-3 rounded-full bg-amber-300" />
              <span className="w-3 h-3 rounded-full bg-green-300" />
            </div>
            <span className="text-xs font-mono text-stone-500 bg-white border border-stone-200 rounded px-3 py-1 flex-1 truncate">
              {subdomainUrl}
            </span>
          </div>

          {/* Store nav bar */}
          <div className="bg-white border-b border-stone-100 px-6 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-stone-900 tracking-tight">{businessName.split(" ").slice(0, 3).join(" ")}</span>
            <nav className="flex items-center gap-5 text-xs font-medium text-stone-500">
              <span>Home</span>
              <span>·</span>
              <span>Products</span>
              <span>·</span>
              <span>About</span>
              <span>·</span>
              <span>Repairs</span>
              <span>·</span>
              <span>Contact</span>
            </nav>
          </div>

          {/* Hero section */}
          <div
            className="px-8 py-12 text-center relative overflow-hidden"
            style={{
              backgroundColor: primaryColor,
              backgroundImage: "linear-gradient(135deg, rgba(0,0,0,0.18) 0%, transparent 60%)",
            }}
          >
            <p className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-3">Fine Jewellery · Sydney</p>
            <h2 className="text-3xl font-bold text-white mb-3 leading-tight">{businessName}</h2>
            <p className="text-sm text-white/80 max-w-sm mx-auto leading-relaxed mb-6">{tagline}</p>
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex items-center px-5 py-2 rounded-lg text-xs font-semibold bg-white text-stone-900 shadow-sm">
                View Collection
              </span>
              <span className="inline-flex items-center px-5 py-2 rounded-lg text-xs font-semibold text-white border border-white/40 bg-white/10">
                Enquire
              </span>
            </div>
          </div>

          {/* Featured products section */}
          <div className="bg-stone-50 px-6 py-8">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest text-center mb-6">Featured Collection</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: "Diamond Solitaire Ring", price: "$18,500", tag: "Bestseller" },
                { name: "Sapphire Halo Ring", price: "$12,800", tag: "New Arrival" },
                { name: "Gold Diamond Bracelet", price: "$8,400", tag: "In Stock" },
              ].map((p) => (
                <div key={p.name} className="bg-white rounded-lg border border-stone-100 overflow-hidden shadow-sm">
                  {/* Product image placeholder */}
                  <div
                    className="h-28 flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}18` }}
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center"
                      style={{ borderColor: `${primaryColor}60` }}>
                      <span className="text-lg">💎</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: primaryColor }}>
                      {p.tag}
                    </span>
                    <p className="text-xs font-semibold text-stone-900 mt-2 leading-snug">{p.name}</p>
                    <p className="text-xs font-bold mt-1" style={{ color: primaryColor }}>{p.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Store footer */}
          <div className="bg-stone-900 px-6 py-3 flex items-center justify-between text-xs text-stone-400">
            <span>{contactAddress}</span>
            <span>{contactEmail}</span>
            <span>{instagram}</span>
          </div>
        </div>
      </section>

      {/* ── SEO PREVIEW ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Search Engine Preview</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <p className="text-xs text-stone-400 mb-4">How this store appears in Google search results:</p>
          <div className="border border-stone-100 rounded-lg px-4 py-3 bg-white max-w-xl">
            <p className="text-xs text-stone-400 mb-1 font-mono">{subdomainUrl}</p>
            <p className="text-base font-medium text-amber-700 leading-snug mb-1 cursor-pointer hover:underline">{metaTitle}</p>
            <p className="text-xs text-stone-500 leading-relaxed">{metaDesc}</p>
          </div>
          <p className="text-xs text-stone-300 mt-3 italic">Preview only — colours and formatting match Google SERP style</p>
        </div>
      </section>

      {/* ── SOCIAL & CONTACT ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Social &amp; Contact</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Instagram", value: instagram, icon: "📸" },
            { label: "Email", value: contactEmail, icon: "✉️" },
            { label: "Phone", value: contactPhone, icon: "📞" },
            { label: "Address", value: contactAddress, icon: "📍" },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex flex-col gap-2">
              <span className="text-lg">{item.icon}</span>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{item.label}</p>
              <p className="text-xs font-medium text-stone-800 leading-snug break-all">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE STATUS ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Live Status</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-stone-900">{businessName}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  config?.published ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${config?.published ? "bg-green-500" : "bg-stone-400"}`} />
                  {config?.published ? "Published" : "Draft"}
                </span>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${modeInfo.badge}`}>
                  {modeInfo.title}
                </span>
              </div>
              {tagline && (
                <p className="text-sm text-stone-500 mt-1">{tagline}</p>
              )}
              <p className="text-xs text-stone-400 mt-1">{modeInfo.desc}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-100">
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Subdomain URL</p>
              <p className="text-sm font-mono text-amber-700 mt-0.5">{subdomainUrl}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Custom Domain</p>
              <p className="text-sm text-stone-900 mt-0.5">{config?.custom_domain || "Not configured"}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Website Type</p>
              <p className="text-sm text-stone-900 mt-0.5 capitalize">{config?.website_type?.replace(/_/g, " ") || "Hosted"}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Store Mode</p>
              <p className="text-sm text-stone-900 mt-0.5">{modeInfo.title}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BRANDING ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Branding</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-2">Primary Colour</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-stone-200 shadow-sm flex-shrink-0"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-sm font-mono text-stone-700">{primaryColor}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-2">Secondary Colour</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-stone-200 shadow-sm flex-shrink-0"
                  style={{ backgroundColor: config?.secondary_color ?? "#1A1A1A" }}
                />
                <span className="text-sm font-mono text-stone-700">{config?.secondary_color ?? "#1A1A1A"}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-2">Logo</p>
              {config?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.logo_url} alt="Logo" className="h-12 object-contain rounded border border-stone-200 p-1 bg-white" />
              ) : (
                <span className="text-sm text-stone-400 italic">No logo uploaded</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SITE PAGES ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Site Pages</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Page</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">URL</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {STORE_PAGES.map((page) => (
                <tr key={page.slug} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 text-sm font-semibold text-stone-900">{page.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-stone-400">{`${subdomainUrl}${page.slug === "/" ? "" : page.slug}`}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{page.desc}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      page.status === "published" ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${page.status === "published" ? "bg-green-500" : "bg-stone-400"}`} />
                      {page.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── COMMERCE SETTINGS ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Commerce Settings</h2>
        <div className="bg-white rounded-xl border border-stone-200 px-5 shadow-sm">
          <ToggleDisplay
            label="Show Prices"
            enabled={config?.show_prices ?? true}
            desc="Product prices visible to public visitors"
          />
          <ToggleDisplay
            label="Allow Enquiry"
            enabled={config?.allow_enquiry ?? true}
            desc="Customers can submit product and general enquiries"
          />
          <ToggleDisplay
            label="Stripe Payments"
            enabled={config?.stripe_enabled ?? false}
            desc="Accept online payments via Stripe checkout"
          />
        </div>
      </section>

      {/* ── BUILDER CAPABILITIES ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">What You Can Configure</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <p className="text-xs text-stone-400 mb-4">In the live app, the Website Builder gives you full control over:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BUILDER_CAPABILITIES.map((cap) => (
              <div key={cap.label} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-100">
                <div
                  className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: primaryColor }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{cap.label}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
