import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { planIncludes, PLAN_NAMES, PlanId } from "@/lib/plans";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates/data";
import TemplateGalleryClient from "./templates/TemplateGalleryClient";
import WebsiteHomeClient from "./WebsiteHomeClient";
import WebsiteBuilderClient from "./WebsiteBuilderClient";

export const metadata = { title: "Website Builder — Nexpura" };

/**
 * Phase 2 entry point.
 *
 * If this tenant has no `site_pages` rows yet → land directly on the
 * template gallery. Picking a template seeds rows and brings them into the
 * "your site" view on the next visit.
 *
 * If this tenant already has site_pages → land on the new "your site" view
 * (page list + AI chat panel + publish button + the surviving Setup/Domain/
 * Advanced/Preview tabs).
 *
 * The legacy /website?tab=branding|content|ai routes simply fall back to
 * Setup since those tabs no longer exist; the AI panel takes over their job.
 */
export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

  // Entitlement gate: Website Builder requires Studio or Atelier
  if (!planIncludes(ctx.plan as PlanId, "websiteBuilder")) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-2xl">🌐</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Website Builder</h1>
          <p className="text-stone-500 mt-2 text-sm leading-relaxed">
            Your current plan{" "}
            <strong className="text-stone-900">{PLAN_NAMES[ctx.plan as PlanId]}</strong>{" "}
            does not include the Website Builder. Upgrade to{" "}
            <strong className="text-stone-900">Studio</strong> or{" "}
            <strong className="text-stone-900">Atelier</strong> to build and publish your jewellery website directly from Nexpura.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-700 text-white rounded-xl font-medium text-sm hover:bg-amber-800 transition-colors"
        >
          Upgrade Plan →
        </Link>
        <p className="text-xs text-stone-400">
          Website Builder and Connect Existing Website are included in Studio ($179/mo) and Atelier ($299/mo).
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: config }, { data: pages }] = await Promise.all([
    admin
      .from("website_config")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    admin
      .from("site_pages")
      .select("id, slug, title, page_type, published, meta_title, meta_description, updated_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true }),
  ]);

  const websiteType = (config?.website_type as string | undefined) ?? "hosted";
  const hasTemplate = (pages?.length ?? 0) > 0;

  // Connect / domain-guide modes use the legacy client, untouched. The Phase 2
  // gallery + AI flow only applies to "hosted" tenants — connecting to an
  // existing Shopify/Squarespace site is unrelated.
  if (websiteType !== "hosted") {
    return (
      <WebsiteBuilderClient
        initial={config}
        tenantId={ctx.tenantId}
      />
    );
  }

  // No template applied yet — gallery is the entry point.
  if (!hasTemplate) {
    return (
      <div className="space-y-4">
        <div className="max-w-6xl mx-auto px-4 pt-2">
          <p className="text-xs text-stone-500">
            Pick a template to start. Once applied you can edit it visually or via the AI assistant.
          </p>
        </div>
        <TemplateGalleryClient templates={TEMPLATES} />
      </div>
    );
  }

  // Tenant has pages — show the new "your site" home with AI assistant.
  return (
    <WebsiteHomeClient
      initialConfig={config}
      tenantId={ctx.tenantId}
      pages={(pages || []).map((p) => ({
        id: p.id as string,
        slug: p.slug as string,
        title: p.title as string,
        page_type: p.page_type as string,
        published: Boolean(p.published),
        meta_title: (p.meta_title as string | null) ?? null,
        meta_description: (p.meta_description as string | null) ?? null,
        updated_at: (p.updated_at as string | null) ?? null,
      }))}
    />
  );
}
