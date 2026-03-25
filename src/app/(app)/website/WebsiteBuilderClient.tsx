"use client";

import { useState, useTransition } from "react";
import {
  saveWebsiteConfig,
  publishWebsite,
  checkSubdomainAvailable,
  type WebsiteConfigData,
} from "./actions";
import type { WebsiteType, Tab, AISuggestions, WebsiteConfig, WebsiteBuilderProps as Props, BusinessHours } from "./types";
import {
  SetupTab,
  BrandingTab,
  ContentTab,
  AITab,
  DomainTab,
  AdvancedTab,
  PreviewTab,
  ConnectMode,
  DomainGuideMode,
  TYPE_OPTIONS,
} from "./components";
import logger from "@/lib/logger";

const TABS: { id: Tab; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "branding", label: "Branding" },
  { id: "content", label: "Content" },
  { id: "ai", label: "✦ AI" },
  { id: "advanced", label: "Advanced" },
  { id: "domain", label: "Domain" },
  { id: "preview", label: "Preview" },
];

export default function WebsiteBuilderClient({ initial, tenantId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [websiteType, setWebsiteType] = useState<WebsiteType>(
    (initial?.website_type as WebsiteType) || "hosted"
  );
  const [config, setConfig] = useState<WebsiteConfig>(
    initial || {
      mode: "A",
      published: false,
      primary_color: "amber-700",
      secondary_color: "#1A1A1A",
      font: "Inter",
      show_prices: true,
      allow_enquiry: true,
      stripe_enabled: false,
      website_type: "hosted",
    }
  );
  const [subdomainInput, setSubdomainInput] = useState(initial?.subdomain || "");
  const [subdomainStatus, setSubdomainStatus] = useState<{ available?: boolean; reason?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connectSaved, setConnectSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [customDomainInput, setCustomDomainInput] = useState(initial?.custom_domain || "");
  const [externalUrlInput, setExternalUrlInput] = useState(initial?.external_url || "");
  const [selectedPlatform, setSelectedPlatform] = useState(initial?.external_platform || "");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AISuggestions | null>(null);
  const [aiApplied, setAiApplied] = useState<string | null>(null);

  // Advanced settings state
  const [announcementEnabled, setAnnouncementEnabled] = useState(initial?.announcement_bar_enabled ?? false);
  const [announcementText, setAnnouncementText] = useState(initial?.announcement_bar ?? "");
  const [enableAppointments, setEnableAppointments] = useState(initial?.enable_appointments ?? true);
  const [enableRepairsEnquiry, setEnableRepairsEnquiry] = useState(initial?.enable_repairs_enquiry ?? true);
  const [enableWhatsapp, setEnableWhatsapp] = useState(initial?.enable_whatsapp_chat ?? false);
  const [whatsappNumber, setWhatsappNumber] = useState(initial?.whatsapp_number ?? "");
  const [gaId, setGaId] = useState(initial?.google_analytics_id ?? "");
  const [fbPixelId, setFbPixelId] = useState(initial?.facebook_pixel_id ?? "");
  const [catalogueShowSku, setCatalogueShowSku] = useState(initial?.catalogue_show_sku ?? false);
  const [catalogueShowWeight, setCatalogueShowWeight] = useState(initial?.catalogue_show_weight ?? false);
  const [catalogueShowMetal, setCatalogueShowMetal] = useState(initial?.catalogue_show_metal ?? true);
  const [catalogueShowStone, setCatalogueShowStone] = useState(initial?.catalogue_show_stone ?? true);
  const [catalogueColumns, setCatalogueColumns] = useState(initial?.catalogue_grid_columns ?? 3);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(initial?.business_hours as BusinessHours | null ?? null);

  const previewUrl = config.subdomain
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${config.subdomain}?preview=true`
    : null;

  function update<K extends keyof WebsiteConfig>(field: K, value: WebsiteConfig[K]) {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleTypeChange(type: WebsiteType) {
    setWebsiteType(type);
    update("website_type", type);
    setSaved(false);
    setConnectSaved(false);
  }

  async function handleCheckSubdomain() {
    if (!subdomainInput.trim()) return;
    const result = await checkSubdomainAvailable(subdomainInput.trim());
    setSubdomainStatus(result);
    if (result.available) {
      update("subdomain", subdomainInput.trim());
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await saveWebsiteConfig({
        ...config,
        website_type: websiteType,
        custom_domain: customDomainInput || undefined,
      } as WebsiteConfigData);
      setSaved(true);
    } catch (err) {
      logger.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectSave() {
    setSaving(true);
    setConnectSaved(false);
    try {
      await saveWebsiteConfig({
        website_type: "connect",
        external_url: externalUrlInput,
        external_platform: selectedPlatform,
      } as WebsiteConfigData);
      update("external_url", externalUrlInput);
      update("external_platform", selectedPlatform);
      setConnectSaved(true);
    } catch (err) {
      logger.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle() {
    startTransition(async () => {
      const newPublished = !config.published;
      await publishWebsite(newPublished);
      update("published", newPublished);
    });
  }

  async function handleAIAction(action: string) {
    setAiLoading(true);
    setAiAction(action);
    setAiResult(null);
    setAiApplied(null);
    try {
      const res = await fetch("/api/ai/website/site-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, currentConfig: config }),
      });
      const data = await res.json() as { suggestedConfig?: Partial<WebsiteConfig>; suggestions?: string[]; rationale?: string; action?: string; error?: string };
      if (data.suggestions) {
        setAiResult({ suggestions: data.suggestions });
      } else if (data.suggestedConfig) {
        setConfig((prev) => ({ ...prev, ...data.suggestedConfig }));
        setSaved(false);
        setAiApplied(action);
        if (data.rationale) setAiResult({ rationale: data.rationale });
      }
    } catch (err) {
      logger.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  function applyTaglineSuggestion(tagline: string) {
    update("tagline", tagline);
    setAiResult(null);
    setAiApplied("suggest_tagline");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Website Builder</h1>
          <p className="text-stone-500 mt-1">
            Build and publish your public jewellery storefront.
          </p>
        </div>
        {websiteType === "hosted" && (
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                config.published
                  ? "bg-green-100 text-green-800"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${config.published ? "bg-green-500" : "bg-stone-400"}`}
              />
              {config.published ? "Published" : "Draft"}
            </div>
            <button
              onClick={handlePublishToggle}
              disabled={isPending}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                config.published
                  ? "bg-stone-200 text-stone-700 hover:bg-stone-300"
                  : "bg-amber-700 text-white hover:bg-[#7a6349]"
              } disabled:opacity-50`}
            >
              {config.published ? "Unpublish" : "Publish Site"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Website Strategy Selector */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Choose your website strategy</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            You can change this at any time. Most jewellers start with Option A or B.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = websiteType === opt.id;
            const STATUS = opt.id === "hosted"
              ? { label: "Ready to use", color: "text-green-700 bg-green-50" }
              : opt.id === "connect"
              ? { label: "Ready to use", color: "text-green-700 bg-green-50" }
              : { label: "Guided setup", color: "text-amber-700 bg-amber-50" };
            return (
              <button
                key={opt.id}
                onClick={() => handleTypeChange(opt.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                  isSelected
                    ? "border-amber-600 bg-white shadow-sm"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                {opt.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 bg-amber-700 text-white rounded-full">
                    {opt.badge}
                  </span>
                )}
                <Icon
                  size={20}
                  className={`mb-2 ${isSelected ? "text-amber-700" : "text-stone-400"}`}
                />
                <div className="font-semibold text-stone-900 text-sm">{opt.title}</div>
                <div className="text-xs text-stone-500 mt-1 leading-relaxed mb-2">{opt.desc}</div>
                <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS.color}`}>
                  {STATUS.label}
                </span>
                {isSelected && (
                  <span className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-amber-700 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          <strong>Option A</strong> — We host and serve your site. Full control via the tabs below. ·{" "}
          <strong>Option B</strong> — Keep your existing site (Shopify, Squarespace, Wix etc.) and embed our widgets. ·{" "}
          <strong>Option C</strong> — No site yet? We'll walk you through getting a domain first.
        </p>
      </div>

      {/* HOSTED MODE */}
      {websiteType === "hosted" && (
        <>
          {/* Tabs */}
          <div className="border-b border-stone-200">
            <nav className="flex gap-1 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-amber-600 text-amber-700"
                      : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

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

          {activeTab === "branding" && (
            <BrandingTab config={config} update={update} tenantId={tenantId} />
          )}

          {activeTab === "content" && (
            <ContentTab config={config} update={update} />
          )}

          {activeTab === "ai" && (
            <AITab
              config={config}
              aiLoading={aiLoading}
              aiAction={aiAction}
              aiResult={aiResult}
              aiApplied={aiApplied}
              onAIAction={handleAIAction}
              onApplyTagline={applyTaglineSuggestion}
              onDismiss={() => setAiResult(null)}
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
              onSave={handleSave}
              saving={saving}
              saved={saved}
            />
          )}

          {activeTab === "preview" && (
            <PreviewTab
              config={config}
              previewUrl={previewUrl}
              onPublishToggle={handlePublishToggle}
              isPending={isPending}
            />
          )}
        </>
      )}

      {/* CONNECT MODE */}
      {websiteType === "connect" && (
        <ConnectMode
          config={config}
          tenantId={tenantId}
          externalUrlInput={externalUrlInput}
          setExternalUrlInput={setExternalUrlInput}
          selectedPlatform={selectedPlatform}
          setSelectedPlatform={setSelectedPlatform}
          onSave={handleConnectSave}
          saving={saving}
          connectSaved={connectSaved}
        />
      )}

      {/* DOMAIN GUIDE MODE */}
      {websiteType === "domain-guide" && (
        <DomainGuideMode onTypeChange={handleTypeChange} />
      )}
    </div>
  );
}
