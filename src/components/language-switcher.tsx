'use client';

import { useState, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { locales, type Locale } from '@/i18n';

const LANGUAGE_CONFIG: Record<Locale, { name: string; nativeName: string; flag: string; rtl?: boolean }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇦🇺' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
};

interface LanguageSwitcherProps {
  currentLocale?: string;
  compact?: boolean;
}

export function LanguageSwitcher({ currentLocale = 'en', compact = false }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const current = LANGUAGE_CONFIG[currentLocale as Locale] ?? LANGUAGE_CONFIG.en;

  function handleSelect(locale: Locale) {
    setOpen(false);
    startTransition(() => {
      // Set cookie and reload
      document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.location.reload();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-colors text-sm font-medium text-stone-700 ${
          compact ? 'px-2 py-1.5' : 'px-3 py-2'
        }`}
        aria-label="Switch language"
      >
        <Globe className="h-4 w-4 text-stone-500" />
        {!compact && (
          <>
            <span>{current.flag}</span>
            <span>{current.nativeName}</span>
          </>
        )}
        {compact && <span>{current.flag}</span>}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-44 bg-white rounded-xl border border-stone-200 shadow-lg overflow-hidden">
            {locales.map((locale) => {
              const lang = LANGUAGE_CONFIG[locale];
              const isSelected = locale === currentLocale;
              return (
                <button
                  key={locale}
                  onClick={() => handleSelect(locale)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-stone-50 transition-colors text-left ${
                    isSelected ? 'bg-amber-50 text-amber-800 font-medium' : 'text-stone-700'
                  } ${lang.rtl ? 'flex-row-reverse text-right' : ''}`}
                  dir={lang.rtl ? 'rtl' : 'ltr'}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                  {isSelected && <span className="ml-auto text-amber-600">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
