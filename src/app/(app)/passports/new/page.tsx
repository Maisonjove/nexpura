"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPassport } from "../actions";
import logger from "@/lib/logger";

const JEWELLERY_TYPES = [
  "ring",
  "necklace",
  "bracelet",
  "earrings",
  "brooch",
  "pendant",
  "bangle",
  "chain",
  "watch",
  "other",
];

const METAL_TYPES = ["gold", "white_gold", "rose_gold", "silver", "platinum", "palladium", "titanium", "other"];
const METAL_COLOURS = ["yellow", "white", "rose", "green", "two_tone", "other"];
const METAL_PURITIES = ["9ct", "10ct", "14ct", "18ct", "22ct", "24ct", "925", "950", "999", "other"];

const STONE_TYPES = ["diamond", "ruby", "sapphire", "emerald", "opal", "pearl", "aquamarine", "amethyst", "topaz", "tanzanite", "moissanite", "other"];
const STONE_SHAPES = ["round", "princess", "oval", "cushion", "pear", "marquise", "emerald_cut", "asscher", "radiant", "heart", "other"];

export default function NewPassportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jewelleryType, setJewelleryType] = useState("");
  const [stoneOpen, setStoneOpen] = useState(false);
  const [ringOpen, setRingOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("is_public", isPublic ? "true" : "false");
      await createPassport(formData);
    } catch (err) {
      // Next's server-side redirect() throws a sentinel NEXT_REDIRECT error
      // the framework intercepts to perform the navigation. Swallowing it
      // would leave the user stranded on /passports/new after a successful
      // save. Re-throw so Next can navigate; surface everything else.
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
      logger.error(err);
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-stone-900 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Passports
        </button>
        <h1 className="font-semibold text-3xl font-semibold text-stone-900">Create Passport</h1>
        <p className="text-sm text-gray-500 mt-1">Issue a digital certificate of authenticity</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Photos note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-sm text-amber-800">
            <p className="font-medium">Photos can be added after creating the passport</p>
            <p className="text-amber-700 mt-0.5">You&apos;ll be able to upload primary and gallery photos on the next screen.</p>
          </div>
        </div>

        {/* Section: Piece Details */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg font-semibold text-stone-900">Piece Details</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input
              name="title"
              required
              placeholder="e.g. Oval Diamond Solitaire Ring"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Jewellery Type</label>
            <select
              name="jewellery_type"
              value={jewelleryType}
              onChange={(e) => {
                setJewelleryType(e.target.value);
                if (e.target.value === "ring") setRingOpen(true);
              }}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors"
            >
              <option value="">Select type…</option>
              {JEWELLERY_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Describe the piece…"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Section: Metal */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg font-semibold text-stone-900">Metal</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Metal Type</label>
              <select name="metal_type" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors">
                <option value="">Select…</option>
                {METAL_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Metal Colour</label>
              <select name="metal_colour" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors">
                <option value="">Select…</option>
                {METAL_COLOURS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Purity</label>
              <select name="metal_purity" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors">
                <option value="">Select…</option>
                {METAL_PURITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Weight (grams)</label>
              <input
                name="metal_weight_grams"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 3.45"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section: Stone (collapsible) */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setStoneOpen(!stoneOpen)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
          >
            <h2 className="font-semibold text-lg font-semibold text-stone-900">Stone Details</h2>
            <span className="text-xs text-gray-400">{stoneOpen ? "Hide" : "Optional — click to expand"}</span>
          </button>
          {stoneOpen && (
            <div className="px-6 pb-6 space-y-4 border-t border-stone-200">
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Stone Type</label>
                  <select name="stone_type" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors">
                    <option value="">Select…</option>
                    {STONE_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Shape</label>
                  <select name="stone_shape" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors">
                    <option value="">Select…</option>
                    {STONE_SHAPES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Carat</label>
                  <input name="stone_carat" type="number" step="0.01" min="0" placeholder="e.g. 1.02" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Colour</label>
                  <input name="stone_colour" placeholder="e.g. D, E, F" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Clarity</label>
                  <input name="stone_clarity" placeholder="e.g. VS1, VVS2" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Origin</label>
                  <input name="stone_origin" placeholder="e.g. Australia, South Africa" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Certificate Number</label>
                  <input name="stone_cert_number" placeholder="e.g. GIA 1234567890" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section: Ring (collapsible, shown if type = ring) */}
        {(jewelleryType === "ring" || ringOpen) && (
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setRingOpen(!ringOpen)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
            >
              <h2 className="font-semibold text-lg font-semibold text-stone-900">Ring Details</h2>
              <span className="text-xs text-gray-400">{ringOpen ? "Hide" : "Click to expand"}</span>
            </button>
            {ringOpen && (
              <div className="px-6 pb-6 border-t border-stone-200">
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Ring Size</label>
                    <input name="ring_size" placeholder="e.g. N, 7, 54" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Setting Style</label>
                    <input name="setting_style" placeholder="e.g. Prong, Bezel, Channel" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section: Provenance */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg font-semibold text-stone-900">Provenance</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Maker / Designer</label>
              <input name="maker_name" placeholder="e.g. Tiffany & Co." className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Made In</label>
              <input name="made_in" defaultValue="Australia" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Year Made</label>
              <input name="year_made" type="number" min="1800" max="2100" placeholder={String(new Date().getFullYear())} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
            </div>
          </div>
        </div>

        {/* Section: Ownership */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-lg font-semibold text-stone-900">Ownership</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Owner Name</label>
              <input name="current_owner_name" placeholder="Full name" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Owner Email</label>
              <input name="current_owner_email" type="email" placeholder="email@example.com" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Purchase Date</label>
              <input name="purchase_date" type="date" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Purchase Price (AUD)</label>
              <input name="purchase_price" type="number" step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 transition-colors" />
            </div>
          </div>
        </div>

        {/* Section: Visibility */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg font-semibold text-stone-900">Visibility</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isPublic
                  ? "Anyone with the QR code can view this passport"
                  : "Only you and your team can see this passport"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPublic ? "bg-amber-700" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isPublic ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 border border-stone-900 text-stone-900 text-sm font-medium rounded-lg hover:bg-stone-900/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create Passport"}
          </button>
        </div>
      </form>
    </div>
  );
}
