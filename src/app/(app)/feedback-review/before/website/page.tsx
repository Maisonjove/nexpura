import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getEntitlementContext } from "@/lib/auth/entitlements";
import { planIncludes, PLAN_NAMES, PlanId } from "@/lib/plans";
import Link from "next/link";
import WebsiteHomeClientLegacy from "../../../website/WebsiteHomeClientLegacy";
import WebsiteBuilderClient from "../../../website/WebsiteBuilderClient";

export const metadata = { title: "Website (Before) — Feedback Review" };

export default async function WebsiteBeforePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getEntitlementContext();
  if (!ctx.tenantId) redirect("/login");

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
            does not include the Website Builder.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-nexpura-charcoal text-white rounded-xl font-medium text-sm hover:bg-nexpura-charcoal-700 transition-colors"
        >
          Upgrade Plan →
        </Link>
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

  if (websiteType !== "hosted") {
    return (
      <WebsiteBuilderClient
        initial={config}
        tenantId={ctx.tenantId}
      />
    );
  }

  return (
    <WebsiteHomeClientLegacy
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
