'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { downloadCSV, downloadExcel, arrayToCSV } from '@/lib/export';

interface ExportColumn<T> {
  key: keyof T;
  label: string;
}

interface ExportButtonsProps<T extends Record<string, unknown>> {
  data: T[];
  columns: ExportColumn<T>[];
  filename: string;
  sheetName?: string;
  size?: 'sm' | 'md';
}

export function ExportButtons<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  sheetName = 'Export',
  size = 'md',
}: ExportButtonsProps<T>) {
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  const handleCSVExport = () => {
    setExporting('csv');
    try {
      const csv = arrayToCSV(data, columns);
      downloadCSV(csv, filename);
    } finally {
      setExporting(null);
    }
  };

  const handleExcelExport = async () => {
    setExporting('excel');
    try {
      await downloadExcel(data, columns, filename, sheetName);
    } finally {
      setExporting(null);
    }
  };

  const buttonClass = size === 'sm'
    ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50'
    : 'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50';

  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCSVExport}
        disabled={exporting !== null}
        className={`${buttonClass} border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-300`}
      >
        {exporting === 'csv' ? (
          <Loader2 className={`${iconClass} animate-spin`} />
        ) : (
          <FileText className={iconClass} />
        )}
        <span>CSV</span>
      </button>
      <button
        onClick={handleExcelExport}
        disabled={exporting !== null}
        className={`${buttonClass} border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-300`}
      >
        {exporting === 'excel' ? (
          <Loader2 className={`${iconClass} animate-spin`} />
        ) : (
          <FileSpreadsheet className={iconClass} />
        )}
        <span>Excel</span>
      </button>
    </div>
  );
}

// Dropdown version for compact UIs
export function ExportDropdown<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  sheetName = 'Export',
}: ExportButtonsProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  const handleCSVExport = () => {
    setExporting('csv');
    try {
      const csv = arrayToCSV(data, columns);
      downloadCSV(csv, filename);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const handleExcelExport = async () => {
    setExporting('excel');
    try {
      await downloadExcel(data, columns, filename, sheetName);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-colors"
      >
        <Download className="h-4 w-4" />
        <span>Export</span>
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-20">
            <button
              onClick={handleCSVExport}
              disabled={exporting !== null}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {exporting === 'csv' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Export as CSV
            </button>
            <button
              onClick={handleExcelExport}
              disabled={exporting !== null}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {exporting === 'excel' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Export as Excel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
