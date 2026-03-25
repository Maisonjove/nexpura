"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { WebsiteConfig } from "../types";
import { PLATFORMS, PLATFORM_INSTRUCTIONS } from "./constants";

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

interface ConnectModeProps {
  config: WebsiteConfig;
  tenantId: string;
  externalUrlInput: string;
  setExternalUrlInput: (value: string) => void;
  selectedPlatform: string;
  setSelectedPlatform: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  connectSaved: boolean;
}

export default function ConnectMode({
  config,
  tenantId,
  externalUrlInput,
  setExternalUrlInput,
  selectedPlatform,
  setSelectedPlatform,
  onSave,
  saving,
  connectSaved,
}: ConnectModeProps) {
  const [copiedLink, setCopiedLink] = useState(false);

  const embedCode = `<!-- Nexpura Live Catalogue Widget -->
<div id="nexpura-widget"></div>
<script src="https://nexpura.com/widget.js"
  data-tenant="${tenantId}"
  data-theme="light"
  data-mode="${config.mode || "catalogue"}"
  async>
</script>`;

  const catalogueLink = `https://nexpura.com/${config.subdomain || tenantId}/catalogue`;

  return (
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
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
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
                    ? "border-amber-600 bg-amber-700/10 text-amber-700"
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
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-700/10 text-amber-700 text-xs font-semibold flex items-center justify-center mt-0.5">
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
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors disabled:opacity-50"
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
  );
}
