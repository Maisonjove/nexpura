"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import {
  importInventory, importCustomers, importRepairs,
  importBespokeJobs, importSales, importSuppliers,
  exportCustomers, exportInvoices, exportRepairs, exportBespokeJobs,
  exportSales, exportInventory, exportExpenses, exportSuppliers,
  type ImportResult,
} from "./actions";

// ──────────────────────────────────────────────────────────
// Types & constants
// ──────────────────────────────────────────────────────────

type EntityType = "inventory" | "customers" | "repairs" | "bespoke" | "sales" | "suppliers";
type TopTab = "import" | "export";

const TABS: { id: EntityType; label: string }[] = [
  { id: "inventory", label: "Inventory" },
  { id: "customers", label: "Customers" },
  { id: "repairs", label: "Repairs" },
  { id: "bespoke", label: "Bespoke Jobs" },
  { id: "sales", label: "Sales" },
  { id: "suppliers", label: "Suppliers" },
];

type ExportEntity = {
  id: string;
  label: string;
  description: string;
  countKey: string;
  action: () => Promise<{ csv: string; error?: string }>;
  filename: string;
  icon: string;
};

const EXPORT_ENTITIES: ExportEntity[] = [
  { id: "customers", label: "Customers", description: "All customer records", countKey: "customers", action: exportCustomers, filename: "nexpura-customers.csv", icon: "👤" },
  { id: "invoices", label: "Invoices", description: "All invoices with customer info", countKey: "invoices", action: exportInvoices, filename: "nexpura-invoices.csv", icon: "🧾" },
  { id: "repairs", label: "Repairs", description: "All repair tickets", countKey: "repairs", action: exportRepairs, filename: "nexpura-repairs.csv", icon: "🔧" },
  { id: "bespoke", label: "Bespoke Jobs", description: "All bespoke job records", countKey: "bespoke_jobs", action: exportBespokeJobs, filename: "nexpura-bespoke-jobs.csv", icon: "💎" },
  { id: "sales", label: "Sales", description: "All sales transactions", countKey: "sales", action: exportSales, filename: "nexpura-sales.csv", icon: "🛒" },
  { id: "inventory", label: "Inventory", description: "All inventory items", countKey: "inventory", action: exportInventory, filename: "nexpura-inventory.csv", icon: "📦" },
  { id: "expenses", label: "Expenses", description: "All expense records", countKey: "expenses", action: exportExpenses, filename: "nexpura-expenses.csv", icon: "💸" },
  { id: "suppliers", label: "Suppliers", description: "All supplier records", countKey: "suppliers", action: exportSuppliers, filename: "nexpura-suppliers.csv", icon: "🏭" },
];

const TEMPLATES: Record<EntityType, { headers: string[]; example1: string[]; example2: string[] }> = {
  inventory: {
    headers: ["name","sku","description","category","metal_type","stone_type","stone_carat","weight_grams","cost_price","retail_price","quantity","status","location","supplier_name","tags"],
    example1: ["Diamond Ring","SKU-001","18ct white gold diamond solitaire","Rings","White Gold","Diamond","0.5","4.2","2500","4500","3","in_stock","Case A","ABC Diamonds","diamond;ring;solitaire"],
    example2: ["Gold Bangle","SKU-002","9ct yellow gold plain bangle","Bangles","Yellow Gold","","","8.5","350","680","5","in_stock","Display 2","","gold;bangle"],
  },
  customers: {
    headers: ["first_name","last_name","email","phone","mobile","address","birthday","ring_size","is_vip","preferred_metal","preferred_stone","notes"],
    example1: ["Jane","Smith","jane@example.com","0400000001","0400000001","123 Main St, Sydney","1985-06-15","N","true","White Gold","Diamond","VIP client"],
    example2: ["Bob","Jones","bob@example.com","0400000002","","456 High St, Melbourne","","L","false","Yellow Gold","",""],
  },
  repairs: {
    headers: ["customer_email","item_description","work_required","technician","estimated_cost","due_date","status","notes"],
    example1: ["jane@example.com","Diamond ring prong","Retip 4 prongs","John","150","2026-04-01","intake","Handle with care"],
    example2: ["bob@example.com","Gold chain","Clasp replacement","Mary","80","2026-04-15","in_progress",""],
  },
  bespoke: {
    headers: ["customer_email","title","description","stage","metal_type","stone_type","estimated_cost","deposit_paid","due_date","notes"],
    example1: ["jane@example.com","Custom Engagement Ring","Oval diamond in 18ct rose gold","design","Rose Gold","Diamond","5500","1000","2026-06-01","Client wants thin band"],
    example2: ["bob@example.com","Wedding Band Set","Matching plain bands","enquiry","Yellow Gold","","1200","0","2026-05-01",""],
  },
  sales: {
    headers: ["customer_email","item_name","quantity","unit_price","discount","payment_method","payment_status","notes"],
    example1: ["jane@example.com","Diamond Solitaire Ring","1","4500","0","card","paid","Gift wrapped"],
    example2: ["bob@example.com","Gold Chain 50cm","2","680","10","cash","paid",""],
  },
  suppliers: {
    headers: ["name","contact_name","email","phone","address","notes"],
    example1: ["ABC Diamonds Pty Ltd","Sarah Wilson","sarah@abcdiamonds.com","0291110001","1 Diamond St, Sydney","Preferred diamond supplier"],
    example2: ["Gold Findings Co","Mike Brown","mike@goldfind.com","0391110002","5 Jewel Ave, Melbourne",""],
  },
};

// ──────────────────────────────────────────────────────────
// CSV utilities
// ──────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function buildCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => v.includes(",") ? `"${v}"` : v;
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────

interface ImportHubClientProps {
  counts?: Record<string, number>;
}

// ──────────────────────────────────────────────────────────
// Export Card Component
// ──────────────────────────────────────────────────────────

function ExportCard({
  entity,
  count,
}: {
  entity: ExportEntity;
  count: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const result = await entity.action();
      if (result.error) {
        setError(result.error);
      } else if (!result.csv) {
        setError("No data to export");
      } else {
        downloadCSV(entity.filename, result.csv);
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-xl flex-shrink-0">
          {entity.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 text-sm">{entity.label}</h3>
          <p className="text-xs text-stone-500 mt-0.5">{entity.description}</p>
          <p className="text-xs text-stone-400 mt-1">
            <span className="font-medium text-stone-600">{count.toLocaleString()}</span> records
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleDownload}
        disabled={loading || count === 0}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          done
            ? "bg-green-600 text-white"
            : "bg-stone-900 text-white hover:bg-stone-700"
        }`}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Exporting…
          </>
        ) : done ? (
          <>✓ Downloaded</>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {count === 0 ? "No data" : "Download CSV"}
          </>
        )}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────

export default function ImportHubClient({ counts = {} }: ImportHubClientProps) {
  const [topTab, setTopTab] = useState<TopTab>("import");
  const [activeTab, setActiveTab] = useState<EntityType>("inventory");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const template = TEMPLATES[activeTab];
  const systemFields = template.headers;
  const csvHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];

  // Detect if CSV headers match system fields exactly
  const headersMatch = csvHeaders.length > 0 &&
    csvHeaders.every((h) => systemFields.includes(h));

  // Auto-initialize column map when CSV changes
  const initColumnMap = useCallback(
    (csvHdrs: string[]) => {
      const map: Record<string, string> = {};
      systemFields.forEach((sf) => {
        const match = csvHdrs.find(
          (h) => h === sf || h.replace(/\s+/g, "_") === sf
        );
        map[sf] = match || "";
      });
      setColumnMap(map);
    },
    [systemFields]
  );

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      initColumnMap(Object.keys(parsed[0] || {}));
    };
    reader.readAsText(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function switchTab(tab: EntityType) {
    setActiveTab(tab);
    setRows([]);
    setFileName(null);
    setResult(null);
    setColumnMap({});
    setImportProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDownloadTemplate() {
    const content = buildCSV(template.headers, [template.example1, template.example2]);
    downloadCSV(`nexpura-${activeTab}-template.csv`, content);
  }

  // Map a CSV row using the current column mapping
  function mapRow(row: Record<string, string>): Record<string, string> {
    if (headersMatch) return row;
    const mapped: Record<string, string> = {};
    systemFields.forEach((sf) => {
      const csvCol = columnMap[sf];
      mapped[sf] = csvCol ? row[csvCol] || "" : "";
    });
    return mapped;
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);
    setImportProgress({ current: 0, total: rows.length });

    const mappedRows = rows.map(mapRow);

    startTransition(async () => {
      try {
        let res: ImportResult;
        // Dynamic mapping produces Record<string, string>[] which each import function accepts as a subset
        const typedRows = mappedRows as Parameters<typeof importInventory>[0] 
          & Parameters<typeof importCustomers>[0] 
          & Parameters<typeof importRepairs>[0] 
          & Parameters<typeof importBespokeJobs>[0] 
          & Parameters<typeof importSales>[0] 
          & Parameters<typeof importSuppliers>[0];
        switch (activeTab) {
          case "inventory":
            res = await importInventory(typedRows);
            break;
          case "customers":
            res = await importCustomers(typedRows);
            break;
          case "repairs":
            res = await importRepairs(typedRows);
            break;
          case "bespoke":
            res = await importBespokeJobs(typedRows);
            break;
          case "sales":
            res = await importSales(typedRows);
            break;
          case "suppliers":
            res = await importSuppliers(typedRows);
            break;
          default:
            res = { imported: 0, errors: [] };
        }
        setResult(res);
        setRows([]);
        setFileName(null);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err: unknown) {
        setResult({ imported: 0, errors: [{ row: 0, reason: String(err) }] });
      } finally {
        setImporting(false);
        setImportProgress(null);
      }
    });
  }

  const previewRows = rows.slice(0, 10);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Data Import &amp; Export</h1>
        <p className="text-stone-500 mt-1">
          Import data into any module, or export your data as CSV files.
        </p>
      </div>

      {/* Top-level Import / Export tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl w-fit">
        <button
          onClick={() => setTopTab("import")}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
            topTab === "import"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          ↑ Import
        </button>
        <button
          onClick={() => setTopTab("export")}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
            topTab === "export"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-500 hover:text-stone-900"
          }`}
        >
          ↓ Export
        </button>
      </div>

      {/* ── EXPORT MODE ── */}
      {topTab === "export" && (
        <div className="space-y-4">
          <p className="text-sm text-stone-500">
            Download your data as CSV files. Each file is ready to open in Excel or Google Sheets.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {EXPORT_ENTITIES.map((entity) => (
              <ExportCard
                key={entity.id}
                entity={entity}
                count={counts[entity.countKey] ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── IMPORT MODE ── */}
      {topTab === "import" && (
        <>
          {/* Entity tab bar */}
          <div className="border-b border-stone-200">
            <nav className="flex gap-1 -mb-px overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-amber-600 text-amber-700"
                      : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Step 1: Download template */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Step 1 — Download Template
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Use this template to prepare your data. It includes example rows.
                </p>
                <div className="mt-3 bg-stone-50 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
                    Required columns
                  </p>
                  <code className="text-xs text-stone-600 font-mono leading-relaxed">
                    {template.headers.join(", ")}
                  </code>
                </div>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV Template
              </button>
            </div>
          </div>

          {/* Step 2: Upload CSV */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-stone-900">Step 2 — Upload CSV</h2>
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                isDragging
                  ? "border-amber-600 bg-amber-700/5"
                  : "border-stone-300 hover:border-amber-600/60 hover:bg-stone-50"
              }`}
            >
              <svg className="w-8 h-8 text-stone-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-stone-500">
                {fileName ? (
                  <><span className="font-medium text-stone-900">{fileName}</span> · click to change</>
                ) : (
                  <>Drag &amp; drop or <span className="text-amber-700 font-medium">click to upload</span></>
                )}
              </span>
              <span className="text-xs text-stone-400 mt-1">CSV files only</span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* Step 3: Column mapping (shown when headers don't match) */}
          {rows.length > 0 && !headersMatch && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-amber-900">
                  Step 3 — Map Your Columns
                </h2>
                <p className="text-sm text-amber-700 mt-1">
                  Your CSV headers don&apos;t exactly match. Map each system field to your CSV column.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {systemFields.map((sf) => (
                  <div key={sf} className="space-y-1">
                    <label className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                      {sf.replace(/_/g, " ")}
                    </label>
                    <select
                      value={columnMap[sf] || ""}
                      onChange={(e) => setColumnMap((prev) => ({ ...prev, [sf]: e.target.value }))}
                      className="w-full text-sm border border-amber-300 rounded-md px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                    >
                      <option value="">— skip —</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Preview + Import */}
          {rows.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-stone-900">
                    {headersMatch ? "Step 3" : "Step 4"} — Preview &amp; Import
                  </h2>
                  <p className="text-sm text-stone-500">
                    {rows.length} rows detected · showing first {Math.min(10, rows.length)}
                  </p>
                </div>
                <button
                  onClick={handleImport}
                  disabled={importing || isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-700 text-white text-sm font-medium rounded-lg hover:bg-[#7a6349] transition-colors disabled:opacity-50"
                >
                  {importing || isPending ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>Import {rows.length} rows</>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wider px-4 py-2 w-10">
                        #
                      </th>
                      {(headersMatch ? csvHeaders : systemFields).map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-2"
                        >
                          {h.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {previewRows.map((row, i) => {
                      const mapped = mapRow(row);
                      const displayRow = headersMatch ? row : mapped;
                      return (
                        <tr key={i} className="hover:bg-stone-50">
                          <td className="px-4 py-2 text-xs text-stone-400">{i + 2}</td>
                          {Object.values(displayRow).map((val, j) => (
                            <td key={j} className="px-4 py-2 text-stone-700 max-w-[180px] truncate">
                              {val || <span className="text-stone-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <div className="px-4 py-2.5 text-xs text-stone-400 border-t border-stone-100 bg-stone-50">
                    … and {rows.length - 10} more rows not shown
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={`rounded-xl p-5 border ${
                result.errors.length > 0 && result.imported === 0
                  ? "bg-red-50 border-red-200"
                  : result.errors.length > 0
                  ? "bg-amber-50 border-amber-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <p
                className={`font-semibold text-base ${
                  result.errors.length > 0 && result.imported === 0
                    ? "text-red-800"
                    : result.errors.length > 0
                    ? "text-amber-800"
                    : "text-green-800"
                }`}
              >
                {result.imported > 0
                  ? `✓ Successfully imported ${result.imported} record${result.imported !== 1 ? "s" : ""}`
                  : "Import failed"}
                {result.errors.length > 0 &&
                  ` · ${result.errors.length} row${result.errors.length !== 1 ? "s" : ""} had errors`}
              </p>

              {result.errors.length > 0 && (
                <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="text-stone-500 flex-shrink-0">Row {e.row}:</span>
                      <span className="text-red-700">{e.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
