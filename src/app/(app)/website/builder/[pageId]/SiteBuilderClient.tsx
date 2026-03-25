"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { saveSections, deleteSection } from "../actions";
import type { SitePage, SiteSection } from "../actions";

// ── Section type definitions ──────────────────────────────────

const SECTION_TYPES = [
  { type: "hero", label: "Hero", icon: "🖼️" },
  { type: "text", label: "Text Block", icon: "📝" },
  { type: "image_text", label: "Image + Text", icon: "🖼️" },
  { type: "gallery", label: "Gallery", icon: "🎨" },
  { type: "product_grid", label: "Product Grid", icon: "💎" },
  { type: "collection_grid", label: "Collection Grid", icon: "🗂️" },
  { type: "testimonials", label: "Testimonials", icon: "⭐" },
  { type: "contact_form", label: "Contact Form", icon: "📞" },
  { type: "enquiry_form", label: "Enquiry Form", icon: "💬" },
  { type: "repair_form", label: "Repair Form", icon: "🔧" },
  { type: "appointment_form", label: "Appointment Form", icon: "📅" },
  { type: "policies", label: "Policies/Legal", icon: "⚖️" },
  { type: "faq", label: "FAQ", icon: "❓" },
  { type: "divider", label: "Divider", icon: "➖" },
];

const DEFAULT_CONTENT: Record<string, Record<string, unknown>> = {
  hero: { heading: "Welcome to our store", subheading: "Handcrafted jewellery with love", cta_text: "Browse Collection", cta_url: "/catalogue", overlay_opacity: 0.4 },
  text: { heading: "Our Story", body: "Tell your story here...", alignment: "left" },
  image_text: { heading: "Craftsmanship", body: "Every piece is crafted with care.", image_url: "", image_side: "left" },
  gallery: { images: [], columns: 3 },
  product_grid: { heading: "Featured Pieces", product_ids: [], columns: 3 },
  collection_grid: { heading: "Collections", collections: [] },
  testimonials: { heading: "What Our Customers Say", items: [] },
  contact_form: { heading: "Contact Us", show_phone: true, show_address: true },
  enquiry_form: { heading: "Send an Enquiry", enquiry_type: "general" },
  repair_form: { heading: "Repair Enquiry" },
  appointment_form: { heading: "Book an Appointment", appointment_types: ["Consultation", "Repair Drop-off", "Custom Design"] },
  policies: { heading: "Our Policies", sections: [{ title: "Shipping", content: "Details about shipping..." }, { title: "Returns", content: "Details about returns..." }] },
  faq: { heading: "Frequently Asked Questions", items: [] },
  divider: { style: "line" },
};

function genId(): string {
  return crypto.randomUUID();
}

// ── Section preview ───────────────────────────────────────────

function SectionPreview({ section }: { section: SiteSection }) {
  const c = section.content as Record<string, unknown>;
  const s = section.styles as Record<string, string>;
  const icon = SECTION_TYPES.find((t) => t.type === section.section_type)?.icon || "📄";
  const label = SECTION_TYPES.find((t) => t.type === section.section_type)?.label || section.section_type;

  const bgStyle: React.CSSProperties = {
    backgroundColor: (s.background_color as string) || "#ffffff",
    color: (s.text_color as string) || "#1c1917",
    paddingTop: s.padding_top ? `${s.padding_top}px` : "48px",
    paddingBottom: s.padding_bottom ? `${s.padding_bottom}px` : "48px",
  };

  if (section.section_type === "hero") {
    const heroHeading = (c.heading as string) || "Hero Heading";
    const heroSubheading = (c.subheading as string) || "";
    const heroCta = c.cta_text ? (c.cta_text as string) : null;
    return (
      <div style={{ ...bgStyle, background: c.background_image_url ? `linear-gradient(rgba(0,0,0,${(c.overlay_opacity as number) || 0.4}), rgba(0,0,0,${(c.overlay_opacity as number) || 0.4})), url(${c.background_image_url as string}) center/cover` : "#1c1917", color: "#fff", minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", borderRadius: 8, padding: "48px 24px" }}>
        <h2 style={{ fontSize: 28, fontFamily: "Georgia, serif", margin: "0 0 12px" }}>{heroHeading}</h2>
        <p style={{ opacity: 0.85, margin: "0 0 20px", fontSize: 16 }}>{heroSubheading}</p>
        {heroCta && <span style={{ background: "amber-700", color: "#fff", padding: "10px 24px", borderRadius: 6, fontSize: 14 }}>{heroCta}</span>}
      </div>
    );
  }

  if (section.section_type === "divider") {
    return (
      <div style={{ ...bgStyle, padding: "24px" }}>
        {c.style === "line" ? <hr style={{ border: "none", borderTop: "1px solid #e7e5e4" }} /> : <div style={{ height: 40 }} />}
      </div>
    );
  }

  const sectionHeading = c.heading ? String(c.heading) : null;
  const sectionBody = c.body ? String(c.body) : null;
  return (
    <div style={{ ...bgStyle, borderRadius: 8, padding: "32px 24px", minHeight: 80 }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{label}</span>
      </div>
      {sectionHeading && <h3 style={{ fontSize: 20, margin: "0 0 8px", fontFamily: "Georgia, serif" }}>{sectionHeading}</h3>}
      {sectionBody && <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, opacity: 0.75 }}>{sectionBody}</p>}
    </div>
  );
}

// ── Section field editors ─────────────────────────────────────

function SectionEditor({ section, onChange }: { section: SiteSection; onChange: (s: SiteSection) => void }) {
  const c = section.content as Record<string, unknown>;
  const stl = section.styles as Record<string, string>;

  function updateContent(field: string, value: unknown) {
    onChange({ ...section, content: { ...c, [field]: value } });
  }
  function updateStyle(field: string, value: string) {
    onChange({ ...section, styles: { ...stl, [field]: value } });
  }

  const inputCls = "w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600";
  const labelCls = "block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-4">
      {/* Heading — shared by most */}
      {["hero", "text", "image_text", "product_grid", "collection_grid", "testimonials", "contact_form", "enquiry_form", "repair_form", "appointment_form", "faq"].includes(section.section_type) && (
        <div>
          <label className={labelCls}>Heading</label>
          <input type="text" className={inputCls} value={(c.heading as string) || ""} onChange={(e) => updateContent("heading", e.target.value)} />
        </div>
      )}

      {/* Hero-specific */}
      {section.section_type === "hero" && (
        <>
          <div>
            <label className={labelCls}>Subheading</label>
            <input type="text" className={inputCls} value={(c.subheading as string) || ""} onChange={(e) => updateContent("subheading", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Background Image URL</label>
            <input type="url" className={inputCls} value={(c.background_image_url as string) || ""} onChange={(e) => updateContent("background_image_url", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CTA Button Text</label>
            <input type="text" className={inputCls} value={(c.cta_text as string) || ""} onChange={(e) => updateContent("cta_text", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CTA URL</label>
            <input type="text" className={inputCls} value={(c.cta_url as string) || ""} onChange={(e) => updateContent("cta_url", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Overlay Opacity (0–1)</label>
            <input type="number" min={0} max={1} step={0.1} className={inputCls} value={String(c.overlay_opacity ?? 0.4)} onChange={(e) => updateContent("overlay_opacity", parseFloat(e.target.value))} />
          </div>
        </>
      )}

      {/* Text */}
      {section.section_type === "text" && (
        <>
          <div>
            <label className={labelCls}>Body</label>
            <textarea rows={4} className={inputCls} value={(c.body as string) || ""} onChange={(e) => updateContent("body", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Alignment</label>
            <select className={inputCls} value={(c.alignment as string) || "left"} onChange={(e) => updateContent("alignment", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      )}

      {/* Image Text */}
      {section.section_type === "image_text" && (
        <>
          <div>
            <label className={labelCls}>Body</label>
            <textarea rows={3} className={inputCls} value={(c.body as string) || ""} onChange={(e) => updateContent("body", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Image URL</label>
            <input type="url" className={inputCls} value={(c.image_url as string) || ""} onChange={(e) => updateContent("image_url", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Image Side</label>
            <select className={inputCls} value={(c.image_side as string) || "left"} onChange={(e) => updateContent("image_side", e.target.value)}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
        </>
      )}

      {/* Columns (gallery, product_grid) */}
      {["gallery", "product_grid", "collection_grid"].includes(section.section_type) && (
        <div>
          <label className={labelCls}>Columns</label>
          <select className={inputCls} value={String(c.columns ?? 3)} onChange={(e) => updateContent("columns", parseInt(e.target.value))}>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
      )}

      {/* Divider */}
      {section.section_type === "divider" && (
        <div>
          <label className={labelCls}>Style</label>
          <select className={inputCls} value={(c.style as string) || "line"} onChange={(e) => updateContent("style", e.target.value)}>
            <option value="line">Line</option>
            <option value="space">Space Only</option>
          </select>
        </div>
      )}

      {/* Styles */}
      <div className="pt-4 border-t border-stone-200">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Section Styles</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Background Color</label>
            <input type="color" value={stl.background_color || "#ffffff"} onChange={(e) => updateStyle("background_color", e.target.value)} className="w-full h-9 rounded-lg border border-stone-300 cursor-pointer" />
          </div>
          <div>
            <label className={labelCls}>Text Color</label>
            <input type="color" value={stl.text_color || "#1c1917"} onChange={(e) => updateStyle("text_color", e.target.value)} className="w-full h-9 rounded-lg border border-stone-300 cursor-pointer" />
          </div>
          <div>
            <label className={labelCls}>Padding Top (px)</label>
            <input type="number" className={inputCls} value={stl.padding_top || "48"} onChange={(e) => updateStyle("padding_top", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Padding Bottom (px)</label>
            <input type="number" className={inputCls} value={stl.padding_bottom || "48"} onChange={(e) => updateStyle("padding_bottom", e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Edit ───────────────────────────────────────────────────

function AIEditPanel({ section, onApply }: { section: SiteSection; onApply: (content: Record<string, unknown>) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAI() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/ai/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType: section.section_type, currentContent: section.content, prompt }),
      });
      const data = await res.json() as { suggestedContent?: Record<string, unknown>; error?: string };
      if (data.error) throw new Error(data.error);
      setSuggestion(data.suggestedContent ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-stone-200 pt-4 mt-4">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">✨ AI Edit</p>
      <textarea
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Make the heading more luxurious and elegant"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none mb-2"
      />
      <button onClick={handleAI} disabled={loading || !prompt.trim()} className="w-full px-3 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] disabled:opacity-50 transition-colors">
        {loading ? "Generating…" : "Generate Suggestion"}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {suggestion && (
        <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
          <pre className="text-xs text-stone-600 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(suggestion, null, 2)}</pre>
          <button onClick={() => onApply(suggestion)} className="mt-2 w-full px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors">
            Apply Suggestion
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

interface Props {
  page: SitePage;
  initialSections: SiteSection[];
}

export default function SiteBuilderClient({ page, initialSections }: Props) {
  const [sections, setSections] = useState<SiteSection[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;

  function handleSectionChange(updated: SiteSection) {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSaved(false);
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const next = [...sections];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSections(next.map((s, i) => ({ ...s, display_order: i })));
    setSaved(false);
  }

  function handleMoveDown(idx: number) {
    if (idx === sections.length - 1) return;
    const next = [...sections];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSections(next.map((s, i) => ({ ...s, display_order: i })));
    setSaved(false);
  }

  function handleAddSection(type: string) {
    const newSection: SiteSection = {
      id: genId(),
      page_id: page.id,
      tenant_id: page.tenant_id,
      section_type: type,
      display_order: sections.length,
      content: DEFAULT_CONTENT[type] ?? {},
      styles: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSections((prev) => [...prev, newSection]);
    setSelectedId(newSection.id);
    setShowAddSection(false);
    setSaved(false);
  }

  function handleDeleteSection(sectionId: string) {
    if (!confirm("Delete this section?")) return;
    startTransition(async () => {
      await deleteSection(sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      if (selectedId === sectionId) setSelectedId(null);
    });
  }

  async function handleSave() {
    setSaving(true);
    const saveToast = toast.loading("Saving page…");
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await saveSections(page.id, sections);
        if (!result.error) {
          setSaved(true);
          toast.success("Page saved", { id: saveToast });
          setSaving(false);
          return;
        }
        // Application-level error — don't retry
        lastError = result.error;
        break;
      } catch {
        lastError = "Network error — please check your connection";
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    toast.error(lastError ?? "Save failed. Please try again.", { id: saveToast });
    setSaving(false);
  }

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden -mx-6 -mt-6">
      {/* Left sidebar: section list */}
      <div className="w-60 flex-shrink-0 bg-white border-r border-stone-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200">
          <Link href="/website/builder" className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-2">
            ← All Pages
          </Link>
          <h2 className="text-sm font-semibold text-stone-900 truncate">{page.title}</h2>
          <p className="text-xs text-stone-400">/{page.slug}</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sections.map((section, idx) => {
            const typeInfo = SECTION_TYPES.find((t) => t.type === section.section_type);
            const isSelected = selectedId === section.id;
            return (
              <div
                key={section.id}
                onClick={() => setSelectedId(section.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-stone-100 border-r-2 border-amber-600" : "hover:bg-stone-50"}`}
              >
                <span className="text-base flex-shrink-0">{typeInfo?.icon || "📄"}</span>
                <span className="flex-1 text-xs font-medium text-stone-700 truncate">{typeInfo?.label || section.section_type}</span>
                <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleMoveUp(idx); }} className="p-0.5 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 text-xs" title="Move up">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); handleMoveDown(idx); }} className="p-0.5 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 text-xs" title="Move down">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }} className="p-0.5 hover:bg-red-100 rounded text-stone-400 hover:text-red-600 text-xs" title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-stone-200 p-3">
          <button
            onClick={() => setShowAddSection(true)}
            className="w-full py-2 border-2 border-dashed border-stone-300 text-stone-500 text-xs font-medium rounded-lg hover:border-amber-600 hover:text-amber-700 transition-colors"
          >
            + Add Section
          </button>
        </div>
      </div>

      {/* Main: section preview */}
      <div className="flex-1 overflow-y-auto bg-stone-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-stone-600">Page Preview</h3>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save Page"}
          </button>
        </div>

        <div className="bg-white rounded-xl overflow-hidden shadow-sm space-y-0">
          {sections.length === 0 ? (
            <div className="py-24 text-center text-stone-400">
              <p className="text-4xl mb-3">📄</p>
              <p>No sections yet. Add one from the left sidebar.</p>
            </div>
          ) : (
            sections.map((section) => (
              <div
                key={section.id}
                onClick={() => setSelectedId(section.id)}
                className={`cursor-pointer transition-all ${selectedId === section.id ? "ring-2 ring-inset ring-[amber-700]" : "hover:ring-1 hover:ring-inset hover:ring-stone-300"}`}
              >
                <SectionPreview section={section} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right sidebar: section editor */}
      {selectedSection && (
        <div className="w-72 flex-shrink-0 bg-white border-l border-stone-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200">
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">
              {SECTION_TYPES.find((t) => t.type === selectedSection.section_type)?.label || "Section"}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <SectionEditor section={selectedSection} onChange={handleSectionChange} />
            <AIEditPanel
              section={selectedSection}
              onApply={(content) => handleSectionChange({ ...selectedSection, content })}
            />
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Add Section</h2>
            <div className="grid grid-cols-2 gap-2">
              {SECTION_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => handleAddSection(t.type)}
                  className="flex items-center gap-2 px-3 py-2.5 border border-stone-200 rounded-lg hover:border-amber-600 hover:bg-amber-700/5 text-left transition-colors"
                >
                  <span className="text-base">{t.icon}</span>
                  <span className="text-xs font-medium text-stone-700">{t.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddSection(false)}
              className="mt-4 w-full py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
