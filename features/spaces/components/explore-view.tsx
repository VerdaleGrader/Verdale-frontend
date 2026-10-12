'use client';

import { PageContainer, PageHeader } from '@/components/layout/page';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { TextField } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { spacesApi } from '../api/spaces.api';
import { SpaceGrid } from './space-card';

const PAGE_SIZE = 20;

// Search and page live in the URL (?q=…&page=…); defaults are left out.
const QUERY = { q: param.text(), page: param.page() };

/** Search public Spaces by name. Works without an account; private Spaces never appear. */
export function ExploreView() {
  const { values, set } = useUrlQuery(QUERY);
  const { q: query, page } = values;
  // The URL follows typing only after a pause, so Core is not asked on every key.
  const [input, setInput] = useDebouncedText(query, (text) => set({ q: text }));

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
