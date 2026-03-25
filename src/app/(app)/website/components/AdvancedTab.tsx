"use client";

import type { WebsiteConfig, BusinessHours } from "../types";
import BusinessHoursEditor from "./BusinessHoursEditor";

interface AdvancedTabProps {
  config: WebsiteConfig;
  update: <K extends keyof WebsiteConfig>(key: K, value: WebsiteConfig[K]) => void;
  announcementEnabled: boolean;
  setAnnouncementEnabled: (value: boolean) => void;
  announcementText: string;
  setAnnouncementText: (value: string) => void;
  enableAppointments: boolean;
  setEnableAppointments: (value: boolean) => void;
  enableRepairsEnquiry: boolean;
  setEnableRepairsEnquiry: (value: boolean) => void;
  enableWhatsapp: boolean;
  setEnableWhatsapp: (value: boolean) => void;
  whatsappNumber: string;
  setWhatsappNumber: (value: string) => void;
  gaId: string;
  setGaId: (value: string) => void;
  fbPixelId: string;
  setFbPixelId: (value: string) => void;
  catalogueShowSku: boolean;
  setCatalogueShowSku: (value: boolean) => void;
  catalogueShowWeight: boolean;
  setCatalogueShowWeight: (value: boolean) => void;
  catalogueShowMetal: boolean;
  setCatalogueShowMetal: (value: boolean) => void;
  catalogueShowStone: boolean;
  setCatalogueShowStone: (value: boolean) => void;
  catalogueColumns: number;
  setCatalogueColumns: (value: number) => void;
  businessHours: BusinessHours | null | undefined;
  setBusinessHours: (value: BusinessHours) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}

export default function AdvancedTab({
  update,
  announcementEnabled,
  setAnnouncementEnabled,
  announcementText,
  setAnnouncementText,
  enableAppointments,
  setEnableAppointments,
  enableRepairsEnquiry,
  setEnableRepairsEnquiry,
  enableWhatsapp,
  setEnableWhatsapp,
  whatsappNumber,
  setWhatsappNumber,
  gaId,
  setGaId,
  fbPixelId,
  setFbPixelId,
  catalogueShowSku,
  setCatalogueShowSku,
  catalogueShowWeight,
  setCatalogueShowWeight,
  catalogueShowMetal,
  setCatalogueShowMetal,
  catalogueShowStone,
  setCatalogueShowStone,
  catalogueColumns,
  setCatalogueColumns,
  businessHours,
  setBusinessHours,
  onSave,
  saving,
  saved,
}: AdvancedTabProps) {
  return (
    <div className="space-y-5">
      {/* Announcement Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-1">Announcement Bar</h2>
        <p className="text-sm text-stone-500 mb-4">Show a banner at the top of your site — promotions, sale notices, store hours.</p>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => { setAnnouncementEnabled(!announcementEnabled); update("announcement_bar_enabled", !announcementEnabled); }}
            className={`relative inline-flex w-10 h-5.5 rounded-full transition-colors ${announcementEnabled ? "bg-amber-700" : "bg-stone-200"}`}
            aria-label="Toggle announcement bar"
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${announcementEnabled ? "translate-x-5" : ""}`} />
          </button>
          <span className="text-sm text-stone-700">{announcementEnabled ? "Enabled" : "Disabled"}</span>
        </div>
        {announcementEnabled && (
          <input
            value={announcementText}
            onChange={(e) => { setAnnouncementText(e.target.value); update("announcement_bar", e.target.value); }}
            placeholder="e.g. 🎉 Free shipping on orders over $200 · Shop now →"
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
          />
        )}
      </div>

      {/* Catalogue Display Options */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-1">Catalogue Display</h2>
        <p className="text-sm text-stone-500 mb-4">Control what information appears on each product card.</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Show SKU", val: catalogueShowSku, set: setCatalogueShowSku, field: "catalogue_show_sku" },
            { label: "Show Weight", val: catalogueShowWeight, set: setCatalogueShowWeight, field: "catalogue_show_weight" },
            { label: "Show Metal", val: catalogueShowMetal, set: setCatalogueShowMetal, field: "catalogue_show_metal" },
            { label: "Show Stone", val: catalogueShowStone, set: setCatalogueShowStone, field: "catalogue_show_stone" },
          ].map(({ label, val, set, field }) => (
            <label key={field} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => { set(e.target.checked); update(field as keyof WebsiteConfig, e.target.checked); }}
                className="w-4 h-4 accent-[amber-700] rounded"
              />
              <span className="text-sm text-stone-700">{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-stone-700 block mb-1">Grid Columns</label>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => { setCatalogueColumns(n); update("catalogue_grid_columns", n); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${catalogueColumns === n ? "border-amber-600 bg-amber-700/5 text-amber-700" : "border-stone-200 text-stone-600"}`}
              >
                {n} cols
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-1">Site Features</h2>
        <p className="text-sm text-stone-500 mb-4">Enable or disable specific pages and features.</p>
        <div className="space-y-3">
          {[
            { label: "Appointment booking", sub: "Let customers book appointments via your site", val: enableAppointments, set: setEnableAppointments, field: "enable_appointments" },
            { label: "Repair enquiries", sub: "Allow customers to submit repair enquiry forms", val: enableRepairsEnquiry, set: setEnableRepairsEnquiry, field: "enable_repairs_enquiry" },
            { label: "WhatsApp chat button", sub: "Floating WhatsApp icon on every page", val: enableWhatsapp, set: setEnableWhatsapp, field: "enable_whatsapp_chat" },
          ].map(({ label, sub, val, set, field }) => (
            <div key={field} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => { set(e.target.checked); update(field as keyof WebsiteConfig, e.target.checked); }}
                className="mt-0.5 w-4 h-4 accent-[amber-700] rounded"
              />
              <div>
                <div className="text-sm font-medium text-stone-800">{label}</div>
                <div className="text-xs text-stone-400">{sub}</div>
              </div>
            </div>
          ))}
          {enableWhatsapp && (
            <div className="ml-7">
              <label className="text-xs text-stone-500 block mb-1">WhatsApp Number (with country code)</label>
              <input
                value={whatsappNumber}
                onChange={(e) => { setWhatsappNumber(e.target.value); update("whatsapp_number", e.target.value); }}
                placeholder="+61412345678"
                className="w-full max-w-xs px-3 py-2 border border-stone-200 rounded-lg text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Analytics */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-1">Analytics & Tracking</h2>
        <p className="text-sm text-stone-500 mb-4">Add tracking to measure your site's performance.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-stone-700 block mb-1">Google Analytics ID</label>
            <input
              value={gaId}
              onChange={(e) => { setGaId(e.target.value); update("google_analytics_id", e.target.value); }}
              placeholder="G-XXXXXXXXXX"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700 block mb-1">Meta / Facebook Pixel ID</label>
            <input
              value={fbPixelId}
              onChange={(e) => { setFbPixelId(e.target.value); update("facebook_pixel_id", e.target.value); }}
              placeholder="1234567890"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-900 mb-1">Business Hours</h2>
        <p className="text-sm text-stone-500 mb-4">Display your opening hours on your website so customers know when you&apos;re available.</p>
        <BusinessHoursEditor
          value={businessHours}
          onChange={(hours) => {
            setBusinessHours(hours);
            update("business_hours", hours);
          }}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Advanced Settings"}
        </button>
      </div>
    </div>
  );
}
