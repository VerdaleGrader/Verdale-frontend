/** Languages the interface is available in. English is the source language and the fallback. */
export const LOCALES = ['en', 'th'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Remembers the visitor's choice. Not sensitive, so the browser sets it directly. */
export const LOCALE_COOKIE = 'vd_locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** First language in an Accept-Language header that we have: "th-TH,th;q=0.9,en;q=0.8" -> "th". */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)?.[1]).find(Boolean);
      return { base: tag.trim().toLowerCase().split('-')[0] ?? '', q: q === undefined ? 1 : Number(q) };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((entry) => entry.base).find(isLocale);
}
