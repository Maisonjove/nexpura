"use client";

import type { WebsiteConfig } from "../types";

interface ContentTabProps {
  config: WebsiteConfig;
  update: <K extends keyof WebsiteConfig>(key: K, value: WebsiteConfig[K]) => void;
}

export default function ContentTab({ config, update }: ContentTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-stone-900">About</h2>
        <textarea
          value={config.about_text || ""}
          onChange={(e) => update("about_text", e.target.value)}
          rows={5}
          placeholder="Tell your story — your history, craftsmanship, what makes you unique…"
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none"
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
            <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[amber-700]/30">
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
            <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[amber-700]/30">
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 resize-none"
            />
            <p className="text-xs text-stone-400 mt-1">
              {(config.meta_description || "").length}/160 characters
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
