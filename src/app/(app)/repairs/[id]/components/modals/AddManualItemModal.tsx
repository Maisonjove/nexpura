"use client";

interface AddManualItemModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  formError: string | null;
  manualDesc: string;
  setManualDesc: (v: string) => void;
  manualQty: string;
  setManualQty: (v: string) => void;
  manualPrice: string;
  setManualPrice: (v: string) => void;
  currency: string;
}

export default function AddManualItemModal({
  show,
  onClose,
  onSubmit,
  isPending,
  formError,
  manualDesc,
  setManualDesc,
  manualQty,
  setManualQty,
  manualPrice,
  setManualPrice,
  currency,
}: AddManualItemModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg text-stone-900 mb-4">Add Manual Line Item</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Description *</label>
            <input 
              value={manualDesc} 
              onChange={e => setManualDesc(e.target.value)} 
              placeholder="e.g. Ring resizing labour" 
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze" 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Quantity</label>
              <input 
                type="number" 
                value={manualQty} 
                onChange={e => setManualQty(e.target.value)} 
                min="1" 
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Unit Price ({currency})</label>
              <input 
                type="number" 
                value={manualPrice} 
                onChange={e => setManualPrice(e.target.value)} 
                placeholder="0.00" 
                step="0.01" 
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-nexpura-bronze" 
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-stone-200 text-stone-700 text-sm font-medium py-2.5 rounded-lg hover:bg-stone-50">Cancel</button>
          <button onClick={onSubmit} disabled={isPending} className="flex-1 bg-nexpura-bronze text-white text-sm font-medium py-2.5 rounded-lg hover:bg-nexpura-bronze-hover disabled:opacity-50">
            {isPending ? "Adding…" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
