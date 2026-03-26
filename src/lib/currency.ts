/**
 * Currency utilities for multi-currency invoicing
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimalPlaces: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimalPlaces: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimalPlaces: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimalPlaces: 2 },
];

export function getCurrency(code: string): Currency | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code.toUpperCase());
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const currency = getCurrency(currencyCode);
  if (!currency) {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  });

  return formatter.format(amount);
}

/**
 * Fetch current exchange rate from Open Exchange Rates (free tier) or fallback
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return 1;

  // Try to get from DB first (cached rate)
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  
  const { data: cached } = await admin
    .from("currency_exchange_rates")
    .select("rate")
    .eq("base_currency", fromCurrency)
    .eq("target_currency", toCurrency)
    .gte("fetched_at", today)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (cached?.rate) {
    return cached.rate;
  }

  // Fetch fresh rate from exchangerate.host (free, no API key required)
  try {
    const response = await fetch(
      `https://api.exchangerate.host/convert?from=${fromCurrency}&to=${toCurrency}&amount=1`,
      { next: { revalidate: 3600 } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.result) {
        const rate = data.result;

        // Cache the rate
        await admin.from("currency_exchange_rates").insert({
          base_currency: fromCurrency,
          target_currency: toCurrency,
          rate,
          fetched_at: new Date().toISOString(),
        });

        return rate;
      }
    }
  } catch {
    // Fallback to static rates if API fails
  }

  // Fallback static rates (relative to USD)
  const STATIC_RATES: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    AUD: 1.53,
    NZD: 1.64,
    CAD: 1.36,
    CHF: 0.88,
    JPY: 149.5,
    SGD: 1.34,
    HKD: 7.82,
  };

  const fromRate = STATIC_RATES[fromCurrency] || 1;
  const toRate = STATIC_RATES[toCurrency] || 1;
  
  return toRate / fromRate;
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ convertedAmount: number; rate: number }> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return {
    convertedAmount: amount * rate,
    rate,
  };
}

/**
 * Format amount with conversion display
 * e.g., "€500.00 (≈ A$812.50)"
 */
export async function formatWithConversion(
  amount: number,
  invoiceCurrency: string,
  baseCurrency: string
): Promise<string> {
  const formatted = formatCurrency(amount, invoiceCurrency);
  
  if (invoiceCurrency === baseCurrency) {
    return formatted;
  }

  const { convertedAmount } = await convertCurrency(amount, invoiceCurrency, baseCurrency);
  const baseFormatted = formatCurrency(convertedAmount, baseCurrency);
  
  return `${formatted} (≈ ${baseFormatted})`;
}
