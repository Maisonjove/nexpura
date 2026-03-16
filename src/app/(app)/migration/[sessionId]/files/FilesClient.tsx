'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ArrowRight, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { FileClassificationCard } from '../../_components/FileClassificationCard';
import { AIConciergePanel } from '../../_components/AIConciergePanel';
import { MigrationStepper } from '../../_components/MigrationStepper';

interface FileRecord {
  id: string;
  original_name: string;
  detected_entity: string | null;
  detected_platform: string | null;
  confidence_score: number | null;
  row_count: number | null;
  status: string;
  classification_notes: string | null;
  file_size: number | null;
}

export default function FilesClient({ sessionId, rt }: { sessionId: string, rt?: string }) {
  const router = useRouter();

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [session, setSession] = useState<any>(null);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/migration/files?sessionId=${sessionId}`);
    const data = await res.json();
    setFiles(data.files || []);
    setSession(data.session);
  }, [sessionId]);

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(() => {
      fetchFiles();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchFiles]);

  async function handleFiles(fileList: FileList) {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      await fetch('/api/migration/upload', { method: 'POST', body: formData });
    }
    setUploading(false);
    fetchFiles();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  const readyFiles = files.filter(f => ['classified', 'ready'].includes(f.status));
  const canContinue = readyFiles.length > 0;

  async function handleContinue() {
    await fetch('/api/migration/update-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, status: 'files_uploaded' }),
    });
    const rtSuffix = rt ? `?rt=${rt}` : '';
    router.push(`/migration/${sessionId}/mapping${rtSuffix}`);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/migration" className="text-stone-400 hover:text-stone-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Upload Your Files</h1>
            <p className="text-stone-500 text-sm">
              {session?.source_platform ? `Migrating from: ${session.source_platform}` : 'Step 1 of 5'}
            </p>
          </div>
        </div>
        <MigrationStepper sessionId={sessionId} currentStep={1} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
              dragging ? 'border-amber-400 bg-amber-50' : 'border-stone-300 bg-stone-50 hover:border-stone-400'
            }`}
          >
            <Upload className="w-10 h-10 text-stone-400 mx-auto mb-4" />
            <h3 className="font-semibold text-stone-900 mb-1">Drop your files here</h3>
            <p className="text-sm text-stone-500 mb-4">Supports CSV and Excel (.csv, .xls, .xlsx)</p>
            <label className="cursor-pointer inline-flex items-center gap-2 bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Browse Files'}
              <input
                type="file"
                className="hidden"
                multiple
                accept=".csv,.xls,.xlsx"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                disabled={uploading}
              />
            </label>
            <p className="text-xs text-stone-400 mt-3">Upload one file per data type: customers, inventory, repairs, etc.</p>
          </div>

          {/* File Cards */}
          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-700">Uploaded Files</h3>
              {files.map((file) => (
                <FileClassificationCard key={file.id} file={file} />
              ))}
            </div>
          )}

          {/* Continue */}
          {canContinue && (
            <button
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2 bg-amber-700 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-amber-700 transition-colors"
            >
              Continue to Mapping <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <AIConciergePanel summary={null} />

          <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-stone-500" />
              <h4 className="text-sm font-semibold text-stone-700">What to export</h4>
            </div>
            <div className="space-y-2 text-xs text-stone-600">
              <div>
                <p className="font-medium text-stone-800">Customers</p>
                <p>Name, email, phone, address, ring size, notes</p>
              </div>
              <div>
                <p className="font-medium text-stone-800">Inventory</p>
                <p>SKU, name, metal, stone, price, quantity</p>
              </div>
              <div>
                <p className="font-medium text-stone-800">Repairs</p>
                <p>Customer, item, description, status, price</p>
              </div>
              <div>
                <p className="font-medium text-stone-800">Invoices</p>
                <p>Invoice number, customer, total, date, status</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
