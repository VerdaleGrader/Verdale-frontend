'use client';

import { PageContainer } from '@/components/layout/page';
import { ErrorState } from '@/components/states/states';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer narrow>
      <ErrorState
        title="This page could not be shown"
        error={
          new Error('An unexpected error occurred. Try again, and if it keeps happening, tell us what you were doing.')
        }
        onRetry={reset}
      />
      {error.digest && <p className="text-caption text-text-muted">Reference: {error.digest}</p>}
    </PageContainer>
  );
}
