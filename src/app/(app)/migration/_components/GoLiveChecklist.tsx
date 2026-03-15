'use client';

import { useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';

const DEFAULT_CHECKLIST = [
  { id: 'verify_customers', label: 'Verify imported customers in the Customers section' },
  { id: 'check_inventory', label: 'Spot-check 10 inventory items for accuracy' },
  { id: 'test_pos', label: 'Run a test sale through POS' },
  { id: 'check_repairs', label: 'Review open repairs imported' },
  { id: 'verify_invoices', label: 'Check a sample of historical invoices' },
  { id: 'configure_settings', label: 'Configure tax settings and store details' },
  { id: 'train_staff', label: 'Brief staff on the new system' },
  { id: 'archive_old', label: 'Archive or export data from old system' },
  { id: 'cancel_old_sub', label: 'Cancel old POS subscription when ready' },
];

export function GoLiveChecklist() {
  const [checked, setChecked] = useState<string[]>([]);

  function toggle(id: string) {
    setChecked(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  const progress = Math.round((checked.length / DEFAULT_CHECKLIST.length) * 100);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-stone-900">Go-Live Checklist</h3>
        <span className="text-sm font-medium text-stone-600">{checked.length}/{DEFAULT_CHECKLIST.length}</span>
      </div>

      <div className="w-full bg-stone-100 rounded-full h-1.5 mb-4">
        <div
          className="bg-[#B45309] h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="space-y-2">
        {DEFAULT_CHECKLIST.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => toggle(item.id)}
              className="flex items-start gap-3 w-full text-left group"
            >
              {checked.includes(item.id) ? (
                <CheckSquare className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
              ) : (
                <Square className="w-4 h-4 text-stone-300 flex-shrink-0 mt-0.5 group-hover:text-stone-400" />
              )}
              <span className={`text-sm ${checked.includes(item.id) ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
