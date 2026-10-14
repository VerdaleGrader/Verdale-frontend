'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageContainer } from '@/components/layout/page';
import { ErrorState } from '@/components/states/states';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Errors');
  // The page shows a friendly message; the real cause goes to the console for whoever is debugging.
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageContainer narrow>
      <ErrorState title={t('errorTitle')} error={new Error(t('errorText'))} onRetry={reset} />
      {error.digest && <p className="text-caption text-text-muted">{t('reference', { digest: error.digest })}</p>}
    </PageContainer>
  );
}
