import { format, formatDistanceToNow, isValid, type Locale } from 'date-fns';
import { enAU, fr, es, ar } from 'date-fns/locale';

const localeMap: Record<string, Locale> = {
  en: enAU,
  'en-AU': enAU,
  fr,
  es,
  ar,
};

/**
 * Format a date with locale-aware formatting.
 * Falls back to enAU for unknown locales.
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = 'dd MMM yyyy',
  locale: string = 'en'
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '—';
  return format(d, formatStr, { locale: localeMap[locale] ?? enAU });
}

/**
 * Format a date as relative time (e.g. "2 days ago").
 */
export function formatRelative(
  date: Date | string | null | undefined,
  locale: string = 'en'
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '—';
  return formatDistanceToNow(d, { addSuffix: true, locale: localeMap[locale] ?? enAU });
}

/**
 * Format a currency value with locale-aware number formatting.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'AUD',
  locale: string = 'en'
): string {
  if (amount == null) return '—';

  const localeStr = locale === 'ar' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-AU';

  return new Intl.NumberFormat(localeStr, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
