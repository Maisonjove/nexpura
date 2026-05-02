"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
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
    const trimmedTitle = newTitle.trim();
    const trimmedSlug = newSlug.trim();
    
    if (!trimmedTitle) {
      setError("Page title is required");
      return;
    }
    if (trimmedTitle.length < 2) {
      setError("Page title must be at least 2 characters");
      return;
    }
    if (!trimmedSlug) {
      setError("URL slug is required");
      return;
    }
    if (trimmedSlug.length < 2) {
      setError("URL slug must be at least 2 characters");
      return;
    }
    
    setError(null);
    const createToast = toast.loading("Creating page…");
    
    startTransition(async () => {
      const result = await createSitePage({ title: trimmedTitle, slug: trimmedSlug, page_type: newType });
      if (result.error) {
        setError(result.error);
        toast.error(result.error, { id: createToast });
      } else if (result.data) {
        setPages((prev) => [...prev, result.data!]);
        setShowCreate(false);
        setNewTitle("");
        setNewSlug("");
        setNewType("custom");
        toast.success(`Page "${result.data.title}" created`, { id: createToast });
      }
    });
  }

  function handleTogglePublish(page: SitePage) {
    const action = page.published ? "Unpublishing" : "Publishing";
    const actionPast = page.published ? "unpublished" : "published";
    const statusToast = toast.loading(`${action} "${page.title}"…`);
    
    startTransition(async () => {
      const result = await togglePagePublished(page.id, !page.published);
      if (result.error) {
        toast.error(result.error, { id: statusToast });
      } else {
        setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, published: !page.published } : p));
        toast.success(`"${page.title}" ${actionPast}`, { id: statusToast });
      }
    });
  }

  function handleDeleteClick(pageId: string) {
    setShowDeleteConfirm(pageId);
  }

  function handleDeleteConfirm() {
    if (!showDeleteConfirm) return;
    
    const page = pages.find(p => p.id === showDeleteConfirm);
    const pageName = page?.title || "Page";
    const deleteToast = toast.loading(`Deleting "${pageName}"…`);
    
    startTransition(async () => {
      const result = await deleteSitePage(showDeleteConfirm);
      if (result.error) {
        toast.error(result.error, { id: deleteToast });
      } else {
        setPages((prev) => prev.filter((p) => p.id !== showDeleteConfirm));
        toast.success(`"${pageName}" deleted`, { id: deleteToast });
      }
      setShowDeleteConfirm(null);
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
            className="px-4 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors"
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
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30 focus:border-nexpura-bronze"
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
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30"
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
                className="flex-1 px-4 py-2 bg-nexpura-charcoal text-white text-sm font-medium rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
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
          <div className="py-12 px-6 text-center space-y-5">
            <div>
              <p className="text-4xl mb-3">🌐</p>
              <p className="text-stone-700 font-semibold text-base">No pages yet</p>
              <p className="text-stone-400 text-sm mt-1">Start by adding the core pages your jewellery store needs.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
              {[
                { icon: "🏠", label: "Home", type: "home", slug: "home" },
                { icon: "💎", label: "Collection", type: "collection", slug: "collection" },
                { icon: "📖", label: "About", type: "about", slug: "about" },
                { icon: "📞", label: "Contact", type: "contact", slug: "contact" },
              ].map((suggestion) => (
                <button
                  key={suggestion.slug}
                  onClick={() => {
                    setNewTitle(suggestion.label);
                    setNewSlug(suggestion.slug);
                    setNewType(suggestion.type);
                    setShowCreate(true);
                  }}
                  className="flex flex-col items-center gap-2 p-4 border border-stone-200 rounded-xl hover:border-amber-600/50 hover:bg-amber-50/30 transition-all"
                >
                  <span className="text-2xl">{suggestion.icon}</span>
                  <span className="text-xs font-semibold text-stone-700">{suggestion.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm text-stone-400 hover:text-stone-700 underline underline-offset-2"
            >
              Or add a custom page →
            </button>
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
                        onClick={() => handleDeleteClick(page.id)}
                        disabled={page.page_type === "home"}
                        className="text-red-400 hover:text-red-600 text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                        title={page.page_type === "home" ? "Home page cannot be deleted" : "Delete page"}
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

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-lg">⚠️</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Delete Page</h2>
                <p className="text-sm text-stone-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-stone-600 mb-6">
              Are you sure you want to delete <strong>"{pages.find(p => p.id === showDeleteConfirm)?.title}"</strong>? 
              This will permanently remove the page and all its sections.
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
                {isPending ? "Deleting…" : "Delete Page"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-stone-900">How it works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "1", icon: "📄", title: "Add pages", desc: "Create the pages your site needs — Home, About, Collection, Contact." },
            { step: "2", icon: "🧩", title: "Build sections", desc: "Click Edit on any page to add hero, text, gallery, and product grid sections." },
            { step: "3", icon: "🌐", title: "Publish", desc: "When ready, hit Publish in the Website settings to take it live." },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-amber-700/10 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.step}
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-800">{item.icon} {item.title}</p>
                <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
