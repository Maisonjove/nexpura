import { createAdminClient } from "@/lib/supabase/admin";
import WebsiteBuilderClient from "@/app/(app)/website/WebsiteBuilderClient";

const TENANT_ID = "0e8fe647-0cf4-44b6-ab12-3c6c7e561f0a";
export const revalidate = 60;

export default async function ReviewWebsitePage() {
  const admin = createAdminClient();

  const { data: config } = await admin
    .from("website_config")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();

  const previewUrl = config?.subdomain
    ? `https://${config.subdomain}.nexpura.com`
    : null;

  const MODE_LABELS: Record<string, { title: string; desc: string }> = {
    A: { title: "Catalogue Only", desc: "Public product catalogue — browse without checkout" },
    B: { title: "Catalogue + Enquiry", desc: "Product catalogue with customer enquiry forms" },
    C: { title: "Full Online Store", desc: "Full e-commerce with cart and checkout" },
  };
  const modeInfo = MODE_LABELS[config?.mode ?? "B"] ?? MODE_LABELS["B"];

  return (
    <div className="space-y-4">
      {/* Live website preview card */}
      {config && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: `${config.primary_color ?? "#8B7355"}22` }}>
              🌐
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-stone-900">{config.business_name ?? "Marcus & Co."}</p>
                {config.published && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-sm text-stone-500 mt-0.5">{config.tagline}</p>
              {previewUrl && (
                <p className="text-xs font-mono text-amber-700 mt-0.5">{previewUrl}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-stone-400">Website Mode</p>
              <p className="text-sm font-semibold text-stone-900">{modeInfo.title}</p>
              <p className="text-xs text-stone-400 mt-0.5">{modeInfo.desc}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <span className={`px-2 py-0.5 rounded text-center ${config.show_prices ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-400"}`}>
                {config.show_prices ? "✓ Prices" : "No prices"}
              </span>
              <span className={`px-2 py-0.5 rounded text-center ${config.allow_enquiry ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-400"}`}>
                {config.allow_enquiry ? "✓ Enquiry" : "No enquiry"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Full website builder */}
      <WebsiteBuilderClient
        initial={config}
        tenantId={TENANT_ID}
      />
    </div>
  );
}
