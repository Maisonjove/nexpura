"use client";

import type { WebsiteConfig } from "../types";

interface PreviewTabProps {
  config: WebsiteConfig;
  previewUrl: string | null;
  onPublishToggle: () => void;
  isPending: boolean;
}

export default function PreviewTab({
  config,
  previewUrl,
  onPublishToggle,
  isPending,
}: PreviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-stone-900">Live Preview</h2>
          <div className="flex items-center gap-3">
            {config.subdomain && (
              <a
                href={`/${config.subdomain}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Visit Website
              </a>
            )}
            <button
              onClick={onPublishToggle}
              disabled={isPending}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                config.published
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-amber-700 text-white hover:bg-[#7a6349]"
              } disabled:opacity-50`}
            >
              {config.published ? "Unpublish" : "Publish Now"}
            </button>
          </div>
        </div>

        {config.subdomain ? (
          <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-200 border-b border-stone-300">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-3 bg-white rounded px-3 py-1 text-xs text-stone-500 font-mono">
                {config.subdomain}.nexpura.com
              </div>
            </div>
            <iframe
              src={previewUrl || ""}
              className="w-full h-[600px] border-0"
              title="Website preview"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 bg-stone-50 rounded-xl border border-dashed border-stone-300">
            <div className="text-4xl mb-3">🌐</div>
            <p className="text-stone-500 text-sm">
              Set a subdomain in Setup to preview your site
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
