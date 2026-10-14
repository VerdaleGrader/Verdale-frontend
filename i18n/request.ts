import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from './config';

/** The cookie wins, then the browser's language, then English. The address never carries the language. */
async function resolveLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  return localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
