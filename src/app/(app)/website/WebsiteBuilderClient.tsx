"use client";

import { useState, useTransition } from "react";
import ImageUpload from "@/components/ui/ImageUpload";
import {
  saveWebsiteConfig,
  publishWebsite,
  checkSubdomainAvailable,
  type WebsiteConfigData,
} from "./actions";

type Tab = "setup" | "branding" | "content" | "preview";

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

export default function WebsiteBuilderClient({ initial, tenantId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("setup");
  const [config, setConfig] = useState<WebsiteConfig>(initial || {
    mode: "A",
    published: false,
    primary_color: "#8B7355",
    secondary_color: "#1A1A1A",
    font: "Inter",
    show_prices: true,
    allow_enquiry: true,
    stripe_enabled: false,
  });
  const [subdomainInput, setSubdomainInput] = useState(initial?.subdomain || "");
  const [subdomainStatus, setSubdomainStatus] = useState<{ available?: boolean; reason?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const previewUrl = config.subdomain
    ? `${window.location.origin}/shop/${config.subdomain}`
    : null;

  function update(field: keyof WebsiteConfig, value: unknown) {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
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
      await saveWebsiteConfig(config as WebsiteConfigData);
      setSaved(true);
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

  const TABS: { id: Tab; label: string }[] = [
    { id: "setup", label: "Setup" },
    { id: "branding", label: "Branding" },
    { id: "content", label: "Content" },
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
        <div className="flex items-center gap-3">
          {/* Published status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            config.published
              ? "bg-green-100 text-green-800"
              : "bg-stone-100 text-stone-600"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.published ? "bg-green-500" : "bg-stone-400"}`} />
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
      </div>

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
                  <div className="font-medium text-stone-900 text-sm">Mode {m.id} — {m.name}</div>
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
                    setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
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
              <p className={`text-sm ${subdomainStatus.available ? "text-green-600" : "text-red-600"}`}>
                {subdomainStatus.available
                  ? `✓ "${subdomainInput}" is available!`
                  : `✗ ${subdomainStatus.reason}`}
              </p>
            )}
            {config.subdomain && (
              <p className="text-sm text-stone-500">
                Current:{" "}
                <a
                  href={`/shop/${config.subdomain}`}
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
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Logo</p>
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
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Hero Image</p>
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
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color preview */}
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
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={config.contact_email || ""}
                  onChange={(e) => update("contact_email", e.target.value)}
                  placeholder="hello@yourshop.com"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Phone</label>
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
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Address</label>
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
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Instagram</label>
                <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#8B7355]/30">
                  <span className="px-3 text-sm text-stone-400 bg-stone-50 border-r border-stone-200 py-2">@</span>
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
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Facebook</label>
                <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#8B7355]/30">
                  <span className="px-3 text-sm text-stone-400 bg-stone-50 border-r border-stone-200 py-2 text-xs">fb.com/</span>
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
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Meta Title</label>
                <input
                  type="text"
                  value={config.meta_title || ""}
                  onChange={(e) => update("meta_title", e.target.value)}
                  placeholder="Goldsmith Jewellers — Handcrafted Fine Jewellery Sydney"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Meta Description</label>
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

      {/* ── Tab: Preview ── */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-stone-900">Live Preview</h2>
              <div className="flex items-center gap-3">
                {config.subdomain && (
                  <a
                    href={`/shop/${config.subdomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
                {/* Browser chrome mockup */}
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
                  src={`/shop/${config.subdomain}`}
                  className="w-full h-[600px] border-0"
                  title="Website preview"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                <div className="text-4xl mb-3">🌐</div>
                <p className="text-stone-500 text-sm">Set a subdomain in Setup to preview your site</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
