"use client";

import { useState, useEffect } from "react";
// `isomorphic-dompurify` boots jsdom at module-import time. Even on
// "use client" components, Next.js still evaluates the module on the
// server during SSR — the jsdom init under cacheComponents:true
// triggers React #419 ("switch to client rendering"), and the page
// flakes a hard pageerror in the console on every visit. Repro showed
// 5/5 visits to /marketing/templates threw this. Same root cause on
// /marketing/bulk-email + /marketing/campaigns/new (all 3 import
// isomorphic-dompurify at module top).
//
// Fix: lazy-load DOMPurify inside useEffect via dynamic import. The
// module is only evaluated AFTER the component has mounted in the
// browser. The SSR pass never sees jsdom. First paint the preview
// renders unsanitized-but-empty until the import resolves
// (~1 microtask), then DOMPurify.sanitize fills it.
//
// See lib/sanitize.ts top comment — the codebase already has a
// known-issue note that isomorphic-dompurify pulls jsdom + ESM
// modules that crash Vercel's runtime. This is the same family.
type Sanitizer = (html: string) => string;
function useDomPurify(): Sanitizer | null {
  const [sanitize, setSanitize] = useState<Sanitizer | null>(null);
  useEffect(() => {
    let alive = true;
    import("isomorphic-dompurify").then(({ default: DP }) => {
      if (alive) setSanitize(() => (s: string) => DP.sanitize(s));
    });
    return () => {
      alive = false;
    };
  }, []);
  return sanitize;
}
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PlusIcon,
  CakeIcon,
  HeartIcon,
  GiftIcon,
  ShoppingBagIcon,
  SparklesIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } from "./actions";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string | null;
  is_system: boolean;
  variables: string[];
  created_at: string;
}

interface Props {
  templates: Template[];
  tenantId: string;
  businessName: string;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  birthday: <CakeIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  anniversary: <HeartIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  thankyou: <GiftIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  reengagement: <EnvelopeIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  sale: <ShoppingBagIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  new_arrivals: <SparklesIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
  holiday: <SparklesIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />,
};

export default function TemplatesClient({ templates, tenantId, businessName }: Props) {
  const router = useRouter();
  const sanitize = useDomPurify();
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    template_type: "",
  });

  function openCreate() {
    setEditingTemplate(null);
    setFormData({ name: "", subject: "", body: "", template_type: "" });
    setShowModal(true);
  }

  function openEdit(template: Template) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      template_type: template.template_type || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.subject || !formData.body) return;

    setLoading("submit");

    let result;
    if (editingTemplate) {
      result = await updateTemplate(editingTemplate.id, formData);
    } else {
      result = await createTemplate(formData);
    }

    if (result.error) {
      alert(result.error);
    } else {
      setShowModal(false);
      setEditingTemplate(null);
      setFormData({ name: "", subject: "", body: "", template_type: "" });
    }

    setLoading(null);
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;

    setLoading(id);
    const result = await deleteTemplate(id);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  async function handleDuplicate(id: string) {
    setLoading(`dup-${id}`);
    const result = await duplicateTemplate(id);
    if (result.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  function getPreviewHtml(body: string) {
    return body
      .replace(/\{\{\s*customer_name\s*\}\}/gi, "John Smith")
      .replace(/\{\{\s*business_name\s*\}\}/gi, businessName)
      .replace(/\{\{\s*discount_code\s*\}\}/gi, "BIRTHDAY20")
      .replace(/\{\{\s*years\s*\}\}/gi, "2")
      .replace(/\{\{\s*item_description\s*\}\}/gi, "stunning diamond ring");
  }

  function getTemplateIcon(templateType: string | null) {
    return (
      TEMPLATE_ICONS[templateType || ""] || (
        <DocumentTextIcon className="w-6 h-6 text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300" />
      )
    );
  }

  const systemTemplates = templates.filter((t) => t.is_system);
  const customTemplates = templates.filter((t) => !t.is_system);

  return (
    <div className="bg-nexpura-ivory min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/marketing"
              aria-label="Back to marketing"
              className="mt-2 p-2 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors duration-200"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Marketing
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 tracking-tight">
                Email Templates
              </h1>
              <p className="text-stone-500 text-base mt-3 max-w-xl leading-relaxed">
                Reusable templates for your campaigns and automations — crafted once, sent often.
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="nx-btn-primary inline-flex items-center gap-2 self-start sm:self-end"
          >
            <PlusIcon className="w-4 h-4" />
            New Template
          </button>
        </div>

        {/* Variables Info */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-14">
          <p className="text-xs uppercase tracking-luxury text-stone-500 font-medium mb-3">
            Available variables
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "{{customer_name}}",
              "{{business_name}}",
              "{{discount_code}}",
              "{{years}}",
            ].map((token) => (
              <code
                key={token}
                className="font-mono text-sm text-nexpura-bronze bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-md"
              >
                {token}
              </code>
            ))}
          </div>
        </div>

        {/* System Templates */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 tracking-tight">
              System Templates
            </h2>
            <span className="text-xs uppercase tracking-luxury text-stone-400">
              {systemTemplates.length} {systemTemplates.length === 1 ? "template" : "templates"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {systemTemplates.map((template) => (
              <div
                key={template.id}
                className="group bg-white border border-stone-200 rounded-2xl p-7 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 pt-0.5">
                    {getTemplateIcon(template.template_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg text-stone-900 truncate">{template.name}</h3>
                      <LockClosedIcon className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    </div>
                    <p className="text-sm text-stone-500 truncate mt-1 leading-relaxed">{template.subject}</p>
                    <div className="flex items-center gap-5 mt-4">
                      <button
                        onClick={() => setPreviewTemplate(template)}
                        className="text-xs font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover flex items-center gap-1.5 transition-colors duration-200"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleDuplicate(template.id)}
                        disabled={loading === `dup-${template.id}`}
                        className="text-xs font-medium text-stone-500 hover:text-stone-900 flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
                      >
                        {loading === `dup-${template.id}` ? (
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                        )}
                        Duplicate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Custom Templates */}
        <section>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 tracking-tight">
              Custom Templates
            </h2>
            {customTemplates.length > 0 && (
              <span className="text-xs uppercase tracking-luxury text-stone-400">
                {customTemplates.length} {customTemplates.length === 1 ? "template" : "templates"}
              </span>
            )}
          </div>
          {customTemplates.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
              <DocumentTextIcon className="w-8 h-8 text-stone-400 mx-auto mb-5" />
              <h3 className="font-serif text-xl text-stone-900 mb-3 tracking-tight">No custom templates yet</h3>
              <p className="text-stone-500 text-sm mb-7 max-w-sm mx-auto leading-relaxed">
                Create your own templates from scratch, or duplicate a system template to start with proven copy.
              </p>
              <button
                onClick={openCreate}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Create Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              {customTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group bg-white border border-stone-200 rounded-2xl p-7 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="flex items-start gap-5">
                    <div className="flex-shrink-0 pt-0.5">
                      {getTemplateIcon(template.template_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-lg text-stone-900 truncate">{template.name}</h3>
                      <p className="text-sm text-stone-500 truncate mt-1 leading-relaxed">{template.subject}</p>
                      <div className="flex items-center flex-wrap gap-x-5 gap-y-2 mt-4">
                        <button
                          onClick={() => setPreviewTemplate(template)}
                          className="text-xs font-medium text-nexpura-bronze hover:text-nexpura-bronze-hover flex items-center gap-1.5 transition-colors duration-200"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                          Preview
                        </button>
                        <button
                          onClick={() => openEdit(template)}
                          className="text-xs font-medium text-stone-500 hover:text-stone-900 flex items-center gap-1.5 transition-colors duration-200"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDuplicate(template.id)}
                          disabled={loading === `dup-${template.id}`}
                          className="text-xs font-medium text-stone-500 hover:text-stone-900 flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
                        >
                          {loading === `dup-${template.id}` ? (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                          )}
                          Duplicate
                        </button>
                        <button
                          onClick={() => handleDelete(template.id, template.name)}
                          disabled={loading === template.id}
                          className="text-xs font-medium text-stone-500 hover:text-red-600 flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
                        >
                          {loading === template.id ? (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <TrashIcon className="w-3.5 h-3.5" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.18)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-7 py-5 border-b border-stone-200">
                <div>
                  <p className="text-xs uppercase tracking-luxury text-stone-400 mb-1">
                    {editingTemplate ? "Edit" : "Create"}
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900">
                    {editingTemplate ? "Edit Template" : "Create Template"}
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                  className="p-2 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors duration-200"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-7 space-y-5 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Monthly Newsletter"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Subject Line <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Special offer just for you, {{customer_name}}"
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    Email Body <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="<p>Dear {{customer_name}},</p>..."
                    rows={10}
                    className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-700 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 font-mono leading-relaxed"
                  />
                  <p className="text-xs text-stone-500 mt-2">
                    Supports HTML formatting. Use the variables shown above to personalise each send.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading === "submit" || !formData.name || !formData.subject || !formData.body}
                    className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading === "submit" ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="w-4 h-4" />
                        {editingTemplate ? "Save Changes" : "Create Template"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.18)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-7 py-5 border-b border-stone-200 bg-white">
                <div>
                  <p className="text-xs uppercase tracking-luxury text-stone-400 mb-1">Preview</p>
                  <h2 className="font-serif text-2xl text-stone-900">{previewTemplate.name}</h2>
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  aria-label="Close preview"
                  className="p-2 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors duration-200"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-7 overflow-y-auto flex-1">
                <div className="mb-6 pb-5 border-b border-stone-200">
                  <p className="text-xs uppercase tracking-luxury text-stone-400 mb-1.5">
                    Subject
                  </p>
                  <p className="text-lg font-medium text-stone-900">
                    {getPreviewHtml(previewTemplate.subject)}
                  </p>
                </div>
                <div
                  className="prose prose-sm max-w-none prose-stone prose-headings:font-serif prose-headings:text-stone-900 prose-p:text-stone-700 prose-a:text-nexpura-bronze"
                  dangerouslySetInnerHTML={{ __html: sanitize ? sanitize(getPreviewHtml(previewTemplate.body)) : "" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
