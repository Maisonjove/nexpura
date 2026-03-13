"use client";

import { useState, useTransition } from "react";
import { savePrinterConfig } from "./actions";

type PrinterType = "receipt" | "label" | "office";

interface PrinterConfig {
  printer_type?: string;
  printer_name?: string;
  brand?: string;
  connection_type?: string;
  ip_address?: string;
  port?: number;
  paper_width?: string;
  label_width_mm?: number;
  label_height_mm?: number;
  cut_enabled?: boolean;
  paper_size?: string;
  [key: string]: unknown;
}

interface Props {
  tenantId: string;
  configs: Record<string, PrinterConfig>;
}

export default function PrintingSettingsClient({ tenantId, configs }: Props) {
  const [activeTab, setActiveTab] = useState<PrinterType>("receipt");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // Receipt state
  const receiptCfg = configs["receipt"] ?? {};
  const [receiptBrand, setReceiptBrand] = useState((receiptCfg.brand as string) ?? "Epson");
  const [receiptConn, setReceiptConn] = useState((receiptCfg.connection_type as string) ?? "browser");
  const [receiptIp, setReceiptIp] = useState((receiptCfg.ip_address as string) ?? "");
  const [receiptPort, setReceiptPort] = useState((receiptCfg.port as number)?.toString() ?? "9100");
  const [receiptPaperWidth, setReceiptPaperWidth] = useState((receiptCfg.paper_width as string) ?? "80mm");
  const [receiptCut, setReceiptCut] = useState((receiptCfg.cut_enabled as boolean) ?? true);

  // Label state
  const labelCfg = configs["label"] ?? {};
  const [labelBrand, setLabelBrand] = useState((labelCfg.brand as string) ?? "Zebra");
  const [labelConn, setLabelConn] = useState((labelCfg.connection_type as string) ?? "browser");
  const [labelIp, setLabelIp] = useState((labelCfg.ip_address as string) ?? "");
  const [labelPort, setLabelPort] = useState((labelCfg.port as number)?.toString() ?? "9100");
  const [labelWidth, setLabelWidth] = useState((labelCfg.label_width_mm as number)?.toString() ?? "57");
  const [labelHeight, setLabelHeight] = useState((labelCfg.label_height_mm as number)?.toString() ?? "32");

  // Office state
  const officeCfg = configs["office"] ?? {};
  const [officePaperSize, setOfficePaperSize] = useState((officeCfg.paper_size as string) ?? "A4");

  function showMsg(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 3000);
  }

  function handleSaveReceipt() {
    startTransition(async () => {
      const result = await savePrinterConfig(tenantId, {
        printer_type: "receipt",
        brand: receiptBrand,
        connection_type: receiptConn,
        ip_address: receiptIp || null,
        port: receiptPort ? parseInt(receiptPort) : null,
        paper_width: receiptPaperWidth,
        cut_enabled: receiptCut,
      });
      if (result.error) showMsg(`Error: ${result.error}`);
      else showMsg("Receipt printer saved!");
    });
  }

  function handleSaveLabel() {
    startTransition(async () => {
      const result = await savePrinterConfig(tenantId, {
        printer_type: "label",
        brand: labelBrand,
        connection_type: labelConn,
        ip_address: labelIp || null,
        port: labelPort ? parseInt(labelPort) : null,
        label_width_mm: labelWidth ? parseInt(labelWidth) : null,
        label_height_mm: labelHeight ? parseInt(labelHeight) : null,
      });
      if (result.error) showMsg(`Error: ${result.error}`);
      else showMsg("Label printer saved!");
    });
  }

  function handleSaveOffice() {
    startTransition(async () => {
      const result = await savePrinterConfig(tenantId, {
        printer_type: "office",
        connection_type: "browser",
        paper_size: officePaperSize,
      });
      if (result.error) showMsg(`Error: ${result.error}`);
      else showMsg("Office printer saved!");
    });
  }

  function handleTestPrint(type: PrinterType) {
    const content = type === "receipt"
      ? `<html><head><title>Test</title><style>body{font-family:monospace;max-width:300px;margin:0 auto;padding:20px;font-size:12px}h2{text-align:center}</style></head><body><h2>TEST RECEIPT</h2><p style="text-align:center">Nexpura — ${new Date().toLocaleString("en-AU")}</p><hr/><p>This is a test print</p></body></html>`
      : type === "label"
      ? `<html><head><title>Test Label</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}div{border:2px solid #000;padding:10px;width:${labelWidth}mm;height:${labelHeight}mm;font-family:monospace;font-size:10px;display:flex;align-items:center;justify-content:center;text-align:center}</style></head><body><div>Test Label<br/>Nexpura</div></body></html>`
      : `<html><head><title>Test Page</title></head><body><h1>Nexpura — Test Print</h1><p>${new Date().toLocaleString("en-AU")}</p></body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(content); w.document.close(); w.print(); }
  }

  const tabClass = (tab: PrinterType) =>
    `px-5 py-3 text-sm font-medium transition-colors ${
      activeTab === tab
        ? "border-b-2 border-[#8B7355] text-[#8B7355]"
        : "text-stone-500 hover:text-stone-900"
    }`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Printing Settings</h1>
        <p className="text-stone-500 mt-1 text-sm">Configure your printers for receipts, labels, and office documents.</p>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">{msg}</div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-200">
          <button className={tabClass("receipt")} onClick={() => setActiveTab("receipt")}>Receipt Printer</button>
          <button className={tabClass("label")} onClick={() => setActiveTab("label")}>Label Printer</button>
          <button className={tabClass("office")} onClick={() => setActiveTab("office")}>Office Printer</button>
        </div>

        <div className="p-6 space-y-4">
          {activeTab === "receipt" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Brand</label>
                  <select value={receiptBrand} onChange={(e) => setReceiptBrand(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm">
                    <option value="Epson">Epson</option>
                    <option value="Star">Star</option>
                    <option value="Bixolon">Bixolon</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Paper Width</label>
                  <select value={receiptPaperWidth} onChange={(e) => setReceiptPaperWidth(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm">
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Connection</label>
                  <select value={receiptConn} onChange={(e) => setReceiptConn(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm">
                    <option value="browser">Browser Print</option>
                    <option value="network">Network (IP)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => setReceiptCut(!receiptCut)}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${receiptCut ? "bg-[#8B7355]" : "bg-stone-200"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${receiptCut ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-sm">Auto-cut</span>
                </div>
              </div>
              {receiptConn === "network" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">IP Address</label>
                    <input value={receiptIp} onChange={(e) => setReceiptIp(e.target.value)} placeholder="192.168.1.100" className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Port</label>
                    <input value={receiptPort} onChange={(e) => setReceiptPort(e.target.value)} placeholder="9100" className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm font-mono" />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleSaveReceipt} disabled={isPending} className="flex-1 py-2.5 bg-[#8B7355] text-white rounded-xl text-sm font-medium hover:bg-[#7a6447] disabled:opacity-50">Save</button>
                <button onClick={() => handleTestPrint("receipt")} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">Test Print</button>
              </div>
            </>
          )}

          {activeTab === "label" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Brand</label>
                  <select value={labelBrand} onChange={(e) => setLabelBrand(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm">
                    <option value="Zebra">Zebra</option>
                    <option value="TSC">TSC</option>
                    <option value="Brother">Brother</option>
                    <option value="DYMO">DYMO</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Connection</label>
                  <select value={labelConn} onChange={(e) => setLabelConn(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm">
                    <option value="browser">Browser Print</option>
                    <option value="network">Network (ZPL)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Label Width (mm)</label>
                  <input type="number" value={labelWidth} onChange={(e) => setLabelWidth(e.target.value)} placeholder="57" className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Label Height (mm)</label>
                  <input type="number" value={labelHeight} onChange={(e) => setLabelHeight(e.target.value)} placeholder="32" className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              {labelConn === "network" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">IP Address</label>
                    <input value={labelIp} onChange={(e) => setLabelIp(e.target.value)} placeholder="192.168.1.101" className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Port</label>
                    <input value={labelPort} onChange={(e) => setLabelPort(e.target.value)} placeholder="9100" className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm font-mono" />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleSaveLabel} disabled={isPending} className="flex-1 py-2.5 bg-[#8B7355] text-white rounded-xl text-sm font-medium hover:bg-[#7a6447] disabled:opacity-50">Save</button>
                <button onClick={() => handleTestPrint("label")} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">Test Print</button>
              </div>
            </>
          )}

          {activeTab === "office" && (
            <>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Paper Size</label>
                <select value={officePaperSize} onChange={(e) => setOfficePaperSize(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm">
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <p className="text-xs text-stone-400">Office printer uses browser print — no network connection required.</p>
              <div className="flex gap-3">
                <button onClick={handleSaveOffice} disabled={isPending} className="flex-1 py-2.5 bg-[#8B7355] text-white rounded-xl text-sm font-medium hover:bg-[#7a6447] disabled:opacity-50">Save</button>
                <button onClick={() => handleTestPrint("office")} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">Test Print</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
