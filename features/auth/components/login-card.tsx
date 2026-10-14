'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { CircleAlert } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useApiQuery } from '@/lib/use-api-query';
import { cn } from '@/lib/utils';
import { authApi, safeNext, signInUrl, type OAuthProvider } from '../api/auth.api';
import { ConsentNote } from './consent-note';

const PROVIDER_LABELS: Record<OAuthProvider, string> = { github: 'GitHub', google: 'Google' };

// Copy follows the design system: say what happened and what to do next. Keys of messages "Login.errors".
const KNOWN_ERRORS = ['access_denied', 'bad_request', 'not_found'] as const;
function isKnownError(code: string): code is (typeof KNOWN_ERRORS)[number] {
  return (KNOWN_ERRORS as readonly string[]).includes(code);
}

function LoginCardContent() {
  const t = useTranslations('Login');
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const error = params.get('error');
  const providers = useApiQuery(authApi.providers, 'providers');

  return (
    <section className="border-border bg-surface flex w-full max-w-sm flex-col gap-4 rounded-lg border p-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-small text-text-muted">{t('intro')}</p>
      </header>

      {error && (
        <p role="alert" className="bg-danger-soft text-danger text-small flex gap-2 rounded-md p-3">
          <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {t(`errors.${isKnownError(error) ? error : 'other'}`)}
        </p>
      )}

      {providers.status === 'loading' && <p className="text-small text-text-muted">{t('loadingProviders')}</p>}
      {providers.status === 'error' && (
        <p role="alert" className="text-small text-danger">
          {t('providersError')}
        </p>
      )}
      {providers.status === 'success' && providers.data.length === 0 && (
        <p className="text-small text-text-muted">{t('noProviders')}</p>
      )}
      {providers.status === 'success' && (
        <div className="flex flex-col gap-2">
          {providers.data.map((provider, index) => (
            // A plain link: Core redirects the browser to the provider.
            <a
              key={provider}
              href={signInUrl(provider, next)}
              className={cn(buttonVariants({ variant: index === 0 ? 'primary' : 'secondary', size: 'lg' }), 'w-full')}
            >
              {t('continueWith', { provider: PROVIDER_LABELS[provider] })}
            </a>
          ))}
        </div>
      )}

      <ConsentNote />
    </section>
  );
}

export function LoginCard() {
  return (
    <Suspense fallback={null}>
      <LoginCardContent />
    </Suspense>
  );
}
