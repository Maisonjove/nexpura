"use client"

import { useState, useEffect, useRef } from "react"
import StockTag, { type StockTagTemplate, type StockTagItem } from "@/components/StockTag"
import { getStockTagTemplates } from "./actions"

interface BatchPrintModalProps {
  items: StockTagItem[]
  tenantName: string
  onClose: () => void
}

export default function BatchPrintModal({ items, tenantName, onClose }: BatchPrintModalProps) {
  const [templates, setTemplates] = useState<StockTagTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getStockTagTemplates().then((data: StockTagTemplate[]) => {
      setTemplates(data)
      const defaultTpl = data.find((t) => (t as StockTagTemplate & { is_default?: boolean }).is_default) ?? data[0]
      if (defaultTpl) setSelectedTemplateId(defaultTpl.id)
      setLoading(false)
    })
  }, [])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0]

  function handlePrint() {
    if (!printRef.current) return
    const printContents = printRef.current.innerHTML
    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Stock Tags</title>
          <style>
            body { margin: 0; padding: 16px; background: white; }
            .tags-grid { display: flex; flex-wrap: wrap; gap: 4px; }
            @media print {
              body { padding: 0; }
              .tags-grid { gap: 2px; }
            }
          </style>
        </head>
        <body>
          <div class="tags-grid">${printContents}</div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-lg font-semibold text-stone-900">Print Stock Tags</h3>
            <p className="text-sm text-stone-500 mt-0.5">{items.length} item{items.length === 1 ? "" : "s"} selected</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-stone-400 text-center py-8">Loading templates…</div>
        ) : (
          <>
            {templates.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Tag Template</label>
                <select
                  value={selectedTemplateId ?? ""}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600/30 text-stone-900 bg-white"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview grid */}
            {selectedTemplate && (
              <div className="mb-5">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">Preview</p>
                <div className="bg-gray-50 rounded-lg p-4 border border-stone-200 overflow-auto max-h-64">
                  <div ref={printRef} className="flex flex-wrap gap-1">
                    {items.map((item) => (
                      <StockTag key={item.id} item={item} template={selectedTemplate} tenantName={tenantName} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                disabled={!selectedTemplate}
                className="flex-1 py-2.5 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-900/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print All Tags
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
