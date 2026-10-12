'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useUrlQuery } from '@/lib/use-url-query';
import { cn } from '@/lib/utils';
import { spacesApi } from '../api/spaces.api';
import { PendingInvites } from './pending-invites';
import { SpaceGrid } from './space-card';

const PAGE_SIZE = 20;

// The tab and page live in the URL (?tab=archived&page=2); defaults are left out.
const QUERY = { tab: param.oneOf(['active', 'archived'] as const, 'active'), page: param.page() };

/** The signed-in user's Spaces: active ones first, archived ones on their own tab. */
export function MySpacesView() {
  const auth = useRequireAuth();
  const { values, set } = useUrlQuery(QUERY);
  const { tab, page } = values;
  const archived = tab === 'archived';
  const spaces = useApiQuery(
    () => spacesApi.listMine({ page, pageSize: PAGE_SIZE }, archived),
    `mine-${tab}-${page}-${auth.status}`
  );

  return (
    <PageContainer>
      <PageHeader
        title="My Spaces"
        description="Spaces you own or belong to. Your personal Space is created with your account."
        actions={
          <Link href="/spaces/new" className={cn(buttonVariants({ variant: 'primary' }))}>
            <Plus aria-hidden />
            Create Space
          </Link>
        }
      />

      <PendingInvites onJoined={spaces.reload} />

      <Tabs value={tab} onValueChange={(next) => set({ tab: next as 'active' | 'archived' })}>
        <TabsList aria-label="Space status">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {spaces.status === 'loading' && <Loading label="Loading your Spaces" />}
      {spaces.status === 'error' && <ErrorState error={spaces.error} onRetry={spaces.reload} />}
      {spaces.status === 'success' &&
        (spaces.data.items.length === 0 ? (
          archived ? (
            <EmptyState
              title="No archived Spaces"
              description="Spaces you archive appear here. Their problems stay readable."
            />
          ) : (
            <EmptyState
              title="You are not in any Space yet"
              description="Create a Space to collect problems, or ask an owner for an invitation."
            />
          )
        ) : (
          <>
            <SpaceGrid spaces={spaces.data.items} />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={spaces.data.total}
              onPage={(next) => set({ page: next })}
            />
          </>
        ))}
    </PageContainer>
  );
}
