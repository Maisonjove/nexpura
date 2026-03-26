"use client";

import { useState, useRef, useEffect } from "react";
import { X, Printer, Download, Settings2 } from "lucide-react";

interface BarcodePrintPreviewProps {
  item: {
    id: string;
    name: string;
    sku: string | null;
    retail_price: number | null;
    barcode?: string | null;
  };
  onClose: () => void;
  onPrint: (format: "standard" | "zpl", size: "small" | "medium" | "large") => void;
}

type LabelSize = "small" | "medium" | "large";

const LABEL_SIZES: Record<LabelSize, { width: number; height: number; label: string }> = {
  small: { width: 150, height: 50, label: "Small (30mm x 12mm)" },
  medium: { width: 200, height: 80, label: "Medium (50mm x 25mm)" },
  large: { width: 300, height: 120, label: "Large (75mm x 30mm)" },
};

export default function BarcodePrintPreview({ item, onClose, onPrint }: BarcodePrintPreviewProps) {
  const [format, setFormat] = useState<"standard" | "zpl">("standard");
  const [size, setSize] = useState<LabelSize>("medium");
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string | null>(null);
  const [zplCode, setZplCode] = useState<string>("");

  const barcodeValue = item.barcode || item.sku || item.id.slice(0, 12).toUpperCase();

  // Generate barcode on canvas
  useEffect(() => {
    generateBarcode();
  }, [barcodeValue, size, showPrice, showSku]);

  async function generateBarcode() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = LABEL_SIZES[size];
    canvas.width = width * 2; // 2x for better quality
    canvas.height = height * 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw barcode (Code 128 simulation using simple bars)
    const barcodeWidth = canvas.width * 0.9;
    const barcodeHeight = height * 0.8;
    const startX = (canvas.width - barcodeWidth) / 2;
    const startY = 20;

    ctx.fillStyle = "#000000";

    // Simple Code 128 simulation
    const encoded = encodeCode128(barcodeValue);
    const barWidth = barcodeWidth / encoded.length;

    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === "1") {
        ctx.fillRect(startX + i * barWidth, startY, barWidth, barcodeHeight);
      }
    }

    // Draw text below barcode
    ctx.font = `bold ${Math.max(16, height * 0.2)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(barcodeValue, canvas.width / 2, startY + barcodeHeight + 25);

    // Draw SKU if enabled
    let textY = startY + barcodeHeight + 45;
    if (showSku && item.sku) {
      ctx.font = `${Math.max(12, height * 0.15)}px sans-serif`;
      ctx.fillText(item.sku, canvas.width / 2, textY);
      textY += 20;
    }

    // Draw price if enabled
    if (showPrice && item.retail_price) {
      ctx.font = `bold ${Math.max(14, height * 0.18)}px sans-serif`;
      ctx.fillText(`$${item.retail_price.toFixed(2)}`, canvas.width / 2, textY);
    }

    setBarcodeDataUrl(canvas.toDataURL("image/png"));

    // Generate ZPL code
    const zpl = generateZPL(barcodeValue, item.sku, item.retail_price, size, showSku, showPrice);
    setZplCode(zpl);
  }

  // Simple Code 128 encoding (subset B)
  function encodeCode128(value: string): string {
    let result = "11010010000"; // Start Code B
    let checksum = 104; // Start Code B value

    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i) - 32;
      checksum += charCode * (i + 1);
      result += getCode128Pattern(charCode);
    }

    // Add checksum
    result += getCode128Pattern(checksum % 103);
    result += "1100011101011"; // Stop pattern

    return result;
  }

  function getCode128Pattern(value: number): string {
    const patterns = [
      "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
      "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
      "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
      "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
      "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
      "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
      "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
      "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
      "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
      "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
      "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
      "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
      "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
      "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
      "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
      "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
      "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
      "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
      "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
      "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
      "10111101110", "11101011110", "11110101110",
    ];
    return patterns[value] || patterns[0];
  }

  function generateZPL(
    barcode: string,
    sku: string | null,
    price: number | null,
    labelSize: LabelSize,
    includesku: boolean,
    includeprice: boolean
  ): string {
    const sizes = {
      small: { w: 300, h: 100 },
      medium: { w: 400, h: 160 },
      large: { w: 600, h: 240 },
    };
    const { w, h } = sizes[labelSize];

    let zpl = `^XA\n`;
    zpl += `^PW${w}\n`;
    zpl += `^LL${h}\n`;
    zpl += `^FO20,20^BY2,2.5,50^BCN,60,Y,N,N^FD${barcode}^FS\n`;

    let yPos = 90;
    if (includesku && sku) {
      zpl += `^FO20,${yPos}^A0N,20,20^FD${sku}^FS\n`;
      yPos += 25;
    }
    if (includeprice && price) {
      zpl += `^FO20,${yPos}^A0N,25,25^FD$${price.toFixed(2)}^FS\n`;
    }

    zpl += `^XZ`;
    return zpl;
  }

  function handlePrint() {
    onPrint(format, size);

    if (format === "standard" && barcodeDataUrl) {
      // Open print dialog with the barcode image
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print Barcode - ${item.name}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
              img { max-width: 100%; }
              @media print {
                body { margin: 0; }
                img { max-width: ${LABEL_SIZES[size].width}mm; }
              }
            </style>
          </head>
          <body>
            <img src="${barcodeDataUrl}" />
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  }

  function handleDownload() {
    if (format === "zpl") {
      // Download ZPL file
      const blob = new Blob([zplCode], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.sku || item.id}-barcode.zpl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (barcodeDataUrl) {
      // Download PNG
      const a = document.createElement("a");
      a.href = barcodeDataUrl;
      a.download = `${item.sku || item.id}-barcode.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div>
            <h2 className="font-semibold text-stone-900">Print Barcode</h2>
            <p className="text-sm text-stone-500">{item.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-stone-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-6">
          <div className="bg-stone-50 rounded-xl p-4 flex justify-center items-center min-h-[160px]">
            {format === "standard" ? (
              <canvas
                ref={canvasRef}
                className="max-w-full"
                style={{
                  width: LABEL_SIZES[size].width,
                  height: LABEL_SIZES[size].height,
                }}
              />
            ) : (
              <div className="w-full">
                <p className="text-xs font-medium text-stone-500 mb-2">ZPL Code Preview:</p>
                <pre className="bg-white border border-stone-200 rounded-lg p-3 text-xs font-mono text-stone-700 overflow-x-auto whitespace-pre-wrap">
                  {zplCode}
                </pre>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <Settings2 className="h-4 w-4" />
              Settings
            </div>

            {/* Format */}
            <div>
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-2">
                Format
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormat("standard")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                    format === "standard"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  Standard (PNG)
                </button>
                <button
                  onClick={() => setFormat("zpl")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                    format === "zpl"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  ZPL (Zebra)
                </button>
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide block mb-2">
                Label Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as LabelSize)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                {Object.entries(LABEL_SIZES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Include options */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSku}
                  onChange={(e) => setShowSku(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-stone-700">Show SKU</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-stone-700">Show Price</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-2.5 px-4 border border-stone-200 text-stone-700 font-medium rounded-lg hover:bg-white transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-700 text-white font-medium py-2.5 rounded-lg hover:bg-amber-800 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
