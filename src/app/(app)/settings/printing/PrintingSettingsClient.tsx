"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { savePrinterConfig } from "./actions";

type PrinterType = "receipt" | "label" | "office";

const LABEL_SIZES = [
  { label: "25×10mm", width: 25, height: 10 },
  { label: "38×19mm", width: 38, height: 19 },
  { label: "50×25mm", width: 50, height: 25 },
  { label: "57×32mm", width: 57, height: 32 },
  { label: "62×29mm", width: 62, height: 29 },
  { label: "100×50mm", width: 100, height: 50 },
  { label: "Custom", width: 0, height: 0 },
];

interface PrinterConfig {
  printer_type?: string;
  brand?: string;
  connection_type?: string;
  ip_address?: string | null;
  port?: number | null;
  paper_width?: string;
  label_width_mm?: number;
  label_height_mm?: number;
  cut_enabled?: boolean;
  paper_size?: string;
  barcode_position_h?: string;
  barcode_position_v?: string;
  label_alignment?: string;
  [key: string]: unknown;
}

interface Props {
  tenantId: string;
  configs: Record<string, PrinterConfig>;
  businessName?: string;
}

function PrintingSettingsClientInner({ tenantId, configs, businessName = "Your Store" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') || 'receipt') as PrinterType;
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  // ── Receipt state ─────────────────────────────────────────────
  const rCfg = configs["receipt"] ?? {};
  const [rBrand, setRBrand] = useState((rCfg.brand as string) ?? "Epson");
  const [rConn, setRConn] = useState((rCfg.connection_type as string) ?? "browser");
  const [rIp, setRIp] = useState((rCfg.ip_address as string) ?? "");
  const [rPort, setRPort] = useState((rCfg.port as number)?.toString() ?? "9100");
  const [rPaperWidth, setRPaperWidth] = useState((rCfg.paper_width as string) ?? "80mm");
  const [rCut, setRCut] = useState((rCfg.cut_enabled as boolean) ?? true);

  // ── Label state ────────────────────────────────────────────────
  const lCfg = configs["label"] ?? {};
  const [lBrand, setLBrand] = useState((lCfg.brand as string) ?? "Zebra");
  const [lConn, setLConn] = useState((lCfg.connection_type as string) ?? "browser");
  const [lIp, setLIp] = useState((lCfg.ip_address as string) ?? "");
  const [lPort, setLPort] = useState((lCfg.port as number)?.toString() ?? "9100");
  const [lWidth, setLWidth] = useState((lCfg.label_width_mm as number)?.toString() ?? "57");
  const [lHeight, setLHeight] = useState((lCfg.label_height_mm as number)?.toString() ?? "32");
  const [lSizePreset, setLSizePreset] = useState("57×32mm");
  const [lAlignment, setLAlignment] = useState((lCfg.label_alignment as string) ?? "center");
  const [lBarcodeH, setLBarcodeH] = useState((lCfg.barcode_position_h as string) ?? "left");
  const [lBarcodeV, setLBarcodeV] = useState((lCfg.barcode_position_v as string) ?? "bottom");

  // ── Office state ───────────────────────────────────────────────
  const oCfg = configs["office"] ?? {};
  const [oPaperSize, setOPaperSize] = useState((oCfg.paper_size as string) ?? "A4");

  function showMsg(text: string, type: "success" | "error" = "success") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(null), 3000);
  }

  function applyLabelPreset(label: string) {
    setLSizePreset(label);
    const preset = LABEL_SIZES.find((s) => s.label === label);
    if (preset && preset.width > 0) {
      setLWidth(String(preset.width));
      setLHeight(String(preset.height));
    }
  }

  function handleSaveReceipt() {
    startTransition(async () => {
      const r = await savePrinterConfig(tenantId, {
        printer_type: "receipt",
        brand: rBrand,
        connection_type: rConn,
        ip_address: rIp || null,
        port: rPort ? parseInt(rPort) : null,
        paper_width: rPaperWidth,
        cut_enabled: rCut,
      });
      if (r.error) showMsg(`Error: ${r.error}`, "error");
      else showMsg("Receipt printer saved!");
    });
  }

  function handleSaveLabel() {
    startTransition(async () => {
      const r = await savePrinterConfig(tenantId, {
        printer_type: "label",
        brand: lBrand,
        connection_type: lConn,
        ip_address: lIp || null,
        port: lPort ? parseInt(lPort) : null,
        label_width_mm: parseInt(lWidth) || 57,
        label_height_mm: parseInt(lHeight) || 32,
        label_alignment: lAlignment,
        barcode_position_h: lBarcodeH,
        barcode_position_v: lBarcodeV,
      });
      if (r.error) showMsg(`Error: ${r.error}`, "error");
      else showMsg("Label printer saved!");
    });
  }

  function handleSaveOffice() {
    startTransition(async () => {
      const r = await savePrinterConfig(tenantId, {
        printer_type: "office",
        connection_type: "browser",
        paper_size: oPaperSize,
      });
      if (r.error) showMsg(`Error: ${r.error}`, "error");
      else showMsg("Office printer saved!");
    });
  }

  function testPrint(type: PrinterType) {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    if (type === "receipt") {
      w.document.write(`<!DOCTYPE html><html><head><title>Test Receipt</title>
<style>
  @page { margin: 0 }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: ${rPaperWidth}; margin: 0 auto; padding: 16px 8px; }
  h2 { text-align: center; font-size: 14px; margin: 0 0 4px; }
  p { margin: 2px 0; }
  .center { text-align: center; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; }
</style></head><body>
<h2>${businessName}</h2>
<p class="center">123 Jewellery Lane</p>
<p class="center">Sydney NSW 2000</p>
<div class="divider"></div>
<p class="center">TEST RECEIPT</p>
<p class="center">${new Date().toLocaleString("en-AU")}</p>
<div class="divider"></div>
<div class="row"><span>Diamond Ring</span><span>$8,500.00</span></div>
<div class="row"><span>GST (10%)</span><span>$850.00</span></div>
<div class="divider"></div>
<div class="row"><span><strong>TOTAL</strong></span><span><strong>$8,500.00</strong></span></div>
<div class="divider"></div>
<p class="center">Thank you for your purchase!</p>
</body></html>`);
    } else if (type === "label") {
      const w_mm = parseInt(lWidth) || 57;
      const h_mm = parseInt(lHeight) || 32;
      const barcodeLeft = lBarcodeH === "left" ? "0" : lBarcodeH === "right" ? "auto" : "50%";
      const barcodeRight = lBarcodeH === "right" ? "0" : "auto";
      const barcodeTransform = lBarcodeH === "center" ? "translateX(-50%)" : "none";
      w.document.write(`<!DOCTYPE html><html><head><title>Test Label</title>
<style>
  @page { margin: 0; size: ${w_mm}mm ${h_mm}mm; }
  body { margin: 0; width: ${w_mm}mm; height: ${h_mm}mm; overflow: hidden; font-family: 'Courier New', monospace; font-size: 9px; text-align: ${lAlignment}; position: relative; box-sizing: border-box; padding: 2mm; display: flex; flex-direction: column; justify-content: space-between; }
  .name { font-size: 11px; font-weight: bold; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .price { font-size: 13px; font-weight: bold; }
  .barcode-area { position: ${lBarcodeV === "top" ? "absolute; top: 0" : "relative"}; left: ${barcodeLeft}; right: ${barcodeRight}; transform: ${barcodeTransform}; font-size: 7px; letter-spacing: 4px; background: #000; color: #000; padding: 2px; }
  .sku { font-size: 7px; color: #444; }
</style></head><body>
<div class="name">Diamond Solitaire Ring</div>
<div class="sku">SKU: NX-RNG-001</div>
<div class="price">$8,500.00</div>
<div class="barcode-area">
  <div style="font-size:24px;letter-spacing:2px;color:#000">| || | || ||</div>
  <div style="font-size:7px;text-align:center;color:#000">NX-RNG-001</div>
</div>
</body></html>`);
    } else {
      w.document.write(`<!DOCTYPE html><html><head><title>Test Page</title>
<style>body { font-family: Arial, sans-serif; padding: 40px; }</style></head><body>
<h1 style="color:amber-700">Nexpura</h1>
<h2>Test Print — ${oPaperSize}</h2>
<p>This is a test print for your office printer.</p>
<p>${new Date().toLocaleString("en-AU")}</p>
<hr />
<p>If you can read this clearly, your office printer is configured correctly.</p>
</body></html>`);
    }
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const tabClass = (t: PrinterType) =>
    `flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
      activeTab === t ? "border-amber-600 text-amber-700" : "border-transparent text-stone-500 hover:text-stone-800"
    }`;

  const input = "w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600";
  const label = "block text-xs font-medium text-stone-500 mb-1";

  // Label preview dimensions (scaled to pixels, max 300px wide)
  const previewScale = Math.min(300 / (parseInt(lWidth) || 57), 6);
  const previewW = (parseInt(lWidth) || 57) * previewScale;
  const previewH = (parseInt(lHeight) || 32) * previewScale;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Printing Settings</h1>
        <p className="text-stone-500 mt-1 text-sm">Configure receipt, label, and office printers for your workspace.</p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${msgType === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          {msg}
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-stone-200">
          <button className={tabClass("receipt")} onClick={() => router.replace(pathname)}>
            🧾 Receipt Printer
          </button>
          <button className={tabClass("label")} onClick={() => router.replace(pathname + '?tab=label')}>
            🏷️ Label Printer
          </button>
          <button className={tabClass("office")} onClick={() => router.replace(pathname + '?tab=office')}>
            🖨️ Office Printer
          </button>
        </div>

        <div className="p-6">
          {/* ── RECEIPT TAB ─────────────────────────────── */}
          {activeTab === "receipt" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Printer Brand</label>
                  <select value={rBrand} onChange={(e) => setRBrand(e.target.value)} className={input}>
                    <option value="Epson">Epson TM Series</option>
                    <option value="Star">Star TSP Series</option>
                    <option value="Bixolon">Bixolon SRP Series</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Paper Width</label>
                  <select value={rPaperWidth} onChange={(e) => setRPaperWidth(e.target.value)} className={input}>
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Connection Type</label>
                  <select value={rConn} onChange={(e) => setRConn(e.target.value)} className={input}>
                    <option value="browser">Browser Print (USB)</option>
                    <option value="network">Network (IP/TCP)</option>
                    <option value="bluetooth">Bluetooth</option>
                  </select>
                </div>
                <div className="flex items-center pt-5 gap-3">
                  <button
                    type="button"
                    onClick={() => setRCut(!rCut)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${rCut ? "bg-amber-700" : "bg-stone-200"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rCut ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-sm text-stone-700">Auto-cut after print</span>
                </div>
              </div>

              {rConn === "network" && (
                <div className="grid grid-cols-2 gap-4 bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <div>
                    <label className={label}>IP Address</label>
                    <input value={rIp} onChange={(e) => setRIp(e.target.value)} placeholder="192.168.1.100" className={`${input} font-mono`} />
                  </div>
                  <div>
                    <label className={label}>Port</label>
                    <input value={rPort} onChange={(e) => setRPort(e.target.value)} placeholder="9100" className={`${input} font-mono`} />
                  </div>
                </div>
              )}

              {/* Receipt Preview */}
              <div>
                <p className="text-xs font-medium text-stone-500 mb-3 uppercase tracking-wider">Receipt Preview</p>
                <div className="flex justify-center">
                  <div style={{ width: rPaperWidth === "58mm" ? 220 : 280 }} className="border border-stone-300 rounded p-4 font-mono text-xs bg-white shadow-sm">
                    <p className="text-center font-bold text-sm mb-1">{businessName}</p>
                    <p className="text-center text-xs text-stone-500">123 Jewellery Lane, Sydney NSW</p>
                    <div className="border-t border-dashed border-stone-300 my-2" />
                    <div className="flex justify-between"><span>Diamond Ring</span><span>$8,500</span></div>
                    <div className="border-t border-dashed border-stone-300 my-2" />
                    <div className="flex justify-between font-bold"><span>TOTAL</span><span>$8,500</span></div>
                    <p className="text-center text-xs text-stone-400 mt-3">Thank you!</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveReceipt} disabled={isPending} className="flex-1 py-2.5 bg-amber-700 hover:bg-[#7a6447] text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                  {isPending ? "Saving…" : "Save Receipt Printer"}
                </button>
                <button onClick={() => testPrint("receipt")} className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors">
                  🖨️ Test Print
                </button>
              </div>
            </div>
          )}

          {/* ── LABEL TAB ───────────────────────────────── */}
          {activeTab === "label" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Printer Brand</label>
                  <select value={lBrand} onChange={(e) => setLBrand(e.target.value)} className={input}>
                    <option value="Zebra">Zebra</option>
                    <option value="Brother">Brother</option>
                    <option value="Dymo">Dymo</option>
                    <option value="Niimbot">Niimbot</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Connection Type</label>
                  <select value={lConn} onChange={(e) => setLConn(e.target.value)} className={input}>
                    <option value="browser">Browser Print (USB)</option>
                    <option value="network">Network (IP/TCP)</option>
                    <option value="bluetooth">Bluetooth</option>
                  </select>
                </div>
              </div>

              {/* Label Size Presets */}
              <div>
                <label className={label}>Label Size</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LABEL_SIZES.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => applyLabelPreset(s.label)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        lSizePreset === s.label
                          ? "bg-amber-700 text-white border-amber-600"
                          : "bg-white text-stone-600 border-stone-200 hover:border-amber-600"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {lSizePreset === "Custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label}>Width (mm)</label>
                      <input value={lWidth} onChange={(e) => setLWidth(e.target.value)} type="number" min="10" max="200" className={`${input} font-mono`} />
                    </div>
                    <div>
                      <label className={label}>Height (mm)</label>
                      <input value={lHeight} onChange={(e) => setLHeight(e.target.value)} type="number" min="5" max="200" className={`${input} font-mono`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Label Alignment */}
              <div>
                <label className={label}>Label Content Alignment</label>
                <div className="flex gap-2">
                  {["left", "center", "right"].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setLAlignment(a)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                        lAlignment === a
                          ? "bg-amber-700 text-white border-amber-600"
                          : "bg-white text-stone-600 border-stone-200 hover:border-amber-600"
                      }`}
                    >
                      {a === "left" ? "⬅️" : a === "center" ? "⬆️" : "➡️"} {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barcode Position */}
              <div>
                <label className={label}>Barcode / QR Position (3×2 Grid)</label>
                <div className="grid grid-cols-3 gap-1.5 w-full max-w-sm">
                  {[
                    { v: "top", h: "left" }, { v: "top", h: "center" }, { v: "top", h: "right" },
                    { v: "bottom", h: "left" }, { v: "bottom", h: "center" }, { v: "bottom", h: "right" }
                  ].map(pos => (
                    <button
                      key={`${pos.v}-${pos.h}`}
                      type="button"
                      onClick={() => { setLBarcodeV(pos.v); setLBarcodeH(pos.h); }}
                      className={`aspect-[4/3] rounded-xl border-2 transition-all flex items-center justify-center ${
                        lBarcodeV === pos.v && lBarcodeH === pos.h 
                          ? "border-amber-600 bg-amber-700/5 shadow-inner" 
                          : "border-stone-100 hover:border-stone-200 bg-white shadow-sm"
                      }`}
                    >
                      <div className={`w-4 h-2 rounded-sm ${
                        lBarcodeV === pos.v && lBarcodeH === pos.h ? "bg-amber-700" : "bg-stone-300"
                      }`} />
                    </button>
                  ))}
                </div>
              </div>

              {lConn === "network" && (
                <div className="grid grid-cols-2 gap-4 bg-stone-50 rounded-xl p-4 border border-stone-200">
                  <div>
                    <label className={label}>IP Address</label>
                    <input value={lIp} onChange={(e) => setLIp(e.target.value)} placeholder="192.168.1.101" className={`${input} font-mono`} />
                  </div>
                  <div>
                    <label className={label}>Port</label>
                    <input value={lPort} onChange={(e) => setLPort(e.target.value)} placeholder="9100" className={`${input} font-mono`} />
                  </div>
                </div>
              )}

              {/* Label Preview */}
              <div>
                <p className="text-xs font-medium text-stone-500 mb-3 uppercase tracking-wider">Label Preview ({lWidth}×{lHeight}mm)</p>
                <div className="flex justify-center bg-stone-50 rounded-xl p-6 border border-stone-200">
                  <div
                    style={{ width: previewW, height: previewH, textAlign: lAlignment as "left" | "center" | "right" }}
                    className="bg-white border-2 border-stone-400 rounded relative overflow-hidden flex flex-col justify-between p-1 shadow-md"
                  >
                    <div style={{ fontSize: Math.max(7, previewScale * 2) }} className="font-bold truncate">Diamond Ring</div>
                    <div style={{ fontSize: Math.max(5, previewScale * 1.5) }} className="text-stone-400">NX-RNG-001</div>
                    <div
                      style={{
                        fontSize: Math.max(8, previewScale * 2.5),
                        textAlign: lBarcodeH as "left" | "center" | "right",
                        alignSelf: lBarcodeH === "left" ? "flex-start" : lBarcodeH === "right" ? "flex-end" : "center",
                        marginTop: lBarcodeV === "top" ? 0 : "auto",
                      }}
                      className="font-bold"
                    >
                      $8,500
                    </div>
                    <div
                      style={{
                        fontSize: Math.max(4, previewScale * 0.8),
                        letterSpacing: "2px",
                        textAlign: lBarcodeH as "left" | "center" | "right",
                        color: "#000",
                        order: lBarcodeV === "top" ? -1 : 1,
                      }}
                    >
                      ║║║ ║║ ║║║
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveLabel} disabled={isPending} className="flex-1 py-2.5 bg-amber-700 hover:bg-[#7a6447] text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                  {isPending ? "Saving…" : "Save Label Printer"}
                </button>
                <button onClick={() => testPrint("label")} className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors">
                  🖨️ Test Label
                </button>
              </div>
            </div>
          )}

          {/* ── OFFICE TAB ──────────────────────────────── */}
          {activeTab === "office" && (
            <div className="space-y-6">
              <div>
                <label className={label}>Paper Size</label>
                <div className="flex gap-2 flex-wrap">
                  {["A4", "A5", "Letter", "Legal"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOPaperSize(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        oPaperSize === s ? "bg-amber-700 text-white border-amber-600" : "bg-white text-stone-600 border-stone-200 hover:border-amber-600"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Note</p>
                <p className="text-sm text-stone-600">Office documents (invoices, appraisals, repair tickets) print via your browser&apos;s built-in print dialog. Make sure your office printer is set as the default in your OS settings.</p>
              </div>

              {/* A4 Document Preview */}
              <div>
                <p className="text-xs font-medium text-stone-500 mb-3 uppercase tracking-wider">Document Preview</p>
                <div className="flex justify-center">
                  <div className="w-48 h-64 border border-stone-300 rounded bg-white shadow-sm p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="w-16 h-3 bg-amber-700 rounded" />
                        <div className="w-10 h-1.5 bg-stone-200 rounded mt-1" />
                      </div>
                      <div className="text-right">
                        <div className="w-12 h-1.5 bg-stone-100 rounded" />
                        <div className="w-16 h-1.5 bg-stone-100 rounded mt-1" />
                      </div>
                    </div>
                    <div className="border-t border-stone-200 pt-2 space-y-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex justify-between">
                          <div className="w-20 h-1.5 bg-stone-100 rounded" />
                          <div className="w-8 h-1.5 bg-stone-100 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="border-t-2 border-stone-300 mt-auto pt-1 flex justify-between">
                      <div className="w-10 h-2 bg-stone-200 rounded" />
                      <div className="w-12 h-2 bg-stone-600 rounded" />
                    </div>
                    <div className="text-center text-[6px] text-stone-300">{oPaperSize} Document</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveOffice} disabled={isPending} className="flex-1 py-2.5 bg-amber-700 hover:bg-[#7a6447] text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                  {isPending ? "Saving…" : "Save Office Printer"}
                </button>
                <button onClick={() => testPrint("office")} className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors">
                  🖨️ Test Print
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

 Claude is active in this tab group  
Open chat
 
Dismiss

export default function PrintingSettingsClient(props: Parameters<typeof PrintingSettingsClientInner>[0]) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <PrintingSettingsClientInner {...props} />
    </Suspense>
  );
}
