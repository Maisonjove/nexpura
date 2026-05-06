"use client";

import { REPAIR_STAGES } from "../constants";

interface StageChangeModalProps {
  show: boolean;
  targetStage: string;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export default function StageChangeModal({
  show,
  targetStage,
  onClose,
  onConfirm,
  isPending,
}: StageChangeModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-2">Advance Stage</h3>
        <p className="text-sm text-stone-500 mb-5">
          Move to <span className="font-semibold text-stone-900">{REPAIR_STAGES.find(s => s.key === targetStage)?.label ?? targetStage}</span>?
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
          <button onClick={onConfirm} disabled={isPending} className="flex-1 bg-nexpura-bronze text-white text-sm font-medium py-2.5 rounded-lg hover:bg-nexpura-bronze-hover disabled:opacity-50">
            {isPending ? "Updating…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
