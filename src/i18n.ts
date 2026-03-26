import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'fr', 'es', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const rtlLocales: Locale[] = ['ar'];

export function isRTL(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}

export default getRequestConfig(async () => {
  // Read locale from cookie
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;
  const locale = (locales.includes(localeCookie as Locale) ? localeCookie : defaultLocale) as Locale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
