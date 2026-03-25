"use client";

import { useState } from "react";
import type { Repair } from "./types";

interface ItemRepairCardProps {
  repair: Repair;
}

export default function ItemRepairCard({ repair }: ItemRepairCardProps) {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Item &amp; Repair</h2>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-xs font-semibold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full capitalize">
            {repair.item_type}
          </span>
          <p className="text-sm font-medium text-stone-900">{repair.item_description}</p>
        </div>
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Repair Type</p>
          <p className="text-sm text-stone-700">{repair.repair_type}</p>
        </div>
        {repair.work_description && (
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Work Description</p>
            <p className="text-sm text-stone-700 leading-relaxed">{repair.work_description}</p>
          </div>
        )}
        {(repair.intake_notes || repair.internal_notes || repair.workshop_notes) && (
          <div>
            <button onClick={() => setShowNotes(!showNotes)} className="text-xs text-amber-700 hover:underline font-medium">
              {showNotes ? "Hide notes ↑" : "Show notes ↓"}
            </button>
            {showNotes && (
              <div className="mt-2 space-y-2">
                {repair.intake_notes && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3"><span className="font-semibold">Intake:</span> {repair.intake_notes}</p>}
                {repair.internal_notes && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3"><span className="font-semibold">Internal:</span> {repair.internal_notes}</p>}
                {repair.workshop_notes && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3"><span className="font-semibold">Workshop:</span> {repair.workshop_notes}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
