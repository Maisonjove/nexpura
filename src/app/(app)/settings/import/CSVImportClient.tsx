"use client";

import { useState, useRef, useTransition } from "react";
import { importCustomers, importInventory, CustomerRow, InventoryRow } from "./actions";

type ImportType = "customers" | "inventory";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    // Basic CSV parse (handles quoted commas)
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

const CUSTOMER_HEADERS = ["full_name", "email", "phone", "mobile", "address", "notes"];
const INVENTORY_HEADERS = ["name", "sku", "metal_type", "stone_type", "retail_price", "quantity", "description"];

export default function CSVImportClient() {
  const [type, setType] = useState<ImportType>("customers");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  function handleImport() {
    startTransition(async () => {
      if (type === "customers") {
        const customerRows: CustomerRow[] = rows.map((r) => ({
          full_name: r.full_name || r.name || "",
          email: r.email,
          phone: r.phone,
          mobile: r.mobile,
          address: r.address,
          notes: r.notes,
        }));
        const res = await importCustomers(customerRows);
        setResult(res);
      } else {
        const invRows: InventoryRow[] = rows.map((r) => ({
          name: r.name || "",
          sku: r.sku,
          metal_type: r.metal_type,
          stone_type: r.stone_type,
          retail_price: r.retail_price,
          quantity: r.quantity,
          description: r.description,
        }));
        const res = await importInventory(invRows);
        setResult(res);
      }
      setRows([]);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  const displayHeaders = type === "customers" ? CUSTOMER_HEADERS : INVENTORY_HEADERS;
  const previewRows = rows.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">CSV Import</h1>
        <p className="text-stone-500 mt-1">Import customers or inventory from a CSV file.</p>
      </div>

      {/* Type selector */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-stone-900">1. Choose Import Type</h2>
        <div className="flex gap-3">
          {(["customers", "inventory"] as ImportType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setRows([]); setFileName(null); setResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                type === t
                  ? "bg-[#52B788] text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Expected format */}
        <div className="bg-stone-50 rounded-lg p-3">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
            Expected CSV columns:
          </p>
          <code className="text-xs text-stone-700 font-mono">
            {displayHeaders.join(", ")}
          </code>
        </div>
      </div>

      {/* File upload */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-stone-900">2. Upload CSV File</h2>
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-[#52B788] hover:bg-stone-50 transition-colors">
          <svg className="w-8 h-8 text-stone-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm text-stone-500">
            {fileName ? fileName : "Click to upload CSV"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFile}
          />
        </label>
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">
              3. Preview ({rows.length} rows)
            </h2>
            <button
              onClick={handleImport}
              disabled={isPending}
              className="px-4 py-2 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#3d9068] transition-colors disabled:opacity-50"
            >
              {isPending ? "Importing…" : `Import ${rows.length} ${type}`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  {Object.keys(rows[0]).map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-2 text-stone-700 max-w-[200px] truncate">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && (
              <div className="px-4 py-2 text-xs text-stone-400 border-t border-stone-100">
                …and {rows.length - 5} more rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-xl p-5 border ${result.errors.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
          <p className={`font-semibold ${result.errors.length > 0 ? "text-amber-800" : "text-green-800"}`}>
            ✓ Imported {result.imported} records
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-sm text-red-600 mt-1">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}
