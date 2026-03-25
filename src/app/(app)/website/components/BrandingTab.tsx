"use client";

import ImageUpload from "@/components/ui/ImageUpload";
import type { WebsiteConfig } from "../types";
import { FONTS } from "./constants";

interface BrandingTabProps {
  config: WebsiteConfig;
  update: <K extends keyof WebsiteConfig>(key: K, value: WebsiteConfig[K]) => void;
  tenantId: string;
}

export default function BrandingTab({ config, update, tenantId }: BrandingTabProps) {
  return (
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
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
              onUploadComplete={(urls) => update("logo_url", urls[0] || undefined)}
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
              onUploadComplete={(urls) => update("hero_image_url", urls[0] || undefined)}
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
                value={config.primary_color || "amber-700"}
                onChange={(e) => update("primary_color", e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-stone-200"
              />
              <input
                type="text"
                value={config.primary_color || "amber-700"}
                onChange={(e) => update("primary_color", e.target.value)}
                className="flex-1 px-2 py-1.5 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
                className="flex-1 px-2 py-1.5 border border-stone-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
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
            style={{ backgroundColor: config.primary_color || "amber-700" }}
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
  );
}
