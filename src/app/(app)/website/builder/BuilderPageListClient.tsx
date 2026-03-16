"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSitePage, togglePagePublished, deleteSitePage } from "./actions";
import type { SitePage } from "./actions";

const PAGE_TYPE_OPTIONS = [
  { value: "custom", label: "Custom Page" },
  { value: "home", label: "Home" },
  { value: "about", label: "About" },
  { value: "contact", label: "Contact" },
  { value: "policies", label: "Policies" },
  { value: "collection", label: "Collection" },
  { value: "appointment", label: "Appointment" },
  { value: "custom_enquiry", label: "Custom Enquiry" },
  { value: "repair_enquiry", label: "Repair Enquiry" },
];

const PAGE_TYPE_ICONS: Record<string, string> = {
  home: "🏠",
  about: "📖",
  contact: "📞",
  policies: "📋",
  collection: "💎",
  appointment: "📅",
  custom_enquiry: "💬",
  repair_enquiry: "🔧",
  custom: "📄",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  initialPages: SitePage[];
}

export default function BuilderPageListClient({ initialPages }: Props) {
  const router = useRouter();
  const [pages, setPages] = useState<SitePage[]>(initialPages);
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newType, setNewType] = useState("custom");
  const [error, setError] = useState<string | null>(null);

  function handleTitleChange(v: string) {
    setNewTitle(v);
    setNewSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }

  function handleCreate() {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createSitePage({ title: newTitle.trim(), slug: newSlug.trim(), page_type: newType });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setPages((prev) => [...prev, result.data!]);
        setShowCreate(false);
        setNewTitle("");
        setNewSlug("");
        setNewType("custom");
      }
    });
  }

  function handleTogglePublish(page: SitePage) {
    startTransition(async () => {
      await togglePagePublished(page.id, !page.published);
      setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, published: !page.published } : p));
    });
  }

  function handleDelete(pageId: string) {
    if (!confirm("Delete this page? This will also delete all its sections.")) return;
    startTransition(async () => {
      await deleteSitePage(pageId);
      setPages((prev) => prev.filter((p) => p.id !== pageId));
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Website Builder</h1>
          <p className="text-stone-500 text-sm mt-1">Create and manage your website pages</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/website"
            className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
          >
            ← Back to Website
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors"
          >
            + Add Page
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">New Page</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Page Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Our Story"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">URL Slug</label>
                <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[amber-700]/30">
                  <span className="px-3 py-2 text-sm text-stone-400 bg-stone-50 border-r border-stone-200">/</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="our-story"
                    className="flex-1 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">Page Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                >
                  {PAGE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !newTitle.trim() || !newSlug.trim()}
                className="flex-1 px-4 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Create Page"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pages table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        {pages.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <p className="text-4xl mb-3">📄</p>
            <p>No pages yet. Add one to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Page</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Slug</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Updated</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-stone-50/40 transition-colors">
                  <td className="px-5 py-4 font-medium text-stone-900">
                    {PAGE_TYPE_ICONS[page.page_type] || "📄"} {page.title}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-stone-500">/{page.slug}</td>
                  <td className="px-5 py-4 text-stone-500 capitalize">{page.page_type.replace("_", " ")}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleTogglePublish(page)}
                      disabled={isPending}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        page.published
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${page.published ? "bg-green-500" : "bg-stone-400"}`} />
                      {page.published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-stone-400 text-xs">{fmtDate(page.updated_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/website/builder/${page.id}`}
                        className="text-amber-700 hover:text-[#7a6349] text-xs font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(page.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
        <p className="text-sm text-stone-600">
          💡 <strong>Tip:</strong> Click &quot;Edit&quot; on any page to open the section builder. Each page can have multiple sections (hero, text, gallery, etc.).
        </p>
      </div>
    </div>
  );
}
