/**
 * ZPL Stock Tag Generator for Zebra ZD-series printers
 * Default label: 38mm × 25mm @ 203 DPI (standard jewellery tag)
 * Supports 50mm × 25mm and 50mm × 30mm variants
 */

export interface ZplTagItem {
  name: string;
  sku: string | null;
  retail_price: number | null;
  metal_type: string | null;
  stone_type: string | null;
  metal_weight_grams: number | null;
  barcode_value: string | null;
}

export type TagSize = "38x25" | "50x25" | "50x30";

const SIZES: Record<TagSize, { w: number; h: number }> = {
  "38x25": { w: 304, h: 200 },  // 38mm × 25mm @ 203dpi (8dpmm)
  "50x25": { w: 400, h: 200 },  // 50mm × 25mm
  "50x30": { w: 400, h: 240 },  // 50mm × 30mm
};

function zplSafe(str: string): string {
  // Escape ZPL special chars
  return str.replace(/[\\^~]/g, " ").substring(0, 40);
}

function fmt(price: number): string {
  return "$" + price.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateZpl(item: ZplTagItem, size: TagSize = "38x25", tenantName = ""): string {
  const { w, h } = SIZES[size];
  const barcode = item.barcode_value || item.sku || item.name.substring(0, 12).replace(/\s/g, "-").toUpperCase();
  const name = zplSafe(item.name);
  const sku = item.sku ? zplSafe(item.sku) : "";
  const price = item.retail_price != null ? fmt(item.retail_price) : "";

  const metalStone = [item.metal_type, item.stone_type]
    .filter(Boolean)
    .join(" / ");
  const weight = item.metal_weight_grams ? `${item.metal_weight_grams}g` : "";
  const details = [metalStone, weight].filter(Boolean).join("  ");

  // Font sizes vary by label size
  const isSmall = size === "38x25";
  const nameFontH = isSmall ? 18 : 22;
  const nameFontW = isSmall ? 18 : 22;
  const detailFontH = isSmall ? 14 : 16;
  const priceFontH = isSmall ? 22 : 26;
  const barcodeH = isSmall ? 35 : 45;

  let zpl = `^XA\n`;
  zpl += `^MMT\n`;
  zpl += `^PW${w}\n`;
  zpl += `^LL${h}\n`;
  zpl += `^LS0\n`;

  // Item name — top, bold
  zpl += `^FO8,6^A0N,${nameFontH},${nameFontW}^FD${name}^FS\n`;

  // SKU (if available)
  if (sku) {
    zpl += `^FO8,${8 + nameFontH + 2}^A0N,${detailFontH},${detailFontH}^FDSKU: ${sku}^FS\n`;
  }

  // Metal / stone / weight
  const detailY = 8 + nameFontH + (sku ? detailFontH + 4 : 0) + 4;
  if (details) {
    zpl += `^FO8,${detailY}^A0N,${detailFontH},${detailFontH}^FD${zplSafe(details)}^FS\n`;
  }

  // Price — right-aligned, prominent
  if (price) {
    zpl += `^FO${w - 90},${detailY - 2}^A0N,${priceFontH},${priceFontH}^FD${price}^FS\n`;
  }

  // Divider line
  const lineY = h - barcodeH - 22;
  zpl += `^FO4,${lineY}^GB${w - 8},1,1^FS\n`;

  // Barcode (Code 128) — bottom section
  const barcodeY = lineY + 5;
  zpl += `^FO${Math.floor((w - Math.min(barcode.length * 12, w - 20)) / 2)},${barcodeY}`;
  zpl += `^BCN,${barcodeH},N,N,N^FD${barcode}^FS\n`;

  // Barcode text below
  const barcodeTextY = barcodeY + barcodeH + 3;
  zpl += `^FO4,${barcodeTextY}^A0N,12,12^FD${barcode}^FS\n`;

  // Store name — bottom right (tiny)
  if (tenantName) {
    zpl += `^FO${w - tenantName.length * 8 - 4},${barcodeTextY}^A0N,11,11^FD${zplSafe(tenantName)}^FS\n`;
  }

  zpl += `^PQ1,0,1,Y\n`;
  zpl += `^XZ`;

  return zpl;
}

export function downloadZpl(zpl: string, filename = "stock-tag.zpl") {
  const blob = new Blob([zpl], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
