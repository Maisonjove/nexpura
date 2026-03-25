"use client";

interface VoidConfirmModalProps {
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function VoidConfirmModal({
  isOpen,
  isPending,
  onClose,
  onConfirm,
}: VoidConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="font-semibold text-lg font-semibold text-stone-900 mb-2">Void Invoice?</h2>
        <p className="text-sm text-stone-500 mb-6">
          This will mark the invoice as voided. This action cannot be undone. The invoice record will be preserved.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-stone-900 text-stone-900 rounded-lg hover:bg-stone-900/5 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isPending}
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isPending ? "Voiding…" : "Void Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
