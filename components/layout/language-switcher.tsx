'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from '@/i18n/config';

/** Switches between the two languages. Shows the other language by its own name, e.g. "ไทย" while reading English. */
export function LanguageSwitcher() {
  const t = useTranslations('Language');
  const router = useRouter();
  const current: Locale = useLocale() as Locale;
  const target = t('targetCode');
  const label = t('switchTo', { language: t('targetName') });

  function switchLanguage() {
    if (!isLocale(target) || target === current) return;
    // The server reads this cookie on the next request; the address stays the same.
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <Tooltip label={label} side="bottom">
      <Button variant="ghost" size="sm" aria-label={label} onClick={switchLanguage}>
        <span lang={target}>{t('targetName')}</span>
      </Button>
    </Tooltip>
  );
}
