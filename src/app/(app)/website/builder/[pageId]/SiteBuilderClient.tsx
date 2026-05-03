"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Undo2, Redo2, Smartphone, Monitor } from "lucide-react";
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

  const inputCls = "w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30 focus:border-nexpura-bronze";
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
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Please enter a prompt describing what you want to change");
      return;
    }
    if (trimmedPrompt.length > 2000) {
      setError("Prompt is too long (max 2000 characters)");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuggestion(null);
    
    // Create timeout for AI request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout
    
    try {
      const res = await fetch("/api/ai/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType: section.section_type, currentContent: section.content, prompt: trimmedPrompt }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await res.json() as { suggestedContent?: Record<string, unknown>; error?: string };
      
      if (!res.ok) {
        setError(data.error || "AI request failed. Please try again.");
        return;
      }
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      if (!data.suggestedContent) {
        setError("AI did not return any suggestions. Please try a different prompt.");
        return;
      }
      
      setSuggestion(data.suggestedContent);
      toast.success("AI generated suggestion — review and apply if you like it");
    } catch (e) {
      clearTimeout(timeoutId);
      
      if (e instanceof Error && e.name === "AbortError") {
        setError("AI request timed out. Please try again with a simpler prompt.");
      } else {
        setError(e instanceof Error ? e.message : "AI request failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!suggestion) return;
    onApply(suggestion);
    setSuggestion(null);
    setPrompt("");
    toast.success("AI suggestion applied — save the page to keep changes");
  }

  return (
    <div className="border-t border-stone-200 pt-4 mt-4">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">✨ AI Edit</p>
      <textarea
        rows={2}
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          if (error) setError(null);
        }}
        placeholder="e.g. Make the heading more luxurious and elegant"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30 focus:border-nexpura-bronze resize-none mb-2"
        disabled={loading}
      />
      <button 
        onClick={handleAI} 
        disabled={loading || !prompt.trim()} 
        className="w-full px-3 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {loading ? "Generating…" : "Generate Suggestion"}
      </button>
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      {suggestion && (
        <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-stone-600">AI Suggestion:</p>
            <button 
              onClick={() => setSuggestion(null)} 
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Dismiss
            </button>
          </div>
          <pre className="text-xs text-stone-600 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">{JSON.stringify(suggestion, null, 2)}</pre>
          <button onClick={handleApply} className="mt-2 w-full px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors">
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Undo/redo history (Group 13 audit). Stack of section-list snapshots,
  // pointer to the current state. Push on every mutating action; undo
  // moves the pointer back without truncating, redo moves it forward.
  // Pre-fix: no way to undo a delete/reorder/AI rewrite — staff had to
  // reload the page and lose any unsaved changes.
  const [history, setHistory] = useState<SiteSection[][]>([initialSections]);
  const [historyIndex, setHistoryIndex] = useState(0);
  // Viewport toggle for the preview area — desktop = full width,
  // mobile = constrained to 375px.
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // applySections: write a new sections snapshot, push it onto history,
  // truncate any redo branch (standard undo-stack behaviour after a new
  // edit). Wraps every mutation site below.
  const applySections = useCallback((next: SiteSection[]) => {
    setSections(next);
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      truncated.push(next);
      // Cap history at 50 entries so a long editing session doesn't
      // balloon memory. FIFO drop from the front.
      return truncated.length > 50 ? truncated.slice(truncated.length - 50) : truncated;
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
    setSaved(false);
  }, [historyIndex]);

  function undo() {
    if (!canUndo) return;
    setHistoryIndex((i) => i - 1);
    setSections(history[historyIndex - 1]);
    setSaved(false);
  }
  function redo() {
    if (!canRedo) return;
    setHistoryIndex((i) => i + 1);
    setSections(history[historyIndex + 1]);
    setSaved(false);
  }

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          setHistoryIndex((i) => {
            const next = i - 1;
            if (next >= 0) setSections(history[next]);
            return Math.max(next, 0);
          });
          setSaved(false);
        }
      } else if (e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo) {
          setHistoryIndex((i) => {
            const next = i + 1;
            if (next <= history.length - 1) setSections(history[next]);
            return Math.min(next, history.length - 1);
          });
          setSaved(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, history]);

  // dnd-kit sensors — pointer for mouse/touch, keyboard for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, display_order: i }));
    applySections(reordered);
  }
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
    applySections(next.map((s, i) => ({ ...s, display_order: i })));
  }

  function handleMoveDown(idx: number) {
    if (idx === sections.length - 1) return;
    const next = [...sections];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    applySections(next.map((s, i) => ({ ...s, display_order: i })));
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
    applySections([...sections, newSection]);
    setSelectedId(newSection.id);
    setShowAddSection(false);
  }

  function handleDeleteClick(sectionId: string) {
    setShowDeleteConfirm(sectionId);
  }

  function handleDeleteConfirm() {
    if (!showDeleteConfirm) return;
    
    const section = sections.find(s => s.id === showDeleteConfirm);
    const sectionType = SECTION_TYPES.find(t => t.type === section?.section_type)?.label || "Section";
    const deleteToast = toast.loading(`Deleting ${sectionType}…`);
    
    startTransition(async () => {
      const result = await deleteSection(showDeleteConfirm);
      if (result.error) {
        toast.error(result.error, { id: deleteToast });
      } else {
        applySections(sections.filter((s) => s.id !== showDeleteConfirm));
        if (selectedId === showDeleteConfirm) setSelectedId(null);
        toast.success(`${sectionType} deleted`, { id: deleteToast });
      }
      setShowDeleteConfirm(null);
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
          {/* Drag-drop reorder via @dnd-kit (Group 13 audit). The
              existing ↑/↓ arrow controls are kept for keyboard /
              accessibility users; both interactions coexist. Drag
              handle is the entire row + a left-edge grab indicator. */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section, idx) => (
                <SortableSidebarRow
                  key={section.id}
                  section={section}
                  idx={idx}
                  isSelected={selectedId === section.id}
                  onSelect={() => setSelectedId(section.id)}
                  onMoveUp={() => handleMoveUp(idx)}
                  onMoveDown={() => handleMoveDown(idx)}
                  onDelete={() => handleDeleteClick(section.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
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
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-stone-600">Page Preview</h3>
          <div className="flex items-center gap-2">
            {/* Undo / Redo */}
            <div className="inline-flex border border-stone-200 rounded-md overflow-hidden">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                aria-label="Undo"
                className="px-2.5 h-9 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z)"
                aria-label="Redo"
                className="px-2.5 h-9 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed border-l border-stone-200"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
            {/* Viewport toggle */}
            <div className="inline-flex border border-stone-200 rounded-md overflow-hidden">
              <button
                onClick={() => setViewport("desktop")}
                title="Desktop preview"
                aria-label="Desktop preview"
                className={`px-2.5 h-9 ${viewport === "desktop" ? "bg-amber-700 text-white" : "bg-white text-stone-700 hover:bg-stone-50"}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewport("mobile")}
                title="Mobile preview"
                aria-label="Mobile preview"
                className={`px-2.5 h-9 border-l border-stone-200 ${viewport === "mobile" ? "bg-amber-700 text-white" : "bg-white text-stone-700 hover:bg-stone-50"}`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Page"}
            </button>
          </div>
        </div>

        <div className={`bg-white rounded-xl overflow-hidden shadow-sm space-y-0 ${viewport === "mobile" ? "max-w-[390px] mx-auto border border-stone-300" : ""}`}>
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

      {/* Delete Section Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-lg">⚠️</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Delete Section</h2>
                <p className="text-sm text-stone-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-stone-600 mb-6">
              Are you sure you want to delete this <strong>{SECTION_TYPES.find(t => t.type === sections.find(s => s.id === showDeleteConfirm)?.section_type)?.label || "section"}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isPending}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Delete Section"}
              </button>
            </div>
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

// ────────────────────────────────────────────────────────────────────
// SortableSidebarRow — one row in the section list. useSortable wires
// drag listeners + transform style; the existing ↑/↓/✕ buttons are
// kept inline for keyboard users and stop drag propagation so a click
// on a button doesn't start a drag.
// ────────────────────────────────────────────────────────────────────
function SortableSidebarRow({
  section,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  section: SiteSection;
  idx: number;
  isSelected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const typeInfo = SECTION_TYPES.find((t) => t.type === section.section_type);
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-stone-100 border-r-2 border-amber-600" : "hover:bg-stone-50"}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0" {...attributes} {...listeners}>
        <span className="text-base flex-shrink-0 text-stone-300 group-hover:text-stone-500 transition-colors" aria-hidden>⋮⋮</span>
        <span className="text-base flex-shrink-0">{typeInfo?.icon || "📄"}</span>
        <span className="flex-1 text-xs font-medium text-stone-700 truncate">{typeInfo?.label || section.section_type}</span>
      </div>
      <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-0.5 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 text-xs" title="Move up" aria-label={`Move ${typeInfo?.label || section.section_type} up`}>↑</button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-0.5 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600 text-xs" title="Move down" aria-label={`Move ${typeInfo?.label || section.section_type} down`}>↓</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 hover:bg-red-100 rounded text-stone-400 hover:text-red-600 text-xs" title="Delete" aria-label={`Delete ${typeInfo?.label || section.section_type}`}>✕</button>
      </div>
    </div>
  );
}
