"use client";

import { useState } from "react";
import type { BespokeJob } from "./types";

interface JobBriefCardProps {
  job: BespokeJob;
}

function humanise(val: string | null | undefined) {
  if (!val) return null;
  return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function JobBriefCard({ job }: JobBriefCardProps) {
  const [showNotes, setShowNotes] = useState(false);

  // Build specs list
  const specs: { label: string; value: string }[] = [];
  if (job.jewellery_type) specs.push({ label: "Type", value: humanise(job.jewellery_type) ?? "" });
  if (job.metal_type) specs.push({ label: "Metal", value: humanise(job.metal_type) ?? "" });
  if (job.metal_colour) specs.push({ label: "Metal Colour", value: humanise(job.metal_colour) ?? "" });
  if (job.metal_purity) specs.push({ label: "Purity", value: job.metal_purity });
  if (job.stone_type) specs.push({ label: "Stone", value: humanise(job.stone_type) ?? "" });
  if (job.stone_carat) specs.push({ label: "Carat", value: `${job.stone_carat}ct` });
  if (job.stone_colour) specs.push({ label: "Colour", value: job.stone_colour });
  if (job.stone_clarity) specs.push({ label: "Clarity", value: job.stone_clarity });
  if (job.ring_size) specs.push({ label: "Ring Size", value: job.ring_size });
  if (job.setting_style) specs.push({ label: "Setting", value: humanise(job.setting_style) ?? "" });

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Job Brief</h2>
      <h3 className="text-base font-semibold text-stone-900 mb-1">{job.title}</h3>
      {job.description && <p className="text-sm text-stone-600 leading-relaxed mb-4">{job.description}</p>}

      {specs.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Specifications</p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {specs.map(s => (
              <div key={s.label} className="bg-stone-50 rounded-lg p-2.5">
                <dt className="text-xs text-stone-400 mb-0.5">{s.label}</dt>
                <dd className="text-sm font-semibold text-stone-900">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(job.internal_notes || job.workshop_notes) && (
        <div>
          <button onClick={() => setShowNotes(!showNotes)} className="text-xs text-amber-700 hover:underline font-medium">
            {showNotes ? "Hide notes ↑" : "Show notes ↓"}
          </button>
          {showNotes && (
            <div className="mt-2 space-y-2">
              {job.internal_notes && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3"><span className="font-semibold">Internal:</span> {job.internal_notes}</p>}
              {job.workshop_notes && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3"><span className="font-semibold">Workshop:</span> {job.workshop_notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
