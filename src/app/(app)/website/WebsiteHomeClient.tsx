"use client";

import { Suspense, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { saveWebsiteConfig, type WebsiteConfigData } from "./actions";
import { publishAllPages } from "./builder/actions";
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

  const previewUrl = config.subdomain
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${config.subdomain}?preview=true`
    : null;

  const draftCount = pages.filter((p) => !p.published).length;
  const homeBuilderHref = (() => {
    const home = pages.find((p) => p.page_type === "home") || pages[0];
    return home ? `/website/builder/${home.id}` : "/website/builder";
  })();

  function setTab(t: Tab) {
    router.replace(pathname + (t !== "site" ? `?tab=${t}` : ""));
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Your website</h1>
          <p className="text-stone-500 mt-1 text-sm">
            {pages.length} page{pages.length === 1 ? "" : "s"} ·{" "}
            {draftCount > 0 ? (
              <span className="text-amber-700 font-medium">
                {draftCount} draft change{draftCount === 1 ? "" : "s"} pending publish
              </span>
            ) : (
              <span className="text-green-700">All changes published</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/website/templates"
            className="px-3.5 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:border-stone-500 transition-colors"
          >
            Browse templates
          </Link>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:border-stone-500 transition-colors"
            >
              Preview
            </a>
          )}
          <button
            onClick={handlePublishAll}
            disabled={isPending || draftCount === 0}
            className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={draftCount === 0 ? "No draft changes to publish" : "Publish all draft pages"}
          >
            {isPending ? "Publishing…" : draftCount === 0 ? "Published" : "Publish"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "site" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Page + section list */}
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900">Pages</h2>
                  <p className="text-xs text-stone-500">
                    Click a page to edit sections. The AI assistant edits everything in place.
                  </p>
                </div>
                <Link
                  href={homeBuilderHref}
                  className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                >
                  Open builder →
                </Link>
              </div>
              <ul className="divide-y divide-stone-100">
                {pages.map((p) => (
                  <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/website/builder/${p.id}`}
                          className="font-medium text-stone-900 hover:text-amber-700 truncate"
                        >
                          {p.title}
                        </Link>
                        <span className="text-[11px] uppercase tracking-wide text-stone-400">
                          /{p.slug}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {p.page_type}
                        {p.meta_title ? ` · ${p.meta_title.slice(0, 60)}` : ""}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        p.published
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {p.published ? "Live" : "Draft"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-start gap-3">
                <div className="text-amber-700 text-xl leading-none">✦</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-stone-900">
                    Edit with AI
                  </h3>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    Tell the assistant what to change — colours, copy, sections, pages, SEO. Every change saves as a draft until you click Publish.
                  </p>
                  <button
                    onClick={() => setChatOpen(true)}
                    className="mt-3 px-3.5 py-2 text-xs font-medium rounded-lg bg-stone-900 text-white hover:bg-stone-700 transition-colors lg:hidden"
                  >
                    Open assistant
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop sidebar chat */}
          <div className="hidden lg:block sticky top-4">
            <AssistantPanel tenantId={tenantId} variant="sidebar" />
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
        <div className="fixed inset-0 z-50 bg-stone-900/40 lg:hidden" onClick={() => setChatOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 top-12 bg-white rounded-t-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
              <div>
                <div className="text-sm font-semibold text-stone-900">AI assistant</div>
                <div className="text-xs text-stone-500">Drafts only — publish when ready</div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-stone-400 hover:text-stone-900 px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AssistantPanel tenantId={tenantId} variant="modal" />
            </div>
          </div>
        </div>
      )}
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
