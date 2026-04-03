"use client";

import { useState } from "react";

export default function AttachmentsDemo() {
  const [dragActive, setDragActive] = useState(false);
  const [attachments, setAttachments] = useState([
    { id: "1", name: "ring-cad-design-v2.stl", type: "🎨", date: "Apr 3, 2026" },
    { id: "2", name: "progress-photo-1.jpg", type: "🖼️", date: "Apr 2, 2026" },
    { id: "3", name: "gemstone-certificate.pdf", type: "📕", date: "Apr 1, 2026" },
  ]);

  return (
    <div className="min-h-screen bg-stone-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center">
              <span className="text-white font-bold">N</span>
            </div>
            <span className="text-sm text-stone-400">Demo Preview</span>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900">Edit Repair</h1>
          <p className="text-sm text-stone-500">REP-014 — 18K White Gold Diamond Engagement Ring</p>
        </div>

        {/* Attachments Section */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-1">Customer Attachments</h2>
          <p className="text-xs text-stone-500 mb-6">
            Share CAD designs, progress photos, or documents with your customer via the tracking page
          </p>

          {/* Upload Area */}
          <div
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); }}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${dragActive ? "border-amber-500 bg-amber-50" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"}
            `}
          >
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-stone-700">
                Drop files here or click to upload
              </p>
              <p className="text-xs text-stone-400">
                CAD files, images, PDFs • Max 10MB per file
              </p>
            </div>
          </div>

          {/* Attachments List */}
          <div className="mt-6 space-y-2">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Shared with Customer ({attachments.length})
            </p>
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg group hover:bg-stone-100 transition-colors"
                >
                  <span className="text-xl">{attachment.type}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-stone-400">{attachment.date}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors" title="View">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button className="p-1.5 text-stone-400 hover:text-red-600 transition-colors" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-lg">
            <div className="flex gap-3">
              <span className="text-amber-600">💡</span>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Files appear on the customer tracking page</p>
                <p className="text-amber-700">When you upload CAD designs or progress photos here, your customer can view them at their tracking link — no login required for them.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end gap-3">
          <button className="px-5 py-2.5 text-sm font-medium text-stone-900 bg-white border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-all">
            Cancel
          </button>
          <button className="px-6 py-2.5 text-sm font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
