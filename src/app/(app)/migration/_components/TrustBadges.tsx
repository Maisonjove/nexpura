'use client';

import { ShieldCheck, Eye, FileText, RotateCcw } from 'lucide-react';

const badges = [
  { icon: ShieldCheck, text: 'Nothing imports until you approve' },
  { icon: Eye, text: 'Full preview before any changes' },
  { icon: FileText, text: 'Every step is logged' },
  { icon: RotateCcw, text: 'Session-level rollback available' },
];

export function TrustBadges() {
  return (
    <div className="flex flex-wrap gap-3">
      {badges.map((badge) => (
        <div
          key={badge.text}
          className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5"
        >
          <badge.icon className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-800">{badge.text}</span>
        </div>
      ))}
    </div>
  );
}
