'use client';

import { CheckCircle, AlertCircle, Clock, XCircle, FileText } from 'lucide-react';

interface FileClassificationCardProps {
  file: {
    id: string;
    original_name: string;
    detected_entity: string | null;
    detected_platform: string | null;
    confidence_score: number | null;
    row_count: number | null;
    status: string;
    classification_notes: string | null;
    file_size: number | null;
  };
}

const entityColors: Record<string, string> = {
  customers: 'bg-amber-50 text-amber-700 border-amber-200',
  inventory: 'bg-stone-100 text-stone-700 border-stone-200',
  repairs: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  invoices: 'bg-stone-50 text-stone-600 border-stone-200',
  payments: 'bg-green-50 text-green-700 border-green-200',
  bespoke: 'bg-amber-50 text-amber-800 border-amber-300',
  unknown: 'bg-red-50 text-red-600 border-red-200',
};

const statusIcon = {
  pending: <Clock className="w-4 h-4 text-stone-400" />,
  classified: <CheckCircle className="w-4 h-4 text-green-600" />,
  needs_review: <AlertCircle className="w-4 h-4 text-amber-600" />,
  unsupported: <XCircle className="w-4 h-4 text-red-500" />,
  ready: <CheckCircle className="w-4 h-4 text-[#B45309]" />,
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceColor(score: number | null): string {
  if (!score) return 'text-stone-400';
  if (score >= 0.9) return 'text-green-700';
  if (score >= 0.6) return 'text-amber-600';
  return 'text-red-600';
}

export function FileClassificationCard({ file }: FileClassificationCardProps) {
  const entity = file.detected_entity || 'unknown';
  const entityStyle = entityColors[entity] || entityColors.unknown;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex items-start gap-4">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-stone-500" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-stone-900 text-sm truncate">{file.original_name}</h4>
            <p className="text-xs text-stone-500 mt-0.5">
              {file.file_size ? formatBytes(file.file_size) : ''}
              {file.row_count ? ` · ${file.row_count.toLocaleString()} rows` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {statusIcon[file.status as keyof typeof statusIcon] || statusIcon.pending}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {file.detected_entity && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${entityStyle}`}>
              {file.detected_entity}
            </span>
          )}
          {file.detected_platform && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
              {file.detected_platform}
            </span>
          )}
          {file.confidence_score !== null && (
            <span className={`text-xs font-semibold ${confidenceColor(file.confidence_score)}`}>
              {Math.round((file.confidence_score || 0) * 100)}% confidence
            </span>
          )}
        </div>

        {file.classification_notes && (
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">{file.classification_notes}</p>
        )}

        {file.status === 'pending' && (
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 bg-stone-100 rounded-full flex-1 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full animate-pulse w-2/3" />
            </div>
            <span className="text-xs text-stone-500">Classifying...</span>
          </div>
        )}
      </div>
    </div>
  );
}
