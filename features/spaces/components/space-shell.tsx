'use client';

import Link from 'next/link';
import { createContext, useContext } from 'react';
import { PageContainer } from '@/components/layout/page';
import { TabNav } from '@/components/layout/tab-nav';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { spacesApi } from '../api/spaces.api';
import { abilitiesOf, type SpaceAbilities } from '../abilities';
import type { Space } from '../types';
import { SpaceBadges } from './space-card';

interface SpaceContextValue {
  space: Space;
  abilities: SpaceAbilities;
  /** Reload the Space after a change (rename, archive, role change). */
  reload: () => void;
}

/** Exported for tests, which render panels without loading a Space. */
export const SpaceContext = createContext<SpaceContextValue | null>(null);

export function useSpace(): SpaceContextValue {
  const value = useContext(SpaceContext);
  if (!value) throw new Error('useSpace must be used inside <SpaceShell>');
  return value;
}

/**
 * Loads one Space and gives every page below it the Space and the user's
 * abilities. It draws no chrome of its own: the Space pages wear
 * <SpaceChrome> (header and tabs), while problem pages choose their own
 * layout, for example the wide two-column page for solving.
 */
export function SpaceProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { auth } = useAuth();
  // Reload when the signed-in user changes: a private Space answers differently once logged in.
  const space = useApiQuery(() => spacesApi.get(slug), `space-${slug}-${auth.status}`);

  if (space.status === 'loading' || auth.status === 'loading') {
    return (
      <PageContainer>
        <Loading label="Loading Space" />
      </PageContainer>
    );
  }
  if (space.status === 'error') {
    const notFound = space.error instanceof ApiError && space.error.status === 404;
    return (
      <PageContainer narrow>
        {notFound ? (
          <EmptyState
            title="Space not found"
            description={
              auth.status === 'authenticated'
                ? 'It may not exist, or it is private and you are not a member. Ask an owner for an invitation.'
                : 'It may not exist, or it is private. If you were invited, log in first.'
            }
            action={
              auth.status === 'authenticated' ? (
                <Link href="/explore" className={buttonVariants({ variant: 'secondary' })}>
                  Explore public Spaces
                </Link>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/spaces/${slug}`)}`}
                  className={buttonVariants({ variant: 'primary' })}
                >
                  Log in
                </Link>
              )
            }
          />
        ) : (
          <ErrorState error={space.error} onRetry={space.reload} />
        )}
      </PageContainer>
    );
  }

  const data = space.data;
  const value = { space: data, abilities: abilitiesOf(data), reload: space.reload };
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

/** The Space's header, notices and tabs around a Space page (overview, members, settings). */
export function SpaceChrome({ children }: { children: React.ReactNode }) {
  const { space: data, abilities } = useSpace();
  const base = `/spaces/${data.slug}`;
  const tabs = [
    { href: base, label: 'Overview' },
    ...(abilities.canViewMembers ? [{ href: `${base}/members`, label: 'Members', count: data.member_count }] : []),
    ...(data.my_role === 'owner' ? [{ href: `${base}/settings`, label: 'Settings' }] : []),
  ];

  return (
    <PageContainer>
      <header className="flex flex-col gap-2">
        <p className="text-mono-label text-text-muted">{data.slug}</p>
        <h1 className="text-h1 break-words">{data.name}</h1>
        <SpaceBadges space={data} />
        {data.description && <p className="text-prose text-text-muted max-w-[var(--measure)]">{data.description}</p>}
      </header>
      {abilities.archived && (
        <p role="status" className="bg-warning-soft text-warning text-small rounded-md p-3">
          This Space is archived. Its problems stay readable, but nothing can be added, changed or submitted.
        </p>
      )}
      {tabs.length > 1 && <TabNav items={tabs} label="Space sections" />}
      {children}
    </PageContainer>
  );
}
