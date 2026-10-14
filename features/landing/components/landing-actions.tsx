'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/auth-provider';

/** The two calls to action, repeated in the hero and at the end of the page. */
export function LandingActions() {
  const t = useTranslations('Landing.actions');
  const { auth } = useAuth();
  const signedIn = auth.status === 'authenticated';
  return (
    <div className="flex flex-wrap gap-3">
      <ButtonLink href={signedIn ? '/spaces' : '/login'} variant="primary" size="lg" className="px-5">
        {signedIn ? t('goToSpaces') : t('getStarted')}
        <ArrowRight aria-hidden />
      </ButtonLink>
      <ButtonLink href="/explore" variant="secondary" size="lg" className="px-5">
        {t('explore')}
      </ButtonLink>
    </div>
  );
}
