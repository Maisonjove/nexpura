/**
 * Client-safe i18n configuration.
 * This file can be imported from both server and client components.
 */

export const locales = ['en', 'fr', 'es', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const rtlLocales: readonly Locale[] = ['ar'];

export function isRTL(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}

export const LANGUAGE_CONFIG: Record<Locale, { name: string; nativeName: string; flag: string; rtl?: boolean }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇦🇺' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
};
