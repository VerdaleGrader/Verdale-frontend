'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { errorMessage } from '@/lib/api';
import { effectiveLine, LEGAL_DOCUMENTS, LEGAL_VERSIONS, safeInternalPath, type LegalDocumentKey } from '@/lib/legal';
import { legalApi } from '../api/legal.api';

const KEYS: LegalDocumentKey[] = ['terms', 'privacy'];

function AcceptTermsContent() {
  const { auth, refresh, logout } = useAuth();
  const router = useRouter();
  const next = safeInternalPath(useSearchParams().get('next'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const required = auth.status === 'authenticated' && auth.user.legal?.acceptance_required === true;
  const nothingToAccept = auth.status === 'authenticated' && !required;

  useEffect(() => {
    if (auth.status === 'anonymous') router.replace('/login');
    if (nothingToAccept) router.replace(next);
  }, [auth.status, nothingToAccept, next, router]);

  if (auth.status === 'loading' || auth.status === 'anonymous' || nothingToAccept) {
    return <p className="text-small text-text-muted">Loading…</p>;
  }
  if (auth.status === 'unavailable') {
    return (
      <p role="alert" className="text-small text-danger">
        Could not reach the server. Reload the page to try again.
      </p>
    );
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await legalApi.accept();
      await refresh();
      router.replace(next);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="accept-terms-title"
      className="border-border bg-surface flex w-full max-w-lg flex-col gap-4 rounded-lg border p-5"
    >
      <header className="flex flex-col gap-1">
        <h1 id="accept-terms-title" className="text-h2">
          Terms and Privacy Policy updated
        </h1>
        <p className="text-small text-text-muted">
          Read the documents below, then accept them to keep using Verdale. You can also log out.
        </p>
      </header>

      <ul className="flex flex-col gap-2" lang="th">
        {KEYS.map((key) => (
          <li key={key} className="border-border bg-surface-sunken flex flex-col gap-0.5 rounded-md border px-3 py-2">
            <a
              href={LEGAL_DOCUMENTS[key].path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-text text-body-strong underline underline-offset-2"
            >
              {LEGAL_DOCUMENTS[key].name}
            </a>
            <span className="text-small text-text-muted">{effectiveLine(LEGAL_VERSIONS[key])}</span>
          </li>
        ))}
      </ul>

      <p className="vd-consent" lang="th">
        การกดยอมรับถือว่าท่านได้อ่านและยอมรับ{LEGAL_DOCUMENTS.terms.name}และ{LEGAL_DOCUMENTS.privacy.name}
        ฉบับข้างต้น
      </p>

      {error && (
        <Banner tone="danger" title="Could not record your answer">
          {error}
        </Banner>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" onClick={accept} disabled={busy} aria-busy={busy}>
          Accept and continue
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={busy}
          onClick={async () => {
            await logout();
            router.push('/');
          }}
        >
          Log out
        </Button>
      </div>
    </section>
  );
}

export function AcceptTermsCard() {
  return (
    <Suspense fallback={null}>
      <AcceptTermsContent />
    </Suspense>
  );
}
