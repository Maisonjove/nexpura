"use client";

import { useState, useTransition } from "react";
import ImageUpload from "@/components/ui/ImageUpload";
import {
  saveWebsiteConfig,
  publishWebsite,
  checkSubdomainAvailable,
  type WebsiteConfigData,
} from "./actions";
import { Globe, Link2, ShoppingCart, Copy, Check, ExternalLink } from "lucide-react";

type WebsiteType = "hosted" | "connect" | "domain-guide";
type Tab = "setup" | "branding" | "content" | "ai" | "domain" | "preview";

interface AISuggestions {
  suggestions?: string[];
  rationale?: string;
  action?: string;
}

interface WebsiteConfig {
  id?: string;
  tenant_id?: string;
  mode?: string;
  published?: boolean;
  subdomain?: string;
  custom_domain?: string;
  business_name?: string;
  tagline?: string;
  logo_url?: string;
  hero_image_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font?: string;
  about_text?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  social_instagram?: string;
  social_facebook?: string;
  stripe_enabled?: boolean;
  show_prices?: boolean;
  allow_enquiry?: boolean;
  meta_title?: string;
  meta_description?: string;
  website_type?: string;
  external_url?: string;
  external_platform?: string;
  domain_verified?: boolean;
}

interface Props {
  initial: WebsiteConfig | null;
  tenantId: string;
}

const FONTS = ["Inter", "Playfair Display", "Cormorant Garamond"];

const MODES = [
  {
    id: "A",
    name: "Catalogue",
    desc: "Show your inventory publicly. No prices, enquiry form only.",
    icon: "🗂️",
  },
  {
    id: "B",
    name: "Catalogue + Enquiry",
    desc: "Show inventory with prices. Customers can send enquiries.",
    icon: "💬",
  },
  {
    id: "C",
    name: "Full Store",
    desc: "Full e-commerce. Customers can buy directly. Stripe required.",
    icon: "🛒",
  },
];

const TYPE_OPTIONS = [
  {
    id: "hosted" as WebsiteType,
    icon: Globe,
    title: "Nexpura Hosted",
    desc: "We build and host your jewellery website. Pick a style, add your branding, go live.",
    badge: "Most Popular",
  },
  {
    id: "connect" as WebsiteType,
    icon: Link2,
    title: "Connect My Site",
    desc: "Already have a Squarespace, Wix, Shopify or custom site? Connect it and embed your live inventory.",
    badge: null,
  },
  {
    id: "domain-guide" as WebsiteType,
    icon: ShoppingCart,
    title: "Get a Domain First",
    desc: "Don't have a website yet? We'll guide you through buying a domain and getting online.",
    badge: null,
  },
];

const PLATFORMS = [
  { id: "squarespace", label: "Squarespace" },
  { id: "wix", label: "Wix" },
  { id: "shopify", label: "Shopify" },
  { id: "wordpress", label: "WordPress" },
  { id: "webflow", label: "Webflow" },
  { id: "other", label: "Custom / Other" },
];

const PLATFORM_INSTRUCTIONS: Record<string, string[]> = {
  squarespace: [
    "Go to Pages → select the page where you want the catalogue",
    "Add a Code Block (insert point → +)",
    "Paste this code:",
  ],
  wix: [
    "Go to your Wix Editor",
    "Add → Embed → Custom Code (HTML iframe)",
    "Paste this code:",
  ],
  shopify: [
    "Go to Online Store → Themes → Edit Code",
    "Open the page template where you want the widget",
    "Paste this code before </body>:",
  ],
  wordpress: [
    "Edit the page in WordPress",
    "Add a Custom HTML block",
    "Paste this code:",
  ],
  webflow: [
    "Open the page in Webflow Designer",
    "Add an Embed element",
    "Paste this code:",
  ],
  other: [
    "Open your website's HTML file or page template",
    "Paste this code anywhere in <body>:",
  ],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy Code"}
    </button>
  );
}

export default function WebsiteBuilderClient({ initial, tenantId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [websiteType, setWebsiteType] = useState<WebsiteType>(
    (initial?.website_type as WebsiteType) || "hosted"
  );
  const [config, setConfig] = useState<WebsiteConfig>(
    initial || {
      mode: "A",
      published: false,
      primary_color: "#8B7355",
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AISuggestions | null>(null);
  const [aiApplied, setAiApplied] = useState<string | null>(null);

  const previewUrl = config.subdomain
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${config.subdomain}?preview=true`
    : null;

  const embedCode = `<!-- Nexpura Live Catalogue Widget -->
<div id="nexpura-widget"></div>
<script src="https://nexpura-delta.vercel.app/widget.js"
  data-tenant="${tenantId}"
  data-theme="light"
  data-mode="${config.mode || "catalogue"}"
  async>
</script>`;

  const catalogueLink = `https://nexpura-delta.vercel.app/${config.subdomain || tenantId}/catalogue`;

  function update(field: keyof WebsiteConfig, value: unknown) {
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
      console.error(err);
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
      console.error(err);
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
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  function applyTaglineSuggestion(tagline: string) {
    update("tagline", tagline);
    setAiResult(null);
    setAiApplied("suggest_tagline");
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "setup", label: "Setup" },
    { id: "branding", label: "Branding" },
    { id: "content", label: "Content" },
    { id: "ai", label: "✦ AI" },
    { id: "domain", label: "Domain" },
    { id: "preview", label: "Preview" },
  ];

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
                  : "bg-[#8B7355] text-white hover:bg-[#7a6349]"
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

      {/* ── Website Type Selector ── */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-stone-600">How do you want your website?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = websiteType === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleTypeChange(opt.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all relative ${
                  isSelected
                    ? "border-[#8B7355] bg-[#8B7355]/5"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                {opt.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 bg-[#8B7355] text-white rounded-full">
                    {opt.badge}
                  </span>
                )}
                <Icon
                  size={20}
                  className={`mb-2 ${isSelected ? "text-[#8B7355]" : "text-stone-400"}`}
                />
                <div className="font-semibold text-stone-900 text-sm">{opt.title}</div>
                <div className="text-xs text-stone-500 mt-1 leading-relaxed">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── HOSTED MODE ── */}
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
                      ? "border-[#8B7355] text-[#8B7355]"
                      : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── Tab: Setup ── */}
          {activeTab === "setup" && (
            <div className="space-y-6">
              {/* Mode selector */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">Website Mode</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => update("mode", m.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        config.mode === m.id
                          ? "border-[#8B7355] bg-[#8B7355]/5"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <div className="text-2xl mb-2">{m.icon}</div>
                      <div className="font-medium text-stone-900 text-sm">
                        Mode {m.id} — {m.name}
                      </div>
                      <div className="text-xs text-stone-500 mt-1 leading-relaxed">{m.desc}</div>
                    </button>
                  ))}
                </div>
                {config.mode === "C" && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-amber-600 text-sm">⚠️</span>
                    <p className="text-sm text-amber-800">
                      Mode C requires Stripe to be configured in your billing settings.
                    </p>
                  </div>
                )}
              </div>

              {/* Subdomain */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">Your Website URL</h2>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#8B7355]/30 focus-within:border-[#8B7355]">
                    <input
                      type="text"
                      value={subdomainInput}
                      onChange={(e) => {
                        setSubdomainInput(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                        );
                        setSubdomainStatus(null);
                      }}
                      placeholder="your-shop"
                      className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                    />
                    <span className="px-3 text-sm text-stone-400 bg-stone-50 border-l border-stone-200 py-2 whitespace-nowrap">
                      .nexpura.com
                    </span>
                  </div>
                  <button
                    onClick={handleCheckSubdomain}
                    className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
                  >
                    Check
                  </button>
                </div>
                {subdomainStatus && (
                  <p
                    className={`text-sm ${subdomainStatus.available ? "text-green-600" : "text-red-600"}`}
                  >
                    {subdomainStatus.available
                      ? `✓ "${subdomainInput}" is available!`
                      : `✗ ${subdomainStatus.reason}`}
                  </p>
                )}
                {config.subdomain && (
                  <p className="text-sm text-stone-500">
                    Current:{" "}
                    <a
                      href={`/${config.subdomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#8B7355] hover:underline"
                    >
                      {config.subdomain}.nexpura.com
                    </a>
                  </p>
                )}
              </div>

              {/* Mode B/C settings */}
              {(config.mode === "B" || config.mode === "C") && (
                <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h2 className="text-base font-semibold text-stone-900">Store Settings</h2>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.show_prices ?? true}
                        onChange={(e) => update("show_prices", e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-[#8B7355] focus:ring-[#8B7355]"
                      />
                      <span className="text-sm text-stone-700">Show prices on catalogue</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.allow_enquiry ?? true}
                        onChange={(e) => update("allow_enquiry", e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-[#8B7355] focus:ring-[#8B7355]"
                      />
                      <span className="text-sm text-stone-700">Allow customer enquiries</span>
                    </label>
                    {config.mode === "C" && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.stripe_enabled ?? false}
                          onChange={(e) => update("stripe_enabled", e.target.checked)}
                          className="w-4 h-4 rounded border-stone-300 text-[#8B7355] focus:ring-[#8B7355]"
                        />
                        <span className="text-sm text-stone-700">Enable Stripe payments</span>
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Branding ── */}
          {activeTab === "branding" && (
            <div className="space-y-6">
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5">
                <h2 className="text-base font-semibold text-stone-900">Business Identity</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={config.business_name || ""}
                      onChange={(e) => update("business_name", e.target.value)}
                      placeholder="e.g. Goldsmith Jewellers"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Tagline
                    </label>
                    <input
                      type="text"
                      value={config.tagline || ""}
                      onChange={(e) => update("tagline", e.target.value)}
                      placeholder="e.g. Crafting timeless pieces since 1985"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355]"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5">
                <h2 className="text-base font-semibold text-stone-900">Logo & Hero Image</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                      Logo
                    </p>
                    <ImageUpload
                      bucket="nexpura-public"
                      path={`${tenantId}/website`}
                      existingImages={config.logo_url ? [config.logo_url] : []}
                      maxImages={1}
                      variant="single"
                      onUploadComplete={(urls) => update("logo_url", urls[0] || null)}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                      Hero Image
                    </p>
                    <ImageUpload
                      bucket="nexpura-public"
                      path={`${tenantId}/website`}
                      existingImages={config.hero_image_url ? [config.hero_image_url] : []}
                      maxImages={1}
                      variant="single"
                      onUploadComplete={(urls) => update("hero_image_url", urls[0] || null)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-5">
                <h2 className="text-base font-semibold text-stone-900">Theme</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.primary_color || "#8B7355"}
                        onChange={(e) => update("primary_color", e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-stone-200"
                      />
                      <input
                        type="text"
                        value={config.primary_color || "#8B7355"}
                        onChange={(e) => update("primary_color", e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.secondary_color || "#1A1A1A"}
                        onChange={(e) => update("secondary_color", e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-stone-200"
                      />
                      <input
                        type="text"
                        value={config.secondary_color || "#1A1A1A"}
                        onChange={(e) => update("secondary_color", e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Font
                    </label>
                    <select
                      value={config.font || "Inter"}
                      onChange={(e) => update("font", e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355]"
                    >
                      {FONTS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <div
                    className="flex-1 h-10 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: config.primary_color || "#8B7355" }}
                  >
                    Primary
                  </div>
                  <div
                    className="flex-1 h-10 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: config.secondary_color || "#1A1A1A" }}
                  >
                    Secondary
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Content ── */}
          {activeTab === "content" && (
            <div className="space-y-6">
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">About</h2>
                <textarea
                  value={config.about_text || ""}
                  onChange={(e) => update("about_text", e.target.value)}
                  rows={5}
                  placeholder="Tell your story — your history, craftsmanship, what makes you unique…"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355] resize-none"
                />
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">Contact Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={config.contact_email || ""}
                      onChange={(e) => update("contact_email", e.target.value)}
                      placeholder="hello@yourshop.com"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={config.contact_phone || ""}
                      onChange={(e) => update("contact_phone", e.target.value)}
                      placeholder="+61 2 9000 0000"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                    Address
                  </label>
                  <input
                    type="text"
                    value={config.contact_address || ""}
                    onChange={(e) => update("contact_address", e.target.value)}
                    placeholder="123 Jewellery Lane, Sydney NSW 2000"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                  />
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">Social Media</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Instagram
                    </label>
                    <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#8B7355]/30">
                      <span className="px-3 text-sm text-stone-400 bg-stone-50 border-r border-stone-200 py-2">
                        @
                      </span>
                      <input
                        type="text"
                        value={config.social_instagram || ""}
                        onChange={(e) => update("social_instagram", e.target.value)}
                        placeholder="yourbusiness"
                        className="flex-1 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Facebook
                    </label>
                    <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#8B7355]/30">
                      <span className="px-3 text-sm text-stone-400 bg-stone-50 border-r border-stone-200 py-2 text-xs">
                        fb.com/
                      </span>
                      <input
                        type="text"
                        value={config.social_facebook || ""}
                        onChange={(e) => update("social_facebook", e.target.value)}
                        placeholder="yourbusiness"
                        className="flex-1 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">SEO</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Meta Title
                    </label>
                    <input
                      type="text"
                      value={config.meta_title || ""}
                      onChange={(e) => update("meta_title", e.target.value)}
                      placeholder="Goldsmith Jewellers — Handcrafted Fine Jewellery Sydney"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                      Meta Description
                    </label>
                    <textarea
                      value={config.meta_description || ""}
                      onChange={(e) => update("meta_description", e.target.value)}
                      rows={3}
                      placeholder="Handcrafted fine jewellery in Sydney. Rings, pendants, bangles and bespoke commissions."
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 resize-none"
                    />
                    <p className="text-xs text-stone-400 mt-1">
                      {(config.meta_description || "").length}/160 characters
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: AI ── */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-[#8B7355]/10 to-stone-50 border border-[#8B7355]/20 rounded-xl p-5">
                <h2 className="text-base font-semibold text-stone-900 mb-1">✦ AI Website Assistant</h2>
                <p className="text-sm text-stone-500">
                  Let AI improve your website content. Changes are applied to the editor — review them and save when happy.
                </p>
              </div>

              {/* Applied success */}
              {aiApplied && !aiResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Applied! Review the changes in the Content or Branding tab, then save.
                </div>
              )}

              {/* Tagline suggestions */}
              {aiResult?.suggestions && (
                <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold text-stone-900">Tagline Suggestions — pick one:</h3>
                  <div className="space-y-2">
                    {aiResult.suggestions.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 border border-stone-200 rounded-lg hover:border-[#8B7355] transition-colors">
                        <p className="text-sm text-stone-700 italic">&quot;{s}&quot;</p>
                        <button
                          onClick={() => applyTaglineSuggestion(s)}
                          className="flex-shrink-0 px-3 py-1.5 bg-[#8B7355] text-white text-xs font-medium rounded-lg hover:bg-[#7a6349]"
                        >
                          Use This
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setAiResult(null)} className="text-xs text-stone-400 hover:text-stone-600">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Colour rationale */}
              {aiResult?.rationale && (
                <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">AI Rationale</p>
                  <p className="text-sm text-stone-700">{aiResult.rationale}</p>
                  <button onClick={() => setAiResult(null)} className="text-xs text-stone-400 hover:text-stone-600 mt-2">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    action: "suggest_tagline",
                    icon: "✍️",
                    label: "Generate Taglines",
                    desc: "Get 3 tagline options tailored to your brand",
                    requires: "business_name",
                  },
                  {
                    action: "write_about",
                    icon: "📖",
                    label: "Write About Text",
                    desc: "AI writes a compelling story for your About section",
                    requires: "business_name",
                  },
                  {
                    action: "generate_seo",
                    icon: "🔍",
                    label: "Generate SEO Tags",
                    desc: "Create optimized meta title & description for Google",
                    requires: "business_name",
                  },
                  {
                    action: "suggest_colors",
                    icon: "🎨",
                    label: "Suggest Brand Colours",
                    desc: "AI recommends a colour palette for your jewellery brand",
                    requires: null,
                  },
                  {
                    action: "improve_content",
                    icon: "✨",
                    label: "Improve All Content",
                    desc: "Review and enhance your tagline and about text at once",
                    requires: "about_text",
                  },
                ].map((item) => {
                  const missingData = item.requires && !config[item.requires as keyof WebsiteConfig];
                  const isLoading = aiLoading && aiAction === item.action;
                  return (
                    <button
                      key={item.action}
                      onClick={() => handleAIAction(item.action)}
                      disabled={aiLoading || !!missingData}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        isLoading
                          ? "border-[#8B7355] bg-[#8B7355]/5"
                          : "border-stone-200 hover:border-[#8B7355]/50 bg-white"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{isLoading ? "⏳" : item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-stone-900 text-sm">{item.label}</p>
                          <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{item.desc}</p>
                          {missingData && (
                            <p className="text-xs text-amber-600 mt-1">
                              ⚠ Set your {item.requires?.replace("_", " ")} in the {item.requires === "about_text" ? "Content" : "Branding"} tab first
                            </p>
                          )}
                          {isLoading && (
                            <p className="text-xs text-[#8B7355] mt-1 animate-pulse">AI is thinking…</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                <p className="text-xs text-stone-500">
                  💡 <strong>Tip:</strong> After applying AI suggestions, go to the Content or Branding tab to review the changes before saving.
                </p>
              </div>
            </div>
          )}

          {/* ── Tab: Domain ── */}
          {activeTab === "domain" && (
            <div className="space-y-6">
              {/* Nexpura URL chip */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">Your Nexpura URL</h2>
                {config.subdomain ? (
                  <a
                    href={`https://${config.subdomain}.nexpura.com`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-800 rounded-lg text-sm font-mono hover:bg-stone-200 transition-colors"
                  >
                    {config.subdomain}.nexpura.com
                    <ExternalLink size={13} className="text-stone-500" />
                  </a>
                ) : (
                  <p className="text-sm text-stone-500">
                    Set a subdomain in the Setup tab first.
                  </p>
                )}
              </div>

              {/* Custom domain */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <h2 className="text-base font-semibold text-stone-900">
                  Connect Your Own Domain{" "}
                  <span className="text-xs font-normal text-stone-400 ml-1">(optional)</span>
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customDomainInput}
                    onChange={(e) => setCustomDomainInput(e.target.value)}
                    placeholder="yourdomain.com.au"
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355]"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>

                {customDomainInput && (
                  <div className="space-y-4 mt-2">
                    <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                      <p className="text-sm font-medium text-stone-700 mb-3">
                        Point your domain to Nexpura by adding this CNAME record:
                      </p>
                      <table className="w-full text-sm border-collapse">
                        <tbody>
                          {[
                            ["Type", "CNAME"],
                            ["Name", "@ (or www)"],
                            ["Value", "nexpura-delta.vercel.app"],
                            ["TTL", "3600"],
                          ].map(([label, value]) => (
                            <tr key={label} className="border-b border-stone-200 last:border-0">
                              <td className="py-2 pr-4 font-medium text-stone-600 w-28">{label}</td>
                              <td className="py-2 font-mono text-stone-800">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-stone-500">
                      Changes can take up to 24–48 hours to propagate.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-stone-500 self-center">Common registrars:</span>
                      {[
                        {
                          label: "GoDaddy guide ↗",
                          href: "https://au.godaddy.com/help/add-a-cname-record-19236",
                        },
                        {
                          label: "Namecheap guide ↗",
                          href: "https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/",
                        },
                        {
                          label: "Cloudflare guide ↗",
                          href: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
                        },
                      ].map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#8B7355] hover:underline"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Preview ── */}
          {activeTab === "preview" && (
            <div className="space-y-4">
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-stone-900">Live Preview</h2>
                  <div className="flex items-center gap-3">
                    {config.subdomain && (
                      <a
                        href={`/${config.subdomain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        Visit Website
                      </a>
                    )}
                    <button
                      onClick={handlePublishToggle}
                      disabled={isPending}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        config.published
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-[#8B7355] text-white hover:bg-[#7a6349]"
                      } disabled:opacity-50`}
                    >
                      {config.published ? "Unpublish" : "Publish Now"}
                    </button>
                  </div>
                </div>

                {config.subdomain ? (
                  <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-200 border-b border-stone-300">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 mx-3 bg-white rounded px-3 py-1 text-xs text-stone-500 font-mono">
                        {config.subdomain}.nexpura.com
                      </div>
                    </div>
                    <iframe
                      src={previewUrl || ""}
                      className="w-full h-[600px] border-0"
                      title="Website preview"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                    <div className="text-4xl mb-3">🌐</div>
                    <p className="text-stone-500 text-sm">
                      Set a subdomain in Setup to preview your site
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CONNECT MODE ── */}
      {websiteType === "connect" && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-6">
            <h2 className="text-base font-semibold text-stone-900">Connect Your Existing Website</h2>

            {/* URL input */}
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                Your Website URL
              </label>
              <input
                type="url"
                value={externalUrlInput}
                onChange={(e) => setExternalUrlInput(e.target.value)}
                placeholder="https://myjewelleryshop.com.au"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355]"
              />
            </div>

            {/* Platform selector */}
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                What platform is it built on?
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatform(p.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selectedPlatform === p.id
                        ? "border-[#8B7355] bg-[#8B7355]/10 text-[#8B7355]"
                        : "border-stone-200 text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Embed instructions */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Embed Your Live Inventory</h2>
            <p className="text-sm text-stone-500">
              Add a live catalogue widget to your existing site so customers can browse your
              Nexpura inventory without leaving your website.
            </p>

            {selectedPlatform && PLATFORM_INSTRUCTIONS[selectedPlatform] && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {PLATFORMS.find((p) => p.id === selectedPlatform)?.label} Instructions
                </p>
                <ol className="space-y-1.5">
                  {PLATFORM_INSTRUCTIONS[selectedPlatform].map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-stone-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#8B7355]/10 text-[#8B7355] text-xs font-semibold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {!selectedPlatform && (
              <p className="text-sm text-stone-400 italic">
                Select your platform above to see step-by-step instructions.
              </p>
            )}

            {/* Embed code block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Embed Code
                </p>
                <CopyButton text={embedCode} />
              </div>
              <pre className="bg-stone-900 text-stone-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {embedCode}
              </pre>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Widget Library</h2>
            <p className="text-sm text-stone-500">Add any of these widgets to your existing website.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { id: "passport", icon: "🛡️", label: "Passport Verification", desc: "Let customers verify their jewellery authenticity", path: "passport" },
                { id: "enquiry", icon: "💬", label: "Enquiry Widget", desc: "Floating enquiry form for quick contact", path: "enquiry" },
                { id: "appointment", icon: "📅", label: "Appointment Booking", desc: "Let customers book appointments online", path: "appointment" },
              ].map((widget) => {
                const widgetEmbed = `<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/embed/${tenantId}/${widget.path}" width="100%" height="500" frameborder="0" style="border-radius:12px;"></iframe>`;
    return (
      <div key={widget.id} className="border border-stone-200 rounded-xl p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-medium text-stone-900 text-sm">{widget.icon} {widget.label}</p>
            <p className="text-xs text-stone-500 mt-0.5">{widget.desc}</p>
          </div>
        </div>
        <pre className="bg-stone-900 text-stone-300 text-xs rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap text-[10px] mb-2">{widgetEmbed}</pre>
        <button
          onClick={async () => { await navigator.clipboard.writeText(widgetEmbed); }}
          className="w-full py-1.5 border border-stone-200 text-stone-600 text-xs rounded-lg hover:bg-stone-50 transition-colors"
        >
          Copy Embed Code
        </button>
      </div>
    );
  })}
            </div>
          </div>

          {/* Direct catalogue link */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-stone-900">
              Or link to your Nexpura catalogue
            </h2>
            <p className="text-sm text-stone-500">
              If you'd rather keep your inventory on Nexpura and link to it, share this URL with
              customers:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-stone-100 rounded-lg text-sm font-mono text-stone-700 break-all">
                {catalogueLink}
              </code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(catalogueLink);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors flex-shrink-0"
              >
                {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleConnectSave}
              disabled={saving}
              className="px-6 py-2.5 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {connectSaved && (
              <p className="text-sm text-green-700 font-medium">
                ✓ Your website is connected. Customers can use the embed widget or visit your
                catalogue directly.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── DOMAIN GUIDE MODE ── */}
      {websiteType === "domain-guide" && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Get Your Own Domain</h2>
            <p className="text-sm text-stone-600">
              A domain (like <span className="font-mono">myjewellery.com.au</span>) is your unique
              address on the internet. Once you have one, you can:
            </p>
            <ul className="space-y-1">
              <li className="text-sm text-stone-600 flex gap-2">
                <span className="text-[#8B7355]">•</span> Point it to your Nexpura hosted site
              </li>
              <li className="text-sm text-stone-600 flex gap-2">
                <span className="text-[#8B7355]">•</span> Or connect it to your existing website
              </li>
            </ul>
          </div>

          {/* Step 1 */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#8B7355] text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                1
              </span>
              <h2 className="text-base font-semibold text-stone-900">
                Choose and buy a domain
              </h2>
            </div>
            <p className="text-sm text-stone-500">
              We recommend <strong>.com.au</strong> for Australian jewellers. Popular registrars:
            </p>
            <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden">
              {[
                {
                  emoji: "🟡",
                  name: "Namecheap",
                  price: "Starting from ~$15/yr",
                  desc: "Great for beginners. Easy DNS management.",
                  href: "https://www.namecheap.com",
                },
                {
                  emoji: "🟢",
                  name: "GoDaddy",
                  price: "Starting from ~$20/yr",
                  desc: "Largest registrar. 24/7 support.",
                  href: "https://au.godaddy.com",
                },
                {
                  emoji: "🔵",
                  name: "Cloudflare",
                  price: "At cost (cheapest)",
                  desc: "Technical but best value. Zero markup on domains.",
                  href: "https://www.cloudflare.com/products/registrar/",
                },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between p-4">
                  <div className="flex gap-3 items-start">
                    <span className="text-xl">{r.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900 text-sm">{r.name}</span>
                        <span className="text-xs text-stone-400">{r.price}</span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 ml-4 px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors"
                  >
                    Visit {r.name} ↗
                  </a>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Tips for choosing
              </p>
              {[
                "For Australia: .com.au (most trusted), .au (newer), .com (global)",
                "Keep it short, memorable, easy to spell",
                "Use your business name if available",
              ].map((tip) => (
                <p key={tip} className="text-sm text-stone-600 flex gap-2">
                  <span className="text-[#8B7355]">•</span> {tip}
                </p>
              ))}
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-stone-300 text-stone-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                2
              </span>
              <h2 className="text-base font-semibold text-stone-900">Come back and connect</h2>
            </div>
            <p className="text-sm text-stone-600">
              Once you have your domain, come back here and:
            </p>
            <ol className="space-y-1.5">
              {[
                'Switch to "Nexpura Hosted" to build your site',
                "Go to the Domain tab and enter your domain",
                "Follow the CNAME instructions to point it here",
              ].map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-stone-600">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-xs font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-sm text-stone-500 italic">
              OR switch to "Connect My Site" if you're building on Squarespace, Wix, etc.
            </p>
          </div>

          {/* Switch buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => handleTypeChange("connect")}
              className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Already have a domain? Switch to Connect My Site →
            </button>
            <button
              onClick={() => handleTypeChange("hosted")}
              className="px-4 py-2 bg-[#8B7355] text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors"
            >
              Switch to Nexpura Hosted →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
