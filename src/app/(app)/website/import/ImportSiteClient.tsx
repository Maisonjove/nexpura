"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSitePage, saveSections } from "../builder/actions";

const PLATFORMS = [
  { id: "shopify", label: "Shopify" },
  { id: "wix", label: "Wix" },
  { id: "webflow", label: "Webflow" },
  { id: "wordpress", label: "WordPress" },
  { id: "squarespace", label: "Squarespace" },
  { id: "other", label: "Other" },
];

type Step = 1 | 2 | 3;

interface AnalyzedPage {
  title: string;
  slug: string;
  sections: Array<{ type: string; contentSummary: string }>;
}

interface Analysis {
  pages: AnalyzedPage[];
  brandColors: string[];
  businessType: string;
  businessDescription: string;
}

const DEFAULT_SECTION_CONTENT: Record<string, Record<string, unknown>> = {
  hero: { heading: "Welcome to Our Jewellery Collection", subheading: "Handcrafted with passion and precision", cta_text: "Browse Collection", cta_url: "/catalogue", overlay_opacity: 0.4 },
  text: { heading: "Our Story", body: "We are passionate about crafting jewellery that tells a story.", alignment: "center" },
  image_text: { heading: "Craftsmanship", body: "Every piece is handcrafted with the finest materials.", image_url: "", image_side: "left" },
  gallery: { images: [], columns: 3 },
  product_grid: { heading: "Featured Collection", product_ids: [], columns: 3 },
  collection_grid: { heading: "Our Collections", collections: [] },
  testimonials: { heading: "What Our Customers Say", items: [{ name: "Happy Customer", text: "Absolutely beautiful jewellery. Will be back!", rating: 5 }] },
  contact_form: { heading: "Get in Touch", show_phone: true, show_address: true },
  faq: { heading: "Frequently Asked Questions", items: [{ question: "Do you offer custom designs?", answer: "Yes! We love creating bespoke pieces for our customers." }] },
  divider: { style: "line" },
};

export default function ImportSiteClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleAnalyze() {
    if (!url.trim() || !platform) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), platform }),
      });
      const data = await res.json() as { analysis?: Analysis; error?: string };
      if (data.error) throw new Error(data.error);
      setAnalysis(data.analysis ?? null);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecreate() {
    if (!analysis) return;
    setImporting(true);
    try {
      for (const page of analysis.pages) {
        const result = await createSitePage({ title: page.title, slug: page.slug, page_type: page.slug === "home" ? "home" : "custom" });
        if (result.data) {
          const sections = page.sections.map((s, i) => ({
            id: crypto.randomUUID(),
            page_id: result.data!.id,
            tenant_id: result.data!.tenant_id,
            section_type: s.type,
            display_order: i,
            content: DEFAULT_SECTION_CONTENT[s.type] ?? { heading: s.contentSummary },
            styles: {},
          }));
          await saveSections(result.data.id, sections);
        }
      }
      router.push("/website/builder");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setImporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Import Existing Site</h1>
        <p className="text-stone-500 text-sm mt-1">Analyse your current website and recreate it in the Nexpura builder.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= s ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-400"}`}>
              {s}
            </div>
            {s < 3 && <div className={`h-0.5 w-12 ${step > s ? "bg-amber-700" : "bg-stone-200"}`} />}
          </div>
        ))}
        <div className="flex gap-8 ml-2 text-xs text-stone-400">
          <span className={step >= 1 ? "text-stone-700 font-medium" : ""}>Analyse</span>
          <span className={step >= 2 ? "text-stone-700 font-medium" : ""}>Review</span>
          <span className={step >= 3 ? "text-stone-700 font-medium" : ""}>Done</span>
        </div>
      </div>

      {/* Step 1: Input */}
      {step === 1 && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-stone-900">Your Current Website</h2>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Website URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://myjewelleryshop.com"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${platform === p.id ? "border-amber-600 bg-amber-700/10 text-amber-700" : "border-stone-200 text-stone-600 hover:border-stone-300"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={loading || !url.trim() || !platform}
            className="w-full py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-[#7a6349] disabled:opacity-50 transition-colors"
          >
            {loading ? "Analysing…" : "Analyse Site →"}
          </button>

          <p className="text-xs text-stone-400 text-center">
            We use AI to analyse the likely structure of your site based on the URL and platform. We don&apos;t scrape your content.
          </p>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && analysis && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900 mb-1">Analysis Complete</h2>
            <p className="text-sm text-stone-500 mb-4">We detected the following structure for your {analysis.businessType} website:</p>

            {analysis.brandColors.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-stone-500 font-medium">Detected colours:</span>
                {analysis.brandColors.map((c, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full border border-stone-200" style={{ backgroundColor: c }} />
                    <span className="text-xs font-mono text-stone-500">{c}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {analysis.pages.map((page, i) => (
                <div key={i} className="border border-stone-100 rounded-lg p-3">
                  <p className="text-sm font-semibold text-stone-900 mb-2">
                    📄 {page.title} <span className="font-mono text-xs text-stone-400 font-normal">/{page.slug}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {page.sections.map((s, j) => (
                      <span key={j} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-full">
                        {s.type}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              ← Try Again
            </button>
            <button
              onClick={handleRecreate}
              disabled={importing}
              className="flex-1 py-2.5 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] disabled:opacity-50 transition-colors"
            >
              {importing ? "Creating pages…" : "Recreate in Nexpura Builder →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
