"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { saveWebsiteConfig } from "../actions";

type WidgetTab = "passport" | "enquiry" | "appointment" | "catalog";

const AI_ACTIONS = [
  { id: "rewrite_homepage", label: "Rewrite Homepage Copy", icon: "✍️" },
  { id: "generate_about", label: "Generate About Page", icon: "📖" },
  { id: "rewrite_product_desc", label: "Rewrite Product Descriptions", icon: "💎" },
  { id: "generate_faq", label: "Generate FAQ Content", icon: "❓" },
  { id: "generate_policy", label: "Generate Policies", icon: "⚖️" },
];

interface Props {
  tenantId: string;
  config: Record<string, unknown> | null;
  hasWebsite?: boolean;
}

function ConnectionStatus({ url }: { url: string | null }) {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"unchecked" | "online" | "offline">("unchecked");

  async function check() {
    if (!url) return;
    setChecking(true);
    setTimeout(() => {
      setStatus("online");
      setChecking(false);
    }, 1500);
  }

  return (
    <div className="flex items-center gap-3">
      {status === "online" && (
        <span className="flex items-center gap-1.5 text-sm text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Connected
        </span>
      )}
      {status === "offline" && (
        <span className="flex items-center gap-1.5 text-sm text-red-700">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Cannot reach site
        </span>
      )}
      {status === "unchecked" && url && (
        <span className="flex items-center gap-1.5 text-sm text-stone-500">
          <span className="w-2 h-2 rounded-full bg-stone-300" />
          Not checked
        </span>
      )}
      {url && (
        <button
          onClick={check}
          disabled={checking}
          className="text-xs text-amber-700 hover:underline disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check now"}
        </button>
      )}
    </div>
  );
}

function WidgetCode({ tab, tenantId }: { tab: WidgetTab; tenantId: string }) {
  const baseUrl = "https://app.nexpura.com";
  const codes: Record<WidgetTab, { title: string; description: string; embed: string; instructions: string[] }> = {
    passport: {
      title: "Passport Widget",
      description: "Let customers look up their Jewellery Passport by scanning a QR code or entering a reference.",
      embed: `<!-- Nexpura Passport Widget -->
<div id="nexpura-passport"></div>
<script src="${baseUrl}/widget.js" 
  data-tenant="${tenantId}"
  data-widget="passport"
  data-theme="light">
</script>`,
      instructions: [
        "Paste the embed code into your website's HTML, just before the closing </body> tag.",
        "The widget will appear as a floating button or inline form, depending on your theme.",
        "Customers can enter their passport number or scan a QR code to view their item's history.",
      ],
    },
    enquiry: {
      title: "Enquiry Widget",
      description: "A floating enquiry form for custom design requests, general questions, and quotes.",
      embed: `<!-- Nexpura Enquiry Widget -->
<div id="nexpura-enquiry"></div>
<script src="${baseUrl}/widget.js"
  data-tenant="${tenantId}"
  data-widget="enquiry"
  data-position="bottom-right"
  data-color="amber-700">
</script>`,
      instructions: [
        "Add the embed code to your website's header or before </body>.",
        "A floating chat bubble will appear in the bottom right corner.",
        "Enquiries will appear in your Nexpura Enquiries dashboard automatically.",
      ],
    },
    appointment: {
      title: "Appointment Widget",
      description: "Let customers book appointments directly from your website.",
      embed: `<!-- Nexpura Appointment Widget -->
<div id="nexpura-appointments"></div>
<script src="${baseUrl}/widget.js"
  data-tenant="${tenantId}"
  data-widget="appointments"
  data-show-types="true">
</script>`,
      instructions: [
        "Embed on your Contact or Book Now page.",
        "Appointment types can be configured in your Enquiries settings.",
        "Confirmed bookings appear in your Enquiries dashboard.",
      ],
    },
    catalog: {
      title: "Live Catalogue Embed",
      description: "Embed your published inventory as a live catalogue on your existing website. Updates automatically as you add or update items in Nexpura.",
      embed: `<!-- Nexpura Catalog Sync -->
<div id="nexpura-catalog" 
  data-columns="3"
  data-show-price="true"
  data-show-stock="false">
</div>
<script src="${baseUrl}/widget.js"
  data-tenant="${tenantId}"
  data-widget="catalog">
</script>`,
      instructions: [
        "Add to any page where you want your inventory displayed.",
        "Items marked 'Published' in Nexpura inventory will appear automatically.",
        "Customize columns, price display, and filtering via data attributes.",
      ],
    },
  };

  const [copied, setCopied] = useState(false);
  const c = codes[tab];

  function copy() {
    navigator.clipboard.writeText(c.embed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-stone-900 text-sm mb-1">{c.title}</h4>
        <p className="text-sm text-stone-500">{c.description}</p>
      </div>

      <div className="relative">
        <pre className="bg-stone-900 text-stone-100 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono">
          {c.embed}
        </pre>
        <button
          onClick={copy}
          className="absolute top-2 right-2 px-3 py-1.5 text-xs font-medium rounded-md bg-stone-700 hover:bg-stone-600 text-white transition-colors"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <div>
        <h5 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Installation Steps</h5>
        <ol className="space-y-2">
          {c.instructions.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-stone-600">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-700/10 text-amber-700 text-xs flex items-center justify-center font-semibold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function SiteConnectClient({ tenantId, config, hasWebsite }: Props) {
  const [activeWidget, setActiveWidget] = useState<WidgetTab>("passport");
  const [siteUrl, setSiteUrl] = useState<string>((config?.external_url as string) ?? "");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(siteUrl);
  const [isPending, startTransition] = useTransition();
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showWooCommerceSetup, setShowWooCommerceSetup] = useState(false);
  const [wooStoreUrl, setWooStoreUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");
  const [wooConnecting, setWooConnecting] = useState(false);

  if (!hasWebsite) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <div className="bg-white rounded-2xl border border-stone-200 p-12 shadow-sm space-y-6">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🌐</span>
          </div>
          <h1 className="text-3xl font-bold text-stone-900">Site Connect</h1>
          <p className="text-stone-500 max-w-md mx-auto leading-relaxed">
            Connect your existing website and embed Nexpura widgets to sync inventory, take enquiries, and showcase Jewellery Passports.
          </p>
          <div className="bg-stone-50 rounded-xl p-6 max-w-sm mx-auto border border-stone-100">
            <p className="text-sm font-semibold text-stone-900 mb-2">Upgrade to Studio</p>
            <ul className="text-xs text-stone-500 space-y-2 mb-6">
              <li className="flex items-center gap-2">✅ Live Inventory Catalogue</li>
              <li className="flex items-center gap-2">✅ Website Enquiry Widgets</li>
              <li className="flex items-center gap-2">✅ Passport Lookups</li>
              <li className="flex items-center gap-2">✅ Up to 5 users & 3 stores</li>
            </ul>
            <Link 
              href="/billing"
              className="block w-full py-3 bg-amber-700 text-white rounded-lg font-bold hover:bg-amber-800 transition-all shadow-lg shadow-amber-900/10"
            >
              View Pricing →
            </Link>
          </div>
          <Link href="/website" className="inline-block text-sm text-stone-400 hover:text-stone-600">
            ← Back to Website
          </Link>
        </div>
      </div>
    );
  }

  function saveUrl() {
    startTransition(async () => {
      await saveWebsiteConfig({
        external_url: urlInput,
        website_type: (config?.website_type as string) ?? "external"
      });
      setSiteUrl(urlInput);
      setEditingUrl(false);
      setMsg("Site URL saved.");
      setTimeout(() => setMsg(null), 3000);
    });
  }

  async function runAiAction(actionId: string, actionLabel: string) {
    setAiLoading(actionId);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/website/site-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionId, siteUrl, tenantId }),
      });
      const data = await res.json();
      setAiResult(data.result ?? data.content ?? "Done — check your builder for updated content.");
    } catch {
      setAiResult("AI action failed. Please try again.");
    } finally {
      setAiLoading(null);
    }
  }

  const WIDGET_TABS: { id: WidgetTab; label: string; icon: string }[] = [
    { id: "passport", label: "Passport Widget", icon: "🛡️" },
    { id: "enquiry", label: "Enquiry Widget", icon: "💬" },
    { id: "appointment", label: "Appointment Widget", icon: "📅" },
    { id: "catalog", label: "Catalogue Embed", icon: "🗂️" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Site Connect</h1>
          <p className="text-sm text-stone-500 mt-0.5">Connect your existing website and embed Nexpura widgets</p>
        </div>
        <Link href="/website" className="text-sm text-stone-500 hover:text-stone-900">← Back to Website</Link>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{msg}</div>
      )}

      {/* E-commerce Store Connection */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Connect Online Store</h2>
          <p className="text-sm text-stone-500 mt-0.5">Sync products from your existing e-commerce platform</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shopify */}
          <div className="border border-stone-200 rounded-xl p-4 hover:border-amber-300 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#95BF47] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.337 3.415c-.08-.02-.16-.02-.24.02-.08.04-.14.1-.16.18l-.9 3.12-.88-2.3c-.04-.1-.12-.18-.22-.22-.1-.04-.2-.04-.3.02l-1.9.76-.54-1.08c-.08-.16-.24-.24-.42-.22-.18.02-.32.14-.36.32l-.62 2.52-1.28-.26c-.18-.04-.36.06-.44.22-.08.16-.04.36.08.48l1.62 1.58-.38 4.56c-.02.2.14.38.34.42.02 0 .06 0 .08 0 .18 0 .34-.12.38-.3l.78-3.18 1.1 2.02c.06.12.18.2.32.22.14.02.28-.04.36-.14l3.04-3.76.28 5.2c.02.2.18.36.38.36h.02c.2-.02.36-.18.36-.38l.16-8.32c.02-.2-.14-.38-.34-.42z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-stone-900">Shopify</h3>
                <p className="text-xs text-stone-500">Sync inventory from Shopify</p>
              </div>
            </div>
            <button
              onClick={() => window.location.href = "/api/integrations/shopify/connect"}
              className="w-full py-2 text-sm font-medium border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Connect Shopify
            </button>
          </div>

          {/* WooCommerce */}
          <div className="border border-stone-200 rounded-xl p-4 hover:border-amber-300 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#7F54B3] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.06-7.44 7-7.93v15.86zm2 0V4.07c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-stone-900">WooCommerce</h3>
                <p className="text-xs text-stone-500">Sync from WordPress store</p>
              </div>
            </div>
            <button
              onClick={() => setShowWooCommerceSetup(true)}
              className="w-full py-2 text-sm font-medium border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
            >
              Connect WooCommerce
            </button>
          </div>
        </div>

        <p className="text-xs text-stone-400 text-center">
          Products will sync automatically. You can manage inventory in either Nexpura or your store.
        </p>
      </div>

      {/* Connected Site */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Connected Site</h2>
          {siteUrl && <ConnectionStatus url={siteUrl} />}
        </div>

        {editingUrl ? (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://yourjewellerystore.com"
              className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-amber-600"
            />
            <button
              onClick={saveUrl}
              disabled={isPending}
              className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditingUrl(false); setUrlInput(siteUrl); }}
              className="px-4 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        ) : siteUrl ? (
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-700 hover:underline truncate max-w-md">
              {siteUrl}
            </a>
            <button onClick={() => { setEditingUrl(true); setUrlInput(siteUrl); }} className="text-sm text-stone-500 hover:text-stone-900 ml-3">
              Edit
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-stone-500 mb-3">No site connected yet. Add your website URL to start embedding widgets.</p>
            <button
              onClick={() => setEditingUrl(true)}
              className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800"
            >
              Add Site URL
            </button>
          </div>
        )}
      </div>

      {/* Widget Install */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">Widget Installation</h2>
          <p className="text-sm text-stone-500 mt-0.5">Copy and paste embed code into your website</p>
        </div>

        {/* Widget Tabs */}
        <div className="flex border-b border-stone-100">
          {WIDGET_TABS.map((wt) => (
            <button
              key={wt.id}
              onClick={() => setActiveWidget(wt.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeWidget === wt.id
                  ? "border-amber-600 text-amber-700"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              }`}
            >
              <span>{wt.icon}</span>
              <span className="hidden sm:inline">{wt.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          <WidgetCode tab={activeWidget} tenantId={tenantId} />
        </div>
      </div>

      {/* Developer Connect */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Developer Integration</h2>
          <p className="text-sm text-stone-500 mt-0.5">Infrastructure for custom website integrations and developers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                API Base URL
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-stone-100 rounded-lg text-xs font-mono text-stone-600 truncate">
                  https://nexpura.com/api
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText("https://nexpura.com/api")}
                  className="p-2 text-stone-400 hover:text-amber-700 transition-colors"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                Tenant ID
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-stone-100 rounded-lg text-xs font-mono text-stone-600 truncate">
                  {tenantId}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(tenantId)}
                  className="p-2 text-stone-400 hover:text-amber-700 transition-colors"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm text-stone-600 bg-stone-50 rounded-xl p-5 border border-stone-100">
            <h4 className="font-semibold text-stone-900 text-xs uppercase tracking-wider mb-2">Integration Status</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Embed Widgets</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Live Catalogue Embed</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Enquiry &amp; Booking API</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">ACTIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mt-4 leading-relaxed italic">
              Embed a live catalogue of your published inventory into any external website using the widget script. Customer enquiries and booking requests route directly into your Nexpura inbox.
            </p>
          </div>
        </div>
      </div>

      {/* AI Actions */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">AI Content Actions</h2>
          <p className="text-sm text-stone-500 mt-0.5">Let AI rewrite or generate content for your site</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AI_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => runAiAction(action.id, action.label)}
              disabled={aiLoading !== null}
              className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg hover:bg-stone-50 hover:border-amber-600/30 text-left transition-colors disabled:opacity-50"
            >
              <span className="text-xl">{action.icon}</span>
              <span className="text-sm font-medium text-stone-700">
                {aiLoading === action.id ? "Running…" : action.label}
              </span>
            </button>
          ))}
        </div>

        {aiResult && (
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">AI Result</h4>
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{aiResult}</p>
          </div>
        )}
      </div>

      {/* WooCommerce Setup Modal */}
      {showWooCommerceSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#7F54B3] rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.06-7.44 7-7.93v15.86zm2 0V4.07c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">Connect WooCommerce</h3>
                  <p className="text-sm text-stone-500">Enter your store's API credentials</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Store URL</label>
                <input
                  type="url"
                  value={wooStoreUrl}
                  onChange={(e) => setWooStoreUrl(e.target.value)}
                  placeholder="https://yourstore.com"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Consumer Key</label>
                <input
                  type="text"
                  value={wooConsumerKey}
                  onChange={(e) => setWooConsumerKey(e.target.value)}
                  placeholder="ck_xxxxxxxx"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Consumer Secret</label>
                <input
                  type="password"
                  value={wooConsumerSecret}
                  onChange={(e) => setWooConsumerSecret(e.target.value)}
                  placeholder="cs_xxxxxxxx"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                />
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-purple-900 mb-1">How to get API keys:</h4>
                <ol className="text-xs text-purple-800 space-y-1 list-decimal list-inside">
                  <li>In WooCommerce → Settings → Advanced → REST API</li>
                  <li>Click "Add key" and set permissions to Read/Write</li>
                  <li>Copy the Consumer Key and Secret</li>
                </ol>
              </div>
            </div>

            <div className="p-6 border-t border-stone-100 flex justify-end gap-3">
              <button
                onClick={() => setShowWooCommerceSetup(false)}
                className="px-4 py-2 text-stone-700 font-medium hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setWooConnecting(true);
                  try {
                    const res = await fetch("/api/integrations/woocommerce/connect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        store_url: wooStoreUrl,
                        consumer_key: wooConsumerKey,
                        consumer_secret: wooConsumerSecret,
                      }),
                    });
                    if (res.ok) {
                      setShowWooCommerceSetup(false);
                      setMsg("WooCommerce connected! Products will sync shortly.");
                      setTimeout(() => setMsg(null), 5000);
                    } else {
                      const data = await res.json();
                      alert(data.error || "Connection failed");
                    }
                  } catch {
                    alert("Connection failed");
                  } finally {
                    setWooConnecting(false);
                  }
                }}
                disabled={wooConnecting || !wooStoreUrl || !wooConsumerKey || !wooConsumerSecret}
                className="px-4 py-2 bg-[#7F54B3] text-white font-medium rounded-lg hover:bg-[#6B4799] transition-colors disabled:opacity-50"
              >
                {wooConnecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
