"use client";

import type { WebsiteConfig, AISuggestions } from "../types";

interface AITabProps {
  config: WebsiteConfig;
  aiLoading: boolean;
  aiAction: string | null;
  aiResult: AISuggestions | null;
  aiApplied: string | null;
  onAIAction: (action: string) => void;
  onApplyTagline: (tagline: string) => void;
  onDismiss: () => void;
}

export default function AITab({
  config,
  aiLoading,
  aiAction,
  aiResult,
  aiApplied,
  onAIAction,
  onApplyTagline,
  onDismiss,
}: AITabProps) {
  const AI_ACTIONS = [
    {
      action: "suggest_tagline",
      icon: "✍️",
      label: "Generate Taglines",
      desc: "Get 3 tagline options tailored to your brand",
      requires: "business_name",
    },
    {
      action: "write_about",
      icon: "📖",
      label: "Write About Text",
      desc: "AI writes a compelling story for your About section",
      requires: "business_name",
    },
    {
      action: "generate_seo",
      icon: "🔍",
      label: "Generate SEO Tags",
      desc: "Create optimized meta title & description for Google",
      requires: "business_name",
    },
    {
      action: "suggest_colors",
      icon: "🎨",
      label: "Suggest Brand Colours",
      desc: "AI recommends a colour palette for your jewellery brand",
      requires: null,
    },
    {
      action: "improve_content",
      icon: "✨",
      label: "Improve All Content",
      desc: "Review and enhance your tagline and about text at once",
      requires: "about_text",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-[amber-700]/10 to-stone-50 border border-amber-600/20 rounded-xl p-5">
        <h2 className="text-base font-semibold text-stone-900 mb-1">✦ AI Website Assistant</h2>
        <p className="text-sm text-stone-500">
          Let AI improve your website content. Changes are applied to the editor — review them and save when happy.
        </p>
      </div>

      {/* Applied success */}
      {aiApplied && !aiResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Applied! Review the changes in the Content or Branding tab, then save.
        </div>
      )}

      {/* Tagline suggestions */}
      {aiResult?.suggestions && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-stone-900">Tagline Suggestions — pick one:</h3>
          <div className="space-y-2">
            {aiResult.suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 border border-stone-200 rounded-lg hover:border-amber-600 transition-colors">
                <p className="text-sm text-stone-700 italic">&quot;{s}&quot;</p>
                <button
                  onClick={() => onApplyTagline(s)}
                  className="flex-shrink-0 px-3 py-1.5 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-[#7a6349]"
                >
                  Use This
                </button>
              </div>
            ))}
          </div>
          <button onClick={onDismiss} className="text-xs text-stone-400 hover:text-stone-600">
            Dismiss
          </button>
        </div>
      )}

      {/* Colour rationale */}
      {aiResult?.rationale && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">AI Rationale</p>
          <p className="text-sm text-stone-700">{aiResult.rationale}</p>
          <button onClick={onDismiss} className="text-xs text-stone-400 hover:text-stone-600 mt-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {AI_ACTIONS.map((item) => {
          const missingData = item.requires && !config[item.requires as keyof WebsiteConfig];
          const isLoading = aiLoading && aiAction === item.action;
          return (
            <button
              key={item.action}
              onClick={() => onAIAction(item.action)}
              disabled={aiLoading || !!missingData}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                isLoading
                  ? "border-amber-600 bg-amber-700/5"
                  : "border-stone-200 hover:border-amber-600/50 bg-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{isLoading ? "⏳" : item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 text-sm">{item.label}</p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  {missingData && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠ Set your {item.requires?.replace("_", " ")} in the {item.requires === "about_text" ? "Content" : "Branding"} tab first
                    </p>
                  )}
                  {isLoading && (
                    <p className="text-xs text-amber-700 mt-1 animate-pulse">AI is thinking…</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
        <p className="text-xs text-stone-500">
          💡 <strong>Tip:</strong> After applying AI suggestions, go to the Content or Branding tab to review the changes before saving.
        </p>
      </div>
    </div>
  );
}
