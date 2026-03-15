'use client';

import { Users, Package, Wrench, Gem, FileText, CreditCard, AlertCircle, XCircle } from 'lucide-react';

interface EntitySummary {
  entity: string;
  create: number;
  update: number;
  skip: number;
  errors: number;
  warnings: number;
}

interface ImportPreviewPanelProps {
  summary: EntitySummary[];
  totalErrors: number;
  totalWarnings: number;
}

const entityIcons: Record<string, React.ReactNode> = {
  customers: <Users className="w-4 h-4" />,
  inventory: <Package className="w-4 h-4" />,
  repairs: <Wrench className="w-4 h-4" />,
  bespoke: <Gem className="w-4 h-4" />,
  invoices: <FileText className="w-4 h-4" />,
  payments: <CreditCard className="w-4 h-4" />,
};

export function ImportPreviewPanel({ summary, totalErrors, totalWarnings }: ImportPreviewPanelProps) {
  return (
    <div className="space-y-3">
      {summary.map((item) => (
        <div key={item.entity} className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-stone-600">{entityIcons[item.entity] || <FileText className="w-4 h-4" />}</span>
            <h4 className="font-semibold text-stone-900 capitalize">{item.entity}</h4>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            <div className="text-center">
              <p className="text-xl font-bold text-stone-900">{item.create.toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-0.5">Create</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-stone-900">{item.update.toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-0.5">Update</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-stone-500">{item.skip.toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-0.5">Skip</p>
            </div>
            {item.warnings > 0 && (
              <div className="text-center">
                <p className="text-xl font-bold text-amber-600">{item.warnings}</p>
                <p className="text-xs text-amber-600 mt-0.5">Warnings</p>
              </div>
            )}
            {item.errors > 0 && (
              <div className="text-center">
                <p className="text-xl font-bold text-red-600">{item.errors}</p>
                <p className="text-xs text-red-600 mt-0.5">Errors</p>
              </div>
            )}
          </div>
        </div>
      ))}

      {totalErrors > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{totalErrors} blocking errors</p>
            <p className="text-xs text-red-600 mt-0.5">These records cannot be imported. Review and resolve before continuing.</p>
          </div>
        </div>
      )}

      {totalWarnings > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">{totalWarnings} warnings</p>
            <p className="text-xs text-yellow-700 mt-0.5">These records will import but may need manual review after import.</p>
          </div>
        </div>
      )}
    </div>
  );
}
