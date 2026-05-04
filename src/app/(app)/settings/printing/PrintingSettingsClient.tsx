"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  PrinterIcon,
  TagIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
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
<style>body { font-family: Georgia, 'Times New Roman', serif; padding: 48px; color: #1c1917; } h1 { font-weight: 400; letter-spacing: -0.02em; } .eyebrow { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #78716c; } hr { border: none; border-top: 1px solid #e7e5e4; margin: 24px 0; }</style></head><body>
<p class="eyebrow">Nexpura</p>
<h1>Test Print &mdash; ${oPaperSize}</h1>
<p>This is a test print for your office printer.</p>
<p style="color:#78716c">${new Date().toLocaleString("en-AU")}</p>
<hr />
<p>If you can read this clearly, your office printer is configured correctly.</p>
</body></html>`);
    }
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const tabClass = (t: PrinterType) =>
    `relative flex-1 inline-flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
      activeTab === t
        ? "text-stone-900"
        : "text-stone-500 hover:text-stone-800"
    }`;

  const tabIndicator = (t: PrinterType) =>
    `absolute inset-x-4 -bottom-px h-px transition-colors duration-300 ${
      activeTab === t ? "bg-nexpura-bronze" : "bg-transparent"
    }`;

  const input =
    "w-full border border-stone-200 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/20 focus:border-nexpura-bronze transition-colors duration-200";
  const labelCls = "block text-[11px] uppercase tracking-luxury text-stone-500 mb-2";

  // Subtle pill button (used for presets, alignment, paper sizes)
  const pillBtn = (active: boolean) =>
    `px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
      active
        ? "bg-stone-900 text-white border-stone-900"
        : "bg-white text-stone-600 border-stone-200 hover:border-nexpura-bronze/60 hover:text-stone-900"
    }`;

  // Label preview dimensions (scaled to pixels, max 300px wide)
  const previewScale = Math.min(300 / (parseInt(lWidth) || 57), 6);
  const previewW = (parseInt(lWidth) || 57) * previewScale;
  const previewH = (parseInt(lHeight) || 32) * previewScale;

  const tabs: { key: PrinterType; label: string; Icon: typeof PrinterIcon; href: string }[] = [
    { key: "receipt", label: "Receipt", Icon: PrinterIcon, href: pathname },
    { key: "label", label: "Label", Icon: TagIcon, href: pathname + '?tab=label' },
    { key: "office", label: "Office", Icon: DocumentTextIcon, href: pathname + '?tab=office' },
  ];

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-14">
          <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
            Settings
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.08] tracking-tight">
            Printing
          </h1>
          <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
            Configure receipt, label, and office printers — set templates, paper sizes, and connection details for every device on your floor.
          </p>
        </div>

        {/* Status message */}
        {msg && (
          <div
            role="alert"
            className={`mb-8 border-l-2 pl-4 py-1 text-sm leading-relaxed flex items-start gap-2 ${
              msgType === "success"
                ? "border-nexpura-bronze text-stone-700"
                : "border-red-400 text-red-600"
            }`}
          >
            {msgType === "success" ? (
              <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5 text-nexpura-bronze" />
            ) : (
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{msg}</span>
          </div>
        )}

        <div className="space-y-8 lg:space-y-12">
          {/* Tabs */}
          <nav
            aria-label="Printer type"
            className="flex border-b border-stone-200"
          >
            {tabs.map(({ key, label, Icon, href }) => (
              <button
                key={key}
                className={tabClass(key)}
                onClick={() => router.replace(href)}
              >
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                {label}
                <span className={tabIndicator(key)} aria-hidden="true" />
              </button>
            ))}
          </nav>

          {/* ── RECEIPT TAB ─────────────────────────────── */}
          {activeTab === "receipt" && (
            <>
              <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Receipt Printer
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                    Hardware & Paper
                  </h2>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Choose your printer brand, connection method, and paper width.
                  </p>
                </div>

                <div className="border-t border-stone-200 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelCls}>Printer Brand</label>
                    <select value={rBrand} onChange={(e) => setRBrand(e.target.value)} className={input}>
                      <option value="Epson">Epson TM Series</option>
                      <option value="Star">Star TSP Series</option>
                      <option value="Bixolon">Bixolon SRP Series</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Paper Width</label>
                    <select value={rPaperWidth} onChange={(e) => setRPaperWidth(e.target.value)} className={input}>
                      <option value="58mm">58mm</option>
                      <option value="80mm">80mm</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Connection Type</label>
                    <select value={rConn} onChange={(e) => setRConn(e.target.value)} className={input}>
                      <option value="browser">Browser Print (USB)</option>
                      <option value="network">Network (IP/TCP)</option>
                      <option value="bluetooth">Bluetooth</option>
                    </select>
                  </div>
                  <div className="flex items-center sm:pt-7 gap-3">
                    <button
                      type="button"
                      onClick={() => setRCut(!rCut)}
                      role="switch"
                      aria-checked={rCut}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 ${rCut ? "bg-nexpura-bronze" : "bg-stone-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${rCut ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <span className="text-sm text-stone-700">Auto-cut after print</span>
                  </div>
                </div>

                {rConn === "network" && (
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-stone-50/70 rounded-xl p-5 border border-stone-200">
                    <div>
                      <label className={labelCls}>IP Address</label>
                      <input value={rIp} onChange={(e) => setRIp(e.target.value)} placeholder="192.168.1.100" className={`${input} font-mono`} />
                    </div>
                    <div>
                      <label className={labelCls}>Port</label>
                      <input value={rPort} onChange={(e) => setRPort(e.target.value)} placeholder="9100" className={`${input} font-mono`} />
                    </div>
                  </div>
                )}
              </section>

              {/* Receipt Preview */}
              <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Preview
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                    Receipt Sample
                  </h2>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    A scaled rendering of how your printed receipt will look on the selected paper width.
                  </p>
                </div>

                <div className="border-t border-stone-200 pt-8 flex justify-center">
                  <div style={{ width: rPaperWidth === "58mm" ? 220 : 280 }} className="border border-stone-200 rounded p-4 font-mono text-xs bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                    <p className="text-center font-bold text-sm mb-1">{businessName}</p>
                    <p className="text-center text-xs text-stone-500">123 Jewellery Lane, Sydney NSW</p>
                    <div className="border-t border-dashed border-stone-300 my-2" />
                    <div className="flex justify-between"><span>Diamond Ring</span><span>$8,500</span></div>
                    <div className="border-t border-dashed border-stone-300 my-2" />
                    <div className="flex justify-between font-bold"><span>TOTAL</span><span>$8,500</span></div>
                    <p className="text-center text-xs text-stone-400 mt-3">Thank you!</p>
                  </div>
                </div>

                <div className="mt-8 border-t border-stone-200 pt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSaveReceipt}
                    disabled={isPending}
                    className="nx-btn-primary inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save Receipt Printer"
                    )}
                  </button>
                  <button
                    onClick={() => testPrint("receipt")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200"
                  >
                    <PlayIcon className="w-4 h-4" />
                    Test Print
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ── LABEL TAB ───────────────────────────────── */}
          {activeTab === "label" && (
            <>
              <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Label Printer
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                    Hardware
                  </h2>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Select the printer brand and how your computer connects to it.
                  </p>
                </div>

                <div className="border-t border-stone-200 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelCls}>Printer Brand</label>
                    <select value={lBrand} onChange={(e) => setLBrand(e.target.value)} className={input}>
                      <option value="Zebra">Zebra</option>
                      <option value="Brother">Brother</option>
                      <option value="Dymo">Dymo</option>
                      <option value="Niimbot">Niimbot</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Connection Type</label>
                    <select value={lConn} onChange={(e) => setLConn(e.target.value)} className={input}>
                      <option value="browser">Browser Print (USB)</option>
                      <option value="network">Network (IP/TCP)</option>
                      <option value="bluetooth">Bluetooth</option>
                    </select>
                  </div>
                </div>

                {lConn === "network" && (
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-stone-50/70 rounded-xl p-5 border border-stone-200">
                    <div>
                      <label className={labelCls}>IP Address</label>
                      <input value={lIp} onChange={(e) => setLIp(e.target.value)} placeholder="192.168.1.101" className={`${input} font-mono`} />
                    </div>
                    <div>
                      <label className={labelCls}>Port</label>
                      <input value={lPort} onChange={(e) => setLPort(e.target.value)} placeholder="9100" className={`${input} font-mono`} />
                    </div>
                  </div>
                )}
              </section>

              <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Layout
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                    Size, Alignment & Barcode
                  </h2>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Configure label dimensions, content alignment, and barcode placement for jewellery tags.
                  </p>
                </div>

                <div className="border-t border-stone-200 pt-6 space-y-8">
                  {/* Label Size */}
                  <div>
                    <label className={labelCls}>Label Size</label>
                    <div className="flex flex-wrap gap-2">
                      {LABEL_SIZES.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => applyLabelPreset(s.label)}
                          className={pillBtn(lSizePreset === s.label)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    {lSizePreset === "Custom" && (
                      <div className="grid grid-cols-2 gap-3 mt-4 max-w-md">
                        <div>
                          <label className={labelCls}>Width (mm)</label>
                          <input value={lWidth} onChange={(e) => setLWidth(e.target.value)} type="number" min="10" max="200" className={`${input} font-mono`} />
                        </div>
                        <div>
                          <label className={labelCls}>Height (mm)</label>
                          <input value={lHeight} onChange={(e) => setLHeight(e.target.value)} type="number" min="5" max="200" className={`${input} font-mono`} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Label Alignment */}
                  <div>
                    <label className={labelCls}>Content Alignment</label>
                    <div className="inline-flex rounded-full border border-stone-200 bg-white p-0.5">
                      {["left", "center", "right"].map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setLAlignment(a)}
                          className={`px-5 py-1.5 rounded-full text-xs font-medium capitalize transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/30 ${
                            lAlignment === a
                              ? "bg-stone-900 text-white"
                              : "text-stone-600 hover:text-stone-900"
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Barcode Position */}
                  <div>
                    <label className={labelCls}>Barcode / QR Position</label>
                    <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
                      {[
                        { v: "top", h: "left" }, { v: "top", h: "center" }, { v: "top", h: "right" },
                        { v: "bottom", h: "left" }, { v: "bottom", h: "center" }, { v: "bottom", h: "right" }
                      ].map(pos => {
                        const active = lBarcodeV === pos.v && lBarcodeH === pos.h;
                        return (
                          <button
                            key={`${pos.v}-${pos.h}`}
                            type="button"
                            onClick={() => { setLBarcodeV(pos.v); setLBarcodeH(pos.h); }}
                            aria-label={`${pos.v} ${pos.h}`}
                            className={`aspect-[4/3] rounded-lg border transition-all duration-200 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/30 focus-visible:ring-offset-2 ${
                              active
                                ? "border-nexpura-bronze bg-nexpura-bronze/[0.04]"
                                : "border-stone-200 hover:border-stone-300 bg-white"
                            }`}
                          >
                            <div
                              className={`w-5 h-1.5 rounded-sm transition-colors ${
                                active ? "bg-nexpura-bronze" : "bg-stone-300"
                              }`}
                              style={{
                                alignSelf: pos.v === "top" ? "flex-start" : "flex-end",
                                marginLeft: pos.h === "left" ? 0 : pos.h === "center" ? "auto" : "auto",
                                marginRight: pos.h === "right" ? 0 : pos.h === "center" ? "auto" : "auto",
                                margin: `${pos.v === "top" ? "8px" : "auto"} ${pos.h === "right" ? "8px" : pos.h === "center" ? "auto" : "auto"} ${pos.v === "bottom" ? "8px" : "auto"} ${pos.h === "left" ? "8px" : pos.h === "center" ? "auto" : "auto"}`,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Label Preview */}
              <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Preview
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                    Label Sample
                  </h2>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    A scaled rendering at {lWidth}×{lHeight}mm with your alignment and barcode position.
                  </p>
                </div>

                <div className="border-t border-stone-200 pt-8 flex justify-center bg-stone-50/60 -mx-6 lg:-mx-8 px-6 lg:px-8 py-10">
                  <div
                    style={{ width: previewW, height: previewH, textAlign: lAlignment as "left" | "center" | "right" }}
                    className="bg-white border border-stone-300 rounded relative overflow-hidden flex flex-col justify-between p-1 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
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

                <div className="mt-8 border-t border-stone-200 pt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSaveLabel}
                    disabled={isPending}
                    className="nx-btn-primary inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save Label Printer"
                    )}
                  </button>
                  <button
                    onClick={() => testPrint("label")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200"
                  >
                    <PlayIcon className="w-4 h-4" />
                    Test Label
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ── OFFICE TAB ──────────────────────────────── */}
          {activeTab === "office" && (
            <>
              <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Office Printer
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                    Documents & Paper Size
                  </h2>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    Set the default paper size for invoices, appraisals, and repair tickets.
                  </p>
                </div>

                <div className="border-t border-stone-200 pt-6">
                  <label className={labelCls}>Paper Size</label>
                  <div className="flex gap-2 flex-wrap">
                    {["A4", "A5", "Letter", "Legal"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setOPaperSize(s)}
                        className={pillBtn(oPaperSize === s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <p className="text-sm text-stone-500 mt-6 leading-relaxed max-w-2xl">
                    Office documents (invoices, appraisals, repair tickets) print via your browser&apos;s built-in print dialog. Make sure your office printer is set as the default in your operating system.
                  </p>
                </div>
              </section>

              {/* Document Preview */}
              <section className="bg-white border border-stone-200 rounded-2xl p-6 lg:p-8 transition-all duration-400 hover:border-stone-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                    Preview
                  </p>
                  <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                    Document Sample
                  </h2>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                    A schematic of how your invoices will be laid out on {oPaperSize}.
                  </p>
                </div>

                <div className="border-t border-stone-200 pt-8 flex justify-center bg-stone-50/60 -mx-6 lg:-mx-8 px-6 lg:px-8 py-10">
                  <div className="w-48 h-64 border border-stone-200 rounded bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="w-16 h-3 bg-nexpura-bronze/80 rounded-sm" />
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
                    <div className="border-t border-stone-300 mt-auto pt-1.5 flex justify-between">
                      <div className="w-10 h-2 bg-stone-200 rounded" />
                      <div className="w-12 h-2 bg-stone-700 rounded" />
                    </div>
                    <div className="text-center text-[7px] tracking-luxury uppercase text-stone-300">{oPaperSize}</div>
                  </div>
                </div>

                <div className="mt-8 border-t border-stone-200 pt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSaveOffice}
                    disabled={isPending}
                    className="nx-btn-primary inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save Office Printer"
                    )}
                  </button>
                  <button
                    onClick={() => testPrint("office")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-bronze/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200"
                  >
                    <PlayIcon className="w-4 h-4" />
                    Test Print
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default function PrintingSettingsClient(props: Parameters<typeof PrintingSettingsClientInner>[0]) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <PrintingSettingsClientInner {...props} />
    </Suspense>
  );
}
