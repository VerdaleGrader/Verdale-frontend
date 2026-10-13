'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CircleAlert } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useApiQuery } from '@/lib/use-api-query';
import { cn } from '@/lib/utils';
import { authApi, safeNext, signInUrl, type OAuthProvider } from '../api/auth.api';
import { ConsentNote } from './consent-note';

const PROVIDER_LABELS: Record<OAuthProvider, string> = { github: 'GitHub', google: 'Google' };

// Copy follows the design system: say what happened and what to do next.
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. Choose a provider to try again.',
  bad_request:
    'The sign-in attempt did not complete. Try again; if it keeps failing, check that your e-mail address is verified at the provider.',
  not_found: 'That sign-in method is not available.',
};

function LoginCardContent() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const error = params.get('error');
  const providers = useApiQuery(authApi.providers, 'providers');

  return (
    <section className="border-border bg-surface flex w-full max-w-sm flex-col gap-4 rounded-lg border p-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-h2">Log in or sign up</h1>
        <p className="text-small text-text-muted">
          Use your GitHub or Google account. A new account is created the first time you sign in.
        </p>
      </header>

      {error && (
        <p role="alert" className="bg-danger-soft text-danger text-small flex gap-2 rounded-md p-3">
          <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {ERROR_MESSAGES[error] ?? 'Sign-in failed. Try again.'}
        </p>
      )}

      {providers.status === 'loading' && <p className="text-small text-text-muted">Loading sign-in options…</p>}
      {providers.status === 'error' && (
        <p role="alert" className="text-small text-danger">
          Could not load sign-in options. Reload the page to try again.
        </p>
      )}
      {providers.status === 'success' && providers.data.length === 0 && (
        <p className="text-small text-text-muted">No sign-in method is configured on this server yet.</p>
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
              Continue with {PROVIDER_LABELS[provider]}
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
