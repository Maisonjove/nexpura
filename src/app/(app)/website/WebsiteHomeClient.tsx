"use client";

import { Suspense, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { saveWebsiteConfig, switchWebsiteType, type WebsiteConfigData } from "./actions";
import { publishAllPages, unpublishAllPages } from "./builder/actions";
import { TEMPLATES } from "@/lib/templates/data";
import TemplateGalleryClient from "./templates/TemplateGalleryClient";
import {
  validateEmail,
  validatePhone,
  validateUrl,
} from "./validation";
import type {
  WebsiteConfig,
  BusinessHours,
  SocialLinks,
} from "./types";
import {
  SetupTab,
  DomainTab,
  AdvancedTab,
  PreviewTab,
} from "./components";
import logger from "@/lib/logger";

// Phase 2 entry: page list + AI chat assistant + manual publish.
// Lazy-load AI chat panel — only the shop-owner who opens it pays the cost.
const AssistantPanel = dynamic(() => import("./components/AssistantPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-8 text-xs text-stone-400 animate-pulse">
      Loading assistant…
    </div>
  ),
});

type PageRow = {
  id: string;
  slug: string;
  title: string;
  page_type: string;
  published: boolean;
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string | null;
};

type Tab = "site" | "setup" | "domain" | "advanced" | "preview";
const TABS: { id: Tab; label: string }[] = [
  { id: "site", label: "Your Site" },
  { id: "setup", label: "Setup" },
  { id: "domain", label: "Domain" },
  { id: "advanced", label: "Advanced" },
  { id: "preview", label: "Preview" },
];

function WebsiteHomeInner({
  initialConfig,
  tenantId,
  pages,
}: {
  initialConfig: WebsiteConfig | null;
  tenantId: string;
  pages: PageRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  // Legacy tabs (branding/content/ai) collapse onto "site". Defaults to site.
  const activeTab: Tab = ((): Tab => {
    if (tabParam === "setup" || tabParam === "domain" || tabParam === "advanced" || tabParam === "preview") {
      return tabParam;
    }
    return "site";
  })();

  const [config, setConfig] = useState<WebsiteConfig>(
    initialConfig ?? {
      mode: "A",
      published: false,
      primary_color: "#c9a96e",
      secondary_color: "#1a1a1a",
      font: "Inter",
      show_prices: true,
      allow_enquiry: true,
      stripe_enabled: false,
      website_type: "hosted",
    },
  );
  const [subdomainInput, setSubdomainInput] = useState(initialConfig?.subdomain || "");
  const [subdomainStatus, setSubdomainStatus] = useState<{
    available?: boolean;
    reason?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Advanced tab state, mirrored from the original client.
  const [customDomainInput, setCustomDomainInput] = useState(initialConfig?.custom_domain || "");
  const [announcementEnabled, setAnnouncementEnabled] = useState(initialConfig?.announcement_bar_enabled ?? false);
  const [announcementText, setAnnouncementText] = useState(initialConfig?.announcement_bar ?? "");
  const [enableAppointments, setEnableAppointments] = useState(initialConfig?.enable_appointments ?? true);
  const [enableRepairsEnquiry, setEnableRepairsEnquiry] = useState(initialConfig?.enable_repairs_enquiry ?? true);
  const [enableWhatsapp, setEnableWhatsapp] = useState(initialConfig?.enable_whatsapp_chat ?? false);
  const [whatsappNumber, setWhatsappNumber] = useState(initialConfig?.whatsapp_number ?? "");
  const [gaId, setGaId] = useState(initialConfig?.google_analytics_id ?? "");
  const [fbPixelId, setFbPixelId] = useState(initialConfig?.facebook_pixel_id ?? "");
  const [catalogueShowSku, setCatalogueShowSku] = useState(initialConfig?.catalogue_show_sku ?? false);
  const [catalogueShowWeight, setCatalogueShowWeight] = useState(initialConfig?.catalogue_show_weight ?? false);
  const [catalogueShowMetal, setCatalogueShowMetal] = useState(initialConfig?.catalogue_show_metal ?? true);
  const [catalogueShowStone, setCatalogueShowStone] = useState(initialConfig?.catalogue_show_stone ?? true);
  const [catalogueColumns, setCatalogueColumns] = useState(initialConfig?.catalogue_grid_columns ?? 3);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(initialConfig?.business_hours as BusinessHours | null ?? null);
  const [customCss, setCustomCss] = useState<string>(initialConfig?.custom_css ?? "");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(initialConfig?.social_links as SocialLinks ?? { instagram: "", facebook: "", tiktok: "", youtube: "", pinterest: "" });

  const [chatOpen, setChatOpen] = useState(false);

  function update<K extends keyof WebsiteConfig>(field: K, value: WebsiteConfig[K]) {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleCheckSubdomain() {
    if (!subdomainInput.trim()) return;
    const { checkSubdomainAvailable } = await import("./actions");
    const result = await checkSubdomainAvailable(subdomainInput.trim());
    setSubdomainStatus(result);
    if (result.available) update("subdomain", subdomainInput.trim());
  }

  async function handleSave() {
    if (config.contact_email) {
      const v = validateEmail(config.contact_email);
      if (!v.valid) return toast.error(v.error);
    }
    if (config.contact_phone) {
      const v = validatePhone(config.contact_phone);
      if (!v.valid) return toast.error(v.error);
    }
    if (config.external_url) {
      const v = validateUrl(config.external_url);
      if (!v.valid) return toast.error(v.error);
    }
    setSaving(true);
    setSaved(false);
    const t = toast.loading("Saving website settings…");
    try {
      const result = await saveWebsiteConfig({
        ...config,
        website_type: "hosted",
        custom_domain: customDomainInput || undefined,
      } as WebsiteConfigData);
      if (result.error) toast.error(result.error, { id: t });
      else {
        setSaved(true);
        toast.success("Website settings saved", { id: t });
      }
    } catch (err) {
      logger.error(err);
      toast.error("Failed to save. Please try again.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  function handlePublishAll() {
    if (isPending) return;
    const t = toast.loading("Publishing draft to live…");
    startTransition(async () => {
      const r = await publishAllPages();
      if (r.error) {
        toast.error(r.error, { id: t });
      } else {
        toast.success(`Published ${r.published ?? 0} page${r.published === 1 ? "" : "s"}`, { id: t });
        router.refresh();
      }
    });
  }

  function handleUnpublishAll() {
    if (isPending) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Take your site offline? Visitors will see a coming-soon page until you publish again.",
      )
    ) {
      return;
    }
    const t = toast.loading("Taking site offline…");
    startTransition(async () => {
      const r = await unpublishAllPages();
      if (r.error) {
        toast.error(r.error, { id: t });
      } else {
        toast.success(`Unpublished ${r.unpublished ?? 0} page${r.unpublished === 1 ? "" : "s"}`, { id: t });
        router.refresh();
      }
    });
  }

  function handleSwitchToConnect() {
    if (isPending) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Switch to 'connect existing website'? You can switch back any time from Setup.",
      )
    ) {
      return;
    }
    const t = toast.loading("Switching mode…");
    startTransition(async () => {
      const r = await switchWebsiteType("connect");
      if (r.error) {
        toast.error(r.error, { id: t });
      } else {
        toast.success("Switched to connect mode", { id: t });
        // page.tsx will route to legacy WebsiteBuilderClient → ConnectMode
        router.refresh();
      }
    });
  }

  const previewUrl = config.subdomain
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${config.subdomain}?preview=true`
    : null;

  const draftCount = pages.filter((p) => !p.published).length;
  const hasTemplate = pages.length > 0;
  const homeBuilderHref = (() => {
    const home = pages.find((p) => p.page_type === "home") || pages[0];
    return home ? `/website/builder/${home.id}` : "/website/builder";
  })();

  function setTab(t: Tab) {
    router.replace(pathname + (t !== "site" ? `?tab=${t}` : ""));
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16 space-y-12 pb-24">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-luxury text-nexpura-bronze font-medium">
              Website
            </div>
            <h1 className="font-serif text-4xl lg:text-5xl text-stone-900 leading-[1.05] tracking-tight">
              Your website
            </h1>
            {hasTemplate ? (
              <p className="text-stone-500 text-sm tracking-refined">
                {pages.length} page{pages.length === 1 ? "" : "s"}
                <span className="mx-2 text-stone-300">·</span>
                {draftCount > 0 ? (
                  <span className="text-nexpura-bronze font-medium">
                    {draftCount} draft change{draftCount === 1 ? "" : "s"} pending publish
                  </span>
                ) : (
                  <span className="text-emerald-700">All changes published</span>
                )}
              </p>
            ) : (
              <p className="text-stone-500 text-sm tracking-refined max-w-xl">
                Pick a template below to start, or{" "}
                <button
                  type="button"
                  onClick={handleSwitchToConnect}
                  disabled={isPending}
                  className="text-nexpura-bronze hover:text-nexpura-bronze-hover underline underline-offset-4 decoration-nexpura-bronze/30 hover:decoration-nexpura-bronze transition-colors disabled:opacity-50"
                >
                  connect an existing site instead →
                </button>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasTemplate && (
              <Link
                href="/website/templates"
                className="px-4 py-2.5 rounded-full text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
              >
                Browse templates
              </Link>
            )}
            {previewUrl && hasTemplate && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-full text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
              >
                Preview
              </a>
            )}
            {hasTemplate && pages.some((p) => p.published) && (
              <button
                onClick={handleUnpublishAll}
                disabled={isPending}
                className="px-4 py-2.5 rounded-full text-sm font-medium border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Take the site offline (drafts only — visitors see a coming-soon page)"
              >
                Unpublish
              </button>
            )}
            {hasTemplate && (
              <button
                onClick={handlePublishAll}
                disabled={isPending || draftCount === 0}
                className="inline-flex items-center justify-center px-7 py-3 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] text-white text-sm font-medium tracking-[0.01em] hover:shadow-[0_2px_4px_rgba(0,0,0,0.3),0_12px_28px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] transition-shadow duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title={draftCount === 0 ? "No draft changes to publish" : "Publish all draft pages"}
              >
                {isPending ? "Publishing…" : draftCount === 0 ? "Published" : "Publish"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-stone-200">
          <nav className="flex gap-6 -mb-px overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`pb-3 pt-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors tracking-refined ${
                  activeTab === t.id
                    ? "border-nexpura-bronze text-stone-900"
                    : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === "site" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
            {/* Main column: page list when a template is applied, gallery otherwise */}
            <div className="space-y-6">
              {hasTemplate ? (
                <>
                  <div className="rounded-2xl border border-stone-200 bg-white hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all duration-400">
                    <div className="flex items-center justify-between px-6 lg:px-8 py-6 border-b border-stone-100">
                      <div>
                        <div className="text-[10px] uppercase tracking-luxury text-nexpura-bronze font-medium mb-1">
                          Pages
                        </div>
                        <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                          Your site structure
                        </h2>
                        <p className="text-xs text-stone-500 mt-1.5 tracking-refined">
                          Click a page to edit sections. The AI assistant edits everything in place.
                        </p>
                      </div>
                      <Link
                        href={homeBuilderHref}
                        className="text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover font-medium tracking-refined whitespace-nowrap"
                      >
                        Open builder →
                      </Link>
                    </div>
                    <ul className="divide-y divide-stone-100">
                      {pages.map((p) => (
                        <li key={p.id} className="px-6 lg:px-8 py-4 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors duration-200">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/website/builder/${p.id}`}
                                className="font-medium text-stone-900 hover:text-nexpura-bronze truncate transition-colors"
                              >
                                {p.title}
                              </Link>
                              <span className="text-[10px] uppercase tracking-luxury text-stone-400">
                                /{p.slug}
                              </span>
                            </div>
                            <div className="text-xs text-stone-500 mt-1">
                              {p.page_type}
                              {p.meta_title ? ` · ${p.meta_title.slice(0, 60)}` : ""}
                            </div>
                          </div>
                          <span
                            className={`${
                              p.published ? "nx-badge-success" : "nx-badge-neutral"
                            } uppercase tracking-luxury text-[10px]`}
                          >
                            {p.published ? "Live" : "Draft"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:p-8">
                    <div className="flex items-start gap-5">
                      <div className="text-nexpura-bronze text-2xl leading-none font-serif shrink-0">✦</div>
                      <div className="flex-1">
                        <div className="text-[10px] uppercase tracking-luxury text-nexpura-bronze font-medium mb-1">
                          AI Assistant
                        </div>
                        <h3 className="font-serif text-xl text-stone-900 tracking-tight">
                          Edit with AI
                        </h3>
                        <p className="text-sm text-stone-500 mt-2 leading-relaxed tracking-refined max-w-xl">
                          Tell the assistant what to change — colours, copy, sections, pages, SEO. Every change saves as a draft until you click Publish.
                        </p>
                        <button
                          onClick={() => setChatOpen(true)}
                          className="mt-5 inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] text-white text-xs font-medium tracking-[0.01em] hover:shadow-[0_2px_4px_rgba(0,0,0,0.3),0_12px_28px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] transition-shadow duration-300 lg:hidden"
                        >
                          Open assistant
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <TemplateGalleryClient templates={TEMPLATES} embedded />
                  {/* Mobile-only "open assistant" launcher mirrors the with-template layout */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:p-8 lg:hidden">
                    <div className="flex items-start gap-5">
                      <div className="text-nexpura-bronze text-2xl leading-none font-serif shrink-0">✦</div>
                      <div className="flex-1">
                        <div className="text-[10px] uppercase tracking-luxury text-nexpura-bronze font-medium mb-1">
                          AI Assistant
                        </div>
                        <h3 className="font-serif text-xl text-stone-900 tracking-tight">
                          Ask the AI assistant
                        </h3>
                        <p className="text-sm text-stone-500 mt-2 leading-relaxed tracking-refined max-w-xl">
                          Not sure which template fits? Ask the assistant — it can recommend a starting point.
                        </p>
                        <button
                          onClick={() => setChatOpen(true)}
                          className="mt-5 inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] text-white text-xs font-medium tracking-[0.01em] hover:shadow-[0_2px_4px_rgba(0,0,0,0.3),0_12px_28px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] transition-shadow duration-300"
                        >
                          Open assistant
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Desktop sidebar chat — visible regardless of template state */}
            <div className="hidden lg:block sticky top-6">
              <AssistantPanel
                tenantId={tenantId}
                variant="sidebar"
                hasTemplate={hasTemplate}
              />
            </div>
          </div>
        )}

        {activeTab === "setup" && (
          <SetupTab
            config={config}
            update={update}
            subdomainInput={subdomainInput}
            setSubdomainInput={setSubdomainInput}
            subdomainStatus={subdomainStatus}
            setSubdomainStatus={setSubdomainStatus}
            onCheckSubdomain={handleCheckSubdomain}
          />
        )}
        {activeTab === "domain" && (
          <DomainTab
            config={config}
            customDomainInput={customDomainInput}
            setCustomDomainInput={setCustomDomainInput}
            onSave={handleSave}
            saving={saving}
          />
        )}
        {activeTab === "advanced" && (
          <AdvancedTab
            config={config}
            update={update}
            announcementEnabled={announcementEnabled}
            setAnnouncementEnabled={setAnnouncementEnabled}
            announcementText={announcementText}
            setAnnouncementText={setAnnouncementText}
            enableAppointments={enableAppointments}
            setEnableAppointments={setEnableAppointments}
            enableRepairsEnquiry={enableRepairsEnquiry}
            setEnableRepairsEnquiry={setEnableRepairsEnquiry}
            enableWhatsapp={enableWhatsapp}
            setEnableWhatsapp={setEnableWhatsapp}
            whatsappNumber={whatsappNumber}
            setWhatsappNumber={setWhatsappNumber}
            gaId={gaId}
            setGaId={setGaId}
            fbPixelId={fbPixelId}
            setFbPixelId={setFbPixelId}
            catalogueShowSku={catalogueShowSku}
            setCatalogueShowSku={setCatalogueShowSku}
            catalogueShowWeight={catalogueShowWeight}
            setCatalogueShowWeight={setCatalogueShowWeight}
            catalogueShowMetal={catalogueShowMetal}
            setCatalogueShowMetal={setCatalogueShowMetal}
            catalogueShowStone={catalogueShowStone}
            setCatalogueShowStone={setCatalogueShowStone}
            catalogueColumns={catalogueColumns}
            setCatalogueColumns={setCatalogueColumns}
            businessHours={businessHours}
            setBusinessHours={setBusinessHours}
            customCss={customCss}
            setCustomCss={setCustomCss}
            socialLinks={socialLinks}
            setSocialLinks={setSocialLinks}
            onSave={handleSave}
            saving={saving}
            saved={saved}
          />
        )}
        {activeTab === "preview" && (
          <PreviewTab
            config={config}
            previewUrl={previewUrl}
            onPublishToggle={handlePublishAll}
            isPending={isPending}
          />
        )}

        {/* Mobile/full-screen modal */}
        {chatOpen && (
          <div className="fixed inset-0 z-50 bg-nexpura-charcoal/50 backdrop-blur-sm lg:hidden" onClick={() => setChatOpen(false)}>
            <div
              className="absolute inset-x-0 bottom-0 top-12 bg-white rounded-t-3xl flex flex-col shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
                <div>
                  <div className="text-[10px] uppercase tracking-luxury text-nexpura-bronze font-medium mb-0.5">
                    AI Assistant
                  </div>
                  <div className="text-xs text-stone-500">Drafts only — publish when ready</div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-stone-400 hover:text-stone-900 px-3 py-1.5 text-sm rounded-full hover:bg-stone-50 transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AssistantPanel
                  tenantId={tenantId}
                  variant="modal"
                  hasTemplate={hasTemplate}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WebsiteHomeClient(props: {
  initialConfig: WebsiteConfig | null;
  tenantId: string;
  pages: PageRow[];
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-stone-400">Loading…</div>}>
      <WebsiteHomeInner {...props} />
    </Suspense>
  );
}
