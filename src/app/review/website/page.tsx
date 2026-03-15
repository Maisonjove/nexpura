import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
export const revalidate = 60;

const STORE_PAGES = [
  { slug: "/", name: "Home", desc: "Hero banner, featured products, about blurb", status: "published" },
  { slug: "/products", name: "Products", desc: "Full catalogue grid with category filters", status: "published" },
  { slug: "/about", name: "About", desc: "Store story, team, and craftsmanship statement", status: "published" },
  { slug: "/contact", name: "Contact", desc: "Enquiry form, address, and opening hours", status: "published" },
  { slug: "/repairs", name: "Repairs", desc: "Intake form for repair requests", status: "draft" },
];

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm text-stone-900 mt-0.5 font-medium">{value || "—"}</p>
    </div>
  );
}

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

const MODE_LABELS: Record<string, { title: string; desc: string; badge: string }> = {
  A: { title: "Catalogue Only", desc: "Public product catalogue — browse without checkout", badge: "bg-stone-100 text-stone-700" },
  B: { title: "Catalogue + Enquiry", desc: "Product catalogue with customer enquiry forms", badge: "bg-amber-50 text-amber-700" },
  C: { title: "Full Online Store", desc: "Full e-commerce with cart and checkout", badge: "bg-green-50 text-green-700" },
};

const BUILDER_CAPABILITIES = [
  { icon: "🎨", label: "Theme & Branding", desc: "Logo, primary/secondary colours, font selection" },
  { icon: "📄", label: "Pages & Content", desc: "Hero section, about text, feature highlights" },
  { icon: "🌐", label: "Domain & Subdomain", desc: "Custom domain or *.nexpura.com subdomain" },
  { icon: "🛒", label: "Store Mode", desc: "Catalogue-only, enquiry, or full e-commerce" },
  { icon: "💰", label: "Pricing Visibility", desc: "Show or hide prices to public visitors" },
  { icon: "📬", label: "Enquiry Forms", desc: "Customer contact and product enquiry forms" },
  { icon: "🔗", label: "Social Links", desc: "Instagram, Facebook, and other social channels" },
  { icon: "🔍", label: "SEO Metadata", desc: "Page title, meta description for search engines" },
];

export default async function ReviewWebsitePage() {
  const admin = createAdminClient();

  const { data: config } = await admin
    .from("website_config")
    .select("id, mode, subdomain, custom_domain, published, show_prices, allow_enquiry, stripe_enabled, business_name, tagline, logo_url, hero_image_url, primary_color, secondary_color, about_text, contact_email, contact_phone, website_type")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();

  const modeInfo = MODE_LABELS[config?.mode ?? "B"] ?? MODE_LABELS["B"];
  const subdomainUrl = config?.subdomain ? `https://${config.subdomain}.nexpura.com` : null;

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

      {/* Live Status Card */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Live Status</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-stone-900">{config?.business_name ?? "Marcus & Co. Fine Jewellery"}</h1>
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
              {config?.tagline && (
                <p className="text-sm text-stone-500 mt-1">{config.tagline}</p>
              )}
              <p className="text-xs text-stone-400 mt-1">{modeInfo.desc}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-100">
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Subdomain URL</p>
              {subdomainUrl ? (
                <p className="text-sm font-mono text-amber-700 mt-0.5">{subdomainUrl}</p>
              ) : (
                <p className="text-sm text-stone-400 mt-0.5">No subdomain configured</p>
              )}
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

      {/* Branding */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Branding</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-2">Primary Colour</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-stone-200 shadow-sm flex-shrink-0"
                  style={{ backgroundColor: config?.primary_color ?? "#8B7355" }}
                />
                <span className="text-sm font-mono text-stone-700">{config?.primary_color ?? "#8B7355"}</span>
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
            {config?.hero_image_url && (
              <div>
                <p className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-2">Hero Image</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={config.hero_image_url} alt="Hero" className="h-16 w-full object-cover rounded border border-stone-200" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Content</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm space-y-5">
          <ReadOnlyField label="Business Name" value={config?.business_name} />
          <ReadOnlyField label="Tagline" value={config?.tagline} />
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">About Text</p>
            <p className="text-sm text-stone-900 mt-1 leading-relaxed whitespace-pre-wrap">{config?.about_text || "—"}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-stone-100">
            <ReadOnlyField label="Contact Email" value={config?.contact_email} />
            <ReadOnlyField label="Contact Phone" value={config?.contact_phone} />
          </div>
        </div>
      </section>

      {/* Homepage Preview Mockup */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Homepage Preview</h2>
          {subdomainUrl && (
            <a href={subdomainUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-amber-700 hover:text-amber-800 font-medium transition-colors">
              Open store ↗
            </a>
          )}
        </div>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          {/* Simulated browser chrome */}
          <div className="bg-stone-100 border-b border-stone-200 px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-stone-300" />
              <span className="w-3 h-3 rounded-full bg-stone-300" />
              <span className="w-3 h-3 rounded-full bg-stone-300" />
            </div>
            <span className="text-xs font-mono text-stone-400 bg-white border border-stone-200 rounded px-2 py-1 flex-1 truncate">
              {subdomainUrl ?? "https://marcusco.nexpura.com"}
            </span>
          </div>
          {/* Hero section mockup */}
          <div
            className="px-8 py-10 text-center"
            style={{ backgroundColor: config?.primary_color ?? "#8B7355", backgroundImage: "linear-gradient(135deg, rgba(0,0,0,0.15) 0%, transparent 100%)" }}
          >
            <p className="text-xs font-semibold tracking-widest uppercase text-white/60 mb-2">
              {config?.website_type?.replace(/_/g, " ") ?? "Jewellery Store"}
            </p>
            <h2 className="text-2xl font-bold text-white mb-2">
              {config?.business_name ?? "Marcus & Co. Fine Jewellery"}
            </h2>
            <p className="text-sm text-white/80 max-w-md mx-auto">
              {config?.tagline ?? "Timeless jewellery crafted with precision"}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white border border-white/40 bg-white/10">
                View Collection
              </span>
              {(config?.allow_enquiry ?? true) && (
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white/70 border border-white/20">
                  Enquire
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Site Pages */}
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
                <tr key={page.slug} className="border-b border-stone-100">
                  <td className="px-4 py-3 text-sm font-semibold text-stone-900">{page.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-stone-400">{subdomainUrl ? `${subdomainUrl}${page.slug === "/" ? "" : page.slug}` : page.slug}</td>
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

      {/* Commerce Settings */}
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

      {/* Builder Capabilities */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">What You Can Configure</h2>
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
          <p className="text-xs text-stone-400 mb-4">In the live app, the Website Builder gives you full control over:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BUILDER_CAPABILITIES.map((cap) => (
              <div key={cap.label} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg border border-stone-100">
                <span className="text-xl flex-shrink-0">{cap.icon}</span>
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
