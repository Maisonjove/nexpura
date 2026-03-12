// Generate a unique barcode value for an inventory item
export function generateBarcodeValue(tenantSlug: string, sku: string): string {
  // Format: NX-{SLUG_UPPER}-{SKU}
  const slug = tenantSlug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return `NX-${slug}-${sku}`
}
