"use client"

import { useState } from "react"
import StockTag, { type StockTagTemplate } from "@/components/StockTag"
import { deleteTagTemplate, setDefaultTemplate, createTagTemplate, updateTagTemplate } from "./actions"
import { toast } from "sonner"

interface TagTemplateManagerProps {
  templates: (StockTagTemplate & { is_default?: boolean })[]
}

const DEMO_ITEM = {
  id: "demo",
  name: "Diamond Ring",
  sku: "SKU-0001",
  retail_price: 1299.99,
  metal_type: "18ct Gold",
  stone_type: "Diamond",
  metal_weight_grams: 4.2,
  barcode_value: "NX-DEMO-SKU-0001",
}

function ToggleField({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <label className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0 cursor-pointer">
      <span className="text-sm text-stone-900">{label}</span>
      <div className="flex items-center gap-2">
        <input type="hidden" name={name} value={checked ? "true" : "false"} />
        <button
          type="button"
          onClick={() => setChecked(c => !c)}
          className={`w-10 h-5 rounded-full transition-colors relative ${checked ? "bg-[#8B7355]" : "bg-gray-200"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    </label>
  )
}

function TemplateForm({
  template,
  onClose,
}: {
  template?: StockTagTemplate & { is_default?: boolean }
  onClose: () => void
}) {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    if (template) {
      await updateTagTemplate(template.id, fd)
    } else {
      await createTagTemplate(fd)
    }
    setSubmitting(false)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Template Name</label>
          <input
            name="name"
            defaultValue={template?.name ?? "New Template"}
            required
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 text-stone-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Width (mm)</label>
          <input
            name="width_mm"
            type="number"
            defaultValue={template?.width_mm ?? 50}
            min={20} max={100}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 text-stone-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Height (mm)</label>
          <input
            name="height_mm"
            type="number"
            defaultValue={template?.height_mm ?? 25}
            min={10} max={100}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 text-stone-900"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Orientation</label>
          <select
            name="orientation"
            defaultValue={template?.orientation ?? "landscape"}
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 text-stone-900 bg-white"
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Show Fields</p>
        <div className="bg-stone-50/50 border border-stone-200 rounded-lg px-4 py-1">
          <ToggleField label="Price" name="show_price" defaultChecked={template?.show_price ?? true} />
          <ToggleField label="SKU" name="show_sku" defaultChecked={template?.show_sku ?? true} />
          <ToggleField label="Barcode" name="show_barcode" defaultChecked={template?.show_barcode ?? true} />
          <ToggleField label="QR Code" name="show_qr" defaultChecked={template?.show_qr ?? false} />
          <ToggleField label="Metal Type" name="show_metal" defaultChecked={template?.show_metal ?? true} />
          <ToggleField label="Stone Type" name="show_stone" defaultChecked={template?.show_stone ?? false} />
          <ToggleField label="Weight" name="show_weight" defaultChecked={template?.show_weight ?? false} />
          <ToggleField label="Store Name" name="show_store_name" defaultChecked={template?.show_store_name ?? true} />
        </div>
      </div>

      <input type="hidden" name="font_size_name" value="10" />
      <input type="hidden" name="font_size_details" value="7" />
      <input type="hidden" name="font_size_price" value="11" />

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 text-sm font-medium text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-900/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Saving…" : template ? "Save Changes" : "Create Template"}
        </button>
      </div>
    </form>
  )
}

export default function TagTemplateManager({ templates: initialTemplates }: TagTemplateManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return
    setLoading(id)
    const result = await deleteTagTemplate(id)
    if (result.error) toast.error(result.error)
    else setTemplates(t => t.filter(x => x.id !== id))
    setLoading(null)
  }

  async function handleSetDefault(id: string) {
    setLoading(id)
    await setDefaultTemplate(id)
    setTemplates(t => t.map(x => ({ ...x, is_default: x.id === id })))
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-900/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="text-base font-semibold text-stone-900 mb-4">New Template</h3>
          <TemplateForm onClose={() => setCreating(false)} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-stone-900">{template.name}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {template.width_mm}×{template.height_mm}mm · {template.orientation}
                </p>
              </div>
              {template.is_default && (
                <span className="text-xs bg-stone-100 text-[#8B7355] px-2 py-0.5 rounded-full font-medium">Default</span>
              )}
            </div>

            {/* Preview */}
            <div className="bg-stone-50 rounded-lg p-3 flex items-center justify-center border border-stone-200">
              <div className="scale-[0.7] origin-center">
                <StockTag item={DEMO_ITEM} template={template} tenantName="My Store" />
              </div>
            </div>

            {editingId === template.id ? (
              <TemplateForm template={template} onClose={() => setEditingId(null)} />
            ) : (
              <div className="flex gap-2">
                {!template.is_default && (
                  <button
                    onClick={() => handleSetDefault(template.id)}
                    disabled={loading === template.id}
                    className="flex-1 py-2 text-xs font-medium text-[#8B7355] border border-[#8B7355]/30 rounded-lg hover:bg-[#8B7355]/5 transition-colors disabled:opacity-50"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => setEditingId(template.id)}
                  className="flex-1 py-2 text-xs font-medium text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  Edit
                </button>
                {templates.length > 1 && (
                  <button
                    onClick={() => handleDelete(template.id)}
                    disabled={loading === template.id}
                    className="py-2 px-3 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
