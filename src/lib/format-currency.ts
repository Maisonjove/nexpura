/**
 * Format a monetary amount using the tenant's currency code.
 * Falls back to AUD if currency is not set.
 */
export function formatCurrency(amount: number, currency?: string | null): string {
  const code = currency || "AUD";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
