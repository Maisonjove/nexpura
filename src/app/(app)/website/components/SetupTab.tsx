"use client";

import type { WebsiteConfig } from "../types";

interface SetupTabProps {
  config: WebsiteConfig;
  update: <K extends keyof WebsiteConfig>(key: K, value: WebsiteConfig[K]) => void;
  subdomainInput: string;
  setSubdomainInput: (value: string) => void;
  subdomainStatus: { available?: boolean; reason?: string } | null;
  setSubdomainStatus: (status: { available?: boolean; reason?: string } | null) => void;
  onCheckSubdomain: () => void;
}

const MODES = [
  { id: "A", name: "Catalogue", desc: "Show your inventory publicly. No prices, enquiry form only.", icon: "🗂️" },
  { id: "B", name: "Catalogue + Prices", desc: "Show inventory with prices. Customers can enquire.", icon: "💎" },
  { id: "C", name: "Full E-commerce", desc: "Accept online payments via Stripe.", icon: "🛒" },
];

export default function SetupTab({
  config,
  update,
  subdomainInput,
  setSubdomainInput,
  subdomainStatus,
  setSubdomainStatus,
  onCheckSubdomain,
}: SetupTabProps) {
  return (
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
                  ? "border-amber-600 bg-amber-700/5"
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
          <div className="flex-1 flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[amber-700]/30 focus-within:border-amber-600">
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
            onClick={onCheckSubdomain}
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
              className="text-amber-700 hover:underline"
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
                className="w-4 h-4 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
              />
              <span className="text-sm text-stone-700">Show prices on catalogue</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.allow_enquiry ?? true}
                onChange={(e) => update("allow_enquiry", e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
              />
              <span className="text-sm text-stone-700">Allow customer enquiries</span>
            </label>
            {config.mode === "C" && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.stripe_enabled ?? false}
                  onChange={(e) => update("stripe_enabled", e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
                />
                <span className="text-sm text-stone-700">Enable Stripe payments</span>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
