'use client';

import { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { TextField } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { useApiQuery } from '@/lib/use-api-query';
import { spacesApi } from '../api/spaces.api';
import { SpaceGrid } from './space-card';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/** Search public Spaces by name. Works without an account; private Spaces never appear. */
export function ExploreView() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  // Wait for a pause in typing before asking Core.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(input.trim());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  const spaces = useApiQuery(
    () => spacesApi.listPublic({ q: query, page, pageSize: PAGE_SIZE }),
    `explore-${query}-${page}`
  );

  return (
    <PageContainer>
      <PageHeader
        title="Explore Spaces"
        description="Public Spaces anyone can browse. Log in to join in and solve problems."
      />
      <TextField
        type="search"
        label="Search by name"
        placeholder="For example: graph theory"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="max-w-md"
      />
      {spaces.status === 'loading' && <Loading label="Searching" />}
      {spaces.status === 'error' && <ErrorState error={spaces.error} onRetry={spaces.reload} />}
      {spaces.status === 'success' &&
        (spaces.data.items.length === 0 ? (
          <EmptyState
            title={query ? `No public Spaces match “${query}”` : 'No public Spaces yet'}
            description={
              query ? 'Try a shorter or different word.' : 'When someone makes a Space public, it shows up here.'
            }
          />
        ) : (
          <>
            <SpaceGrid spaces={spaces.data.items} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={spaces.data.total} onPage={setPage} />
          </>
        ))}
    </PageContainer>
  );
}
