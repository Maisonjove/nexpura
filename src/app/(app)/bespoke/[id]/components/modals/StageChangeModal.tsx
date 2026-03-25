"use client";

import { BESPOKE_STAGES } from "../constants";

interface StageChangeModalProps {
  isOpen: boolean;
  targetStage: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function StageChangeModal({
  isOpen,
  targetStage,
  isPending,
  onClose,
  onConfirm,
}: StageChangeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-2">Advance Stage</h3>
        <p className="text-sm text-stone-500 mb-5">Move to <span className="font-semibold text-stone-900">{BESPOKE_STAGES.find(s => s.key === targetStage)?.label ?? targetStage}</span>?</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
          <button onClick={onConfirm} disabled={isPending} className="flex-1 bg-amber-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-amber-800 disabled:opacity-50">{isPending ? "Updating…" : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}
