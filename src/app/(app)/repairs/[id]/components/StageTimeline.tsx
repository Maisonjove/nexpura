"use client";

import { REPAIR_STAGES } from "./constants";

interface StageTimelineProps {
  currentStage: string;
  onStageChange: (stage: string) => void;
  readOnly: boolean;
  isTerminal: boolean;
}

export default function StageTimeline({
  currentStage,
  onStageChange,
  readOnly,
  isTerminal,
}: StageTimelineProps) {
  const currentStageIndex = REPAIR_STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">
        Stage Timeline
      </h2>
      <div className="relative">
        <div className="absolute left-3.5 top-4 bottom-4 w-0.5 bg-stone-100" />
        <div className="space-y-1">
          {REPAIR_STAGES.map((s, idx) => {
            const isPast = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const isClickable = !readOnly && !isTerminal && idx > currentStageIndex;
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 px-2 py-2.5 rounded-lg relative transition-colors ${
                  isClickable ? "cursor-pointer hover:bg-stone-50" : ""
                } ${isCurrent ? "bg-stone-50" : ""}`}
                onClick={isClickable ? () => onStageChange(s.key) : undefined}
              >
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 z-10 flex items-center justify-center ${
                    isPast
                      ? "bg-nexpura-bronze"
                      : isCurrent
                      ? "bg-nexpura-bronze ring-4 ring-stone-200"
                      : "bg-white border-2 border-stone-200"
                  }`}
                >
                  {isPast && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {isCurrent && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <span
                  className={`text-sm ${
                    isPast
                      ? "text-stone-400 line-through"
                      : isCurrent
                      ? "text-stone-900 font-semibold"
                      : "text-stone-500"
                  }`}
                >
                  {s.label}
                </span>
                {isCurrent && (
                  <span className="ml-auto text-xs bg-nexpura-bronze text-white px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
                {isClickable && (
                  <span className="ml-auto text-xs text-stone-300 group-hover:text-stone-500">
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
