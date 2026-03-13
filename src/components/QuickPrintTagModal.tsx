"use client";

import { useState } from "react";
import { generateZpl, downloadZpl, type ZplTagItem, type TagSize } from "@/lib/zpl/generateStockTag";
import { X, Download, Copy, Printer, Check } from "lucide-react";

interface Props {
  item: ZplTagItem & { id: string };
  tenantName: string;
  onClose: () => void;
}

const SIZE_LABELS: Record<TagSize, string> = {
  "38x25": "38 × 25 mm (standard jewellery)",
  "50x25": "50 × 25 mm (wide)",
  "50x30": "50 × 30 mm (large)",
};

export default function QuickPrintTagModal({ item, tenantName, onClose }: Props) {
  const [size, setSize] = useState<TagSize>("38x25");
  const [copied, setCopied] = useState(false);

  const zpl = generateZpl(item, size, tenantName);

  function handleCopy() {
    navigator.clipboard.writeText(zpl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const filename = `tag-${(item.sku || item.name).replace(/\s/g, "-").toLowerCase()}.zpl`;
    downloadZpl(zpl, filename);
  }

  function handleBrowserPrint() {
    const price = item.retail_price != null
      ? "$" + item.retail_price.toLocaleString("en-AU", { minimumFractionDigits: 2 })
      : "";
    const details = [item.metal_type, item.stone_type].filter(Boolean).join(" / ");
    const weight = item.metal_weight_grams ? `${item.metal_weight_grams}g` : "";

    // Size in mm → px for print preview
    const sizeMap: Record<TagSize, { w: number; h: number }> = {
      "38x25": { w: 143, h: 94 },
      "50x25": { w: 189, h: 94 },
      "50x30": { w: 189, h: 113 },
    };
    const { w, h } = sizeMap[size];

    const win = window.open("", "_blank", "width=400,height=400");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Print Stock Tag</title>
      <style>
        @page { margin: 0; size: ${w}px ${h}px; }
        body { margin: 0; padding: 0; font-family: 'Arial Narrow', Arial, sans-serif; }
        .tag {
          width: ${w}px; height: ${h}px; border: 1px solid #000;
          padding: 4px 5px; box-sizing: border-box; overflow: hidden;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .name { font-size: 9pt; font-weight: bold; line-height: 1.2; }
        .sku  { font-size: 7pt; color: #333; margin-top: 1px; }
        .meta { font-size: 7pt; color: #333; }
        .price { font-size: 11pt; font-weight: bold; text-align: right; margin-top: -12px; }
        hr { border: none; border-top: 1px solid #000; margin: 3px 0; }
        .barcode-area { text-align: center; }
        .barcode-txt { font-size: 6pt; letter-spacing: 0.05em; color: #333; }
        .store { font-size: 6pt; text-align: right; color: #555; }
        @media print {
          body { background: white; }
        }
      </style>
      </head><body>
      <div class="tag">
        <div>
          <div class="name">${item.name}</div>
          ${item.sku ? `<div class="sku">SKU: ${item.sku}</div>` : ""}
          <div class="meta">${[details, weight].filter(Boolean).join("  ")}</div>
          ${price ? `<div class="price">${price}</div>` : ""}
        </div>
        <div>
          <hr/>
          <div class="barcode-area">
            <div class="barcode-txt">${item.barcode_value || item.sku || item.name.substring(0, 16)}</div>
          </div>
          <div class="store">${tenantName}</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); window.close(); }</script>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-md p-6 animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-stone-900">Print Stock Tag</h3>
            <p className="text-xs text-stone-400 mt-0.5 truncate max-w-[260px]">{item.name}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900 transition-colors p-1 rounded-md hover:bg-stone-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Size selector */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Label Size</label>
          <div className="space-y-2">
            {(Object.entries(SIZE_LABELS) as [TagSize, string][]).map(([val, label]) => (
              <label key={val} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${size === val ? "border-[#8B7355] bg-[#8B7355]/5" : "border-stone-200 hover:border-stone-300"}`}>
                <input type="radio" name="size" value={val} checked={size === val} onChange={() => setSize(val)} className="accent-[#8B7355]" />
                <span className="text-sm text-stone-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview of ZPL snippet */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">ZPL Preview</label>
          <pre className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-[10px] text-stone-600 overflow-auto max-h-32 font-mono leading-relaxed">{zpl}</pre>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleCopy}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-stone-200 hover:border-[#8B7355] hover:bg-[#8B7355]/5 transition-colors text-stone-600 hover:text-[#8B7355]"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="text-xs font-medium">{copied ? "Copied!" : "Copy ZPL"}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-stone-200 hover:border-[#8B7355] hover:bg-[#8B7355]/5 transition-colors text-stone-600 hover:text-[#8B7355]"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-medium">Download .zpl</span>
          </button>

          <button
            onClick={handleBrowserPrint}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-stone-200 hover:border-[#8B7355] hover:bg-[#8B7355]/5 transition-colors text-stone-600 hover:text-[#8B7355]"
          >
            <Printer className="w-4 h-4" />
            <span className="text-xs font-medium">Print Preview</span>
          </button>
        </div>

        <p className="text-[10px] text-stone-400 text-center mt-3">
          Send the .zpl file or copy ZPL directly to your Zebra ZD printer via USB / network
        </p>
      </div>
    </div>
  );
}
