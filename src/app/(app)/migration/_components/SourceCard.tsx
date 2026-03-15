'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

interface SourceCardProps {
  source: {
    id: string;
    name: string;
    logo: string;
    category: string;
    description: string;
    entities: string[];
    difficulty: string;
    notes: string;
  };
}

const difficultyColors: Record<string, string> = {
  easy: 'text-green-700 bg-green-50 border-green-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  hard: 'text-red-700 bg-red-50 border-red-200',
  variable: 'text-stone-600 bg-stone-50 border-stone-200',
};

const categoryColors: Record<string, string> = {
  jewellery: 'text-amber-700 bg-amber-50',
  retail: 'text-stone-700 bg-stone-100',
  accounting: 'text-stone-600 bg-stone-50',
  generic: 'text-stone-600 bg-stone-50',
};

export function SourceCard({ source }: SourceCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch('/api/migration/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePlatform: source.id }),
      });
      const data = await res.json();
      if (data.sessionId) {
        router.push(`/migration/${data.sessionId}/files`);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 flex flex-col gap-3 hover:border-stone-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{source.logo}</span>
          <div>
            <h3 className="font-semibold text-stone-900 text-sm">{source.name}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[source.category] || categoryColors.generic}`}>
              {source.category.charAt(0).toUpperCase() + source.category.slice(1)}
            </span>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${difficultyColors[source.difficulty] || difficultyColors.variable}`}>
          {source.difficulty}
        </span>
      </div>

      <p className="text-stone-600 text-sm leading-relaxed">{source.description}</p>

      <div className="flex flex-wrap gap-1">
        {source.entities.map((entity) => (
          <span key={entity} className="text-xs bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 font-medium">
            {entity}
          </span>
        ))}
      </div>

      <p className="text-xs text-stone-500 italic">{source.notes}</p>

      <button
        onClick={handleStart}
        disabled={loading}
        className="mt-auto flex items-center justify-center gap-2 bg-[#B45309] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
        ) : (
          <>Start Migration <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </div>
  );
}
