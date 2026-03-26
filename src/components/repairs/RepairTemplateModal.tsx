"use client";

import { useState, useEffect } from "react";
import { X, FileText, Plus, Trash2, Copy } from "lucide-react";

interface RepairTemplate {
  id: string;
  name: string;
  item_type: string;
  item_description: string;
  repair_type: string;
  estimated_cost: number | null;
  estimated_days: number | null;
  notes: string | null;
  created_at: string;
}

interface Repair {
  id: string;
  item_type: string;
  item_description: string;
  repair_type: string;
  estimated_cost: number | null;
  estimated_days: number | null;
  notes: string | null;
}

interface RepairTemplateModalProps {
  mode: "save" | "load";
  repair?: Repair; // For save mode
  templates: RepairTemplate[];
  onClose: () => void;
  onSave?: (name: string, repair: Repair) => Promise<void>;
  onLoad?: (template: RepairTemplate) => void;
  onDelete?: (templateId: string) => Promise<void>;
}

export default function RepairTemplateModal({
  mode,
  repair,
  templates,
  onClose,
  onSave,
  onLoad,
  onDelete,
}: RepairTemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.item_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.repair_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleSave() {
    if (!templateName.trim() || !repair || !onSave) return;

    setLoading(true);
    setError(null);

    try {
      await onSave(templateName.trim(), repair);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(templateId: string) {
    if (!onDelete) return;
    if (!confirm("Delete this template? This cannot be undone.")) return;

    setLoading(true);
    setError(null);

    try {
      await onDelete(templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">
                {mode === "save" ? "Save as Template" : "Load Template"}
              </h2>
              <p className="text-sm text-stone-500">
                {mode === "save"
                  ? "Save this repair as a reusable template"
                  : "Create a new repair from a template"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {mode === "save" && repair && (
            <div className="space-y-4">
              {/* Template name input */}
              <div>
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Ring Resizing, Watch Battery Change"
                  className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Preview */}
              <div className="bg-stone-50 rounded-xl p-4">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
                  Template Details
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-stone-400">Item Type</span>
                    <p className="text-stone-900 capitalize">
                      {repair.item_type.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-400">Repair Type</span>
                    <p className="text-stone-900 capitalize">
                      {repair.repair_type.replace(/_/g, " ")}
                    </p>
                  </div>
                  {repair.estimated_cost && (
                    <div>
                      <span className="text-stone-400">Est. Cost</span>
                      <p className="text-stone-900">${repair.estimated_cost}</p>
                    </div>
                  )}
                  {repair.estimated_days && (
                    <div>
                      <span className="text-stone-400">Est. Days</span>
                      <p className="text-stone-900">{repair.estimated_days} days</p>
                    </div>
                  )}
                </div>
                {repair.item_description && (
                  <div className="mt-3 pt-3 border-t border-stone-200">
                    <span className="text-stone-400 text-sm">Description</span>
                    <p className="text-stone-900 text-sm mt-1">
                      {repair.item_description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "load" && (
            <div className="space-y-4">
              {/* Search */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search templates..."
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
              />

              {/* Templates list */}
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-500">
                    {templates.length === 0
                      ? "No templates yet"
                      : "No matching templates"}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Save a repair as a template to reuse it later
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 hover:border-amber-200 hover:bg-amber-50/50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-stone-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-900 truncate">
                          {template.name}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {template.item_type.replace(/_/g, " ")} ·{" "}
                          {template.repair_type.replace(/_/g, " ")}
                          {template.estimated_cost &&
                            ` · $${template.estimated_cost}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onLoad?.(template)}
                          className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                          title="Use this template"
                        >
                          <Copy className="h-4 w-4 text-amber-700" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete template"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-white transition-colors"
          >
            Cancel
          </button>
          {mode === "save" && (
            <button
              onClick={handleSave}
              disabled={loading || !templateName.trim()}
              className="flex-1 bg-amber-700 text-white font-medium py-2.5 rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Template"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
