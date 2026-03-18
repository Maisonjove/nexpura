"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Plus,
  Cake,
  Heart,
  Gift,
  ShoppingBag,
  PartyPopper,
  Mail,
  Edit,
  Trash2,
  Copy,
  Eye,
  X,
  Check,
  Loader2,
  Lock,
} from "lucide-react";
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
  birthday: <Cake className="w-5 h-5 text-pink-400" />,
  anniversary: <Heart className="w-5 h-5 text-red-400" />,
  thankyou: <Gift className="w-5 h-5 text-green-400" />,
  reengagement: <Mail className="w-5 h-5 text-blue-400" />,
  sale: <ShoppingBag className="w-5 h-5 text-amber-400" />,
  new_arrivals: <PartyPopper className="w-5 h-5 text-purple-400" />,
  holiday: <PartyPopper className="w-5 h-5 text-emerald-400" />,
};

export default function TemplatesClient({ templates, tenantId, businessName }: Props) {
  const router = useRouter();
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
    return TEMPLATE_ICONS[templateType || ""] || <FileText className="w-5 h-5 text-stone-400" />;
  }

  const systemTemplates = templates.filter((t) => t.is_system);
  const customTemplates = templates.filter((t) => !t.is_system);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/marketing"
            className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Email Templates</h1>
            <p className="text-stone-400 text-sm mt-1">
              Reusable templates for campaigns and automations
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Variables Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
        <p className="text-blue-300 text-sm">
          <strong>Available variables:</strong>{" "}
          <code className="bg-blue-500/20 px-1.5 py-0.5 rounded">{"{{customer_name}}"}</code>,{" "}
          <code className="bg-blue-500/20 px-1.5 py-0.5 rounded">{"{{business_name}}"}</code>,{" "}
          <code className="bg-blue-500/20 px-1.5 py-0.5 rounded">{"{{discount_code}}"}</code>,{" "}
          <code className="bg-blue-500/20 px-1.5 py-0.5 rounded">{"{{years}}"}</code>
        </p>
      </div>

      {/* System Templates */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          System Templates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systemTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
                  {getTemplateIcon(template.template_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{template.name}</h3>
                    <Lock className="w-3 h-3 text-stone-500" />
                  </div>
                  <p className="text-sm text-stone-400 truncate mt-0.5">{template.subject}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDuplicate(template.id)}
                      disabled={loading === `dup-${template.id}`}
                      className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
                    >
                      {loading === `dup-${template.id}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Duplicate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      <div>
        <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wide mb-4">
          Custom Templates
        </h2>
        {customTemplates.length === 0 ? (
          <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-stone-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No custom templates</h3>
            <p className="text-stone-400 text-sm mb-4">
              Create your own templates or duplicate system templates
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
                    {getTemplateIcon(template.template_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white">{template.name}</h3>
                    <p className="text-sm text-stone-400 truncate mt-0.5">{template.subject}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setPreviewTemplate(template)}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Preview
                      </button>
                      <button
                        onClick={() => openEdit(template)}
                        className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(template.id)}
                        disabled={loading === `dup-${template.id}`}
                        className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
                      >
                        {loading === `dup-${template.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        disabled={loading === template.id}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        {loading === template.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
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
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-white/[0.1] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">
                {editingTemplate ? "Edit Template" : "Create Template"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Template Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Monthly Newsletter"
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Subject Line <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., 🎉 Special offer just for you, {{customer_name}}!"
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Email Body <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="<p>Dear {{customer_name}},</p>..."
                  rows={10}
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono text-sm"
                />
                <p className="text-xs text-stone-500 mt-1">
                  Supports HTML formatting
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading === "submit" || !formData.name || !formData.subject || !formData.body}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors"
                >
                  {loading === "submit" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-stone-100">
              <div>
                <p className="text-sm text-stone-500">Preview</p>
                <h2 className="text-lg font-semibold text-stone-900">{previewTemplate.name}</h2>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-stone-500">Subject:</p>
                <p className="text-lg font-medium text-stone-900">
                  {getPreviewHtml(previewTemplate.subject)}
                </p>
              </div>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml(previewTemplate.body) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
