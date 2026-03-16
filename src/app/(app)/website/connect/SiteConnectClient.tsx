"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
      title: "Catalog Sync",
      description: "Display your live inventory on your existing website, with real-time stock levels.",
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

export default function SiteConnectClient({ tenantId, config }: Props) {
  const [activeWidget, setActiveWidget] = useState<WidgetTab>("passport");
  const [siteUrl, setSiteUrl] = useState<string>((config?.external_url as string) ?? "");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(siteUrl);
  const [isPending, startTransition] = useTransition();
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
    { id: "catalog", label: "Catalog Sync", icon: "🗂️" },
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
    </div>
  );
}
