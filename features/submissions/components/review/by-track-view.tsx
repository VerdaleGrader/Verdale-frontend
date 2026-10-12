'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { Dropdown } from '@/components/ui/dropdown';
import { FilterChips } from '@/components/ui/filter-chips';
import { SortHeader } from '@/components/ui/sort-header';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { reviewApi, type TrackRollup } from '../../api/review.api';
import { FilterBar, NothingYet, SearchField, TableState, When, reviewPath, sortProps } from './review-parts';

const VISIBILITY = ['all', 'space', 'members'] as const;
const SORTS = ['track_order', 'last_submission', 'submissions'] as const;
type Sort = (typeof SORTS)[number];

const QUERY = {
  q: param.text(),
  visibility: param.oneOf(VISIBILITY, 'all'),
  sort: param.oneOf(SORTS, 'track_order'),
};

const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'space', label: 'Everyone in the Space' },
  { value: 'members', label: 'Track members only' },
];
const SORT_OPTIONS = [
  { value: 'track_order', label: 'Track order' },
  { value: 'last_submission', label: 'Last submission, newest' },
  { value: 'submissions', label: 'Submissions, most' },
];

const COLUMNS = [
  { header: 'Track', width: 160 },
  { header: 'Visibility', width: 128 },
  { header: 'Problems', numeric: true, width: 32 },
  { header: 'Members', numeric: true, width: 32 },
  { header: 'Submissions', numeric: true, width: 40 },
  { header: 'Accepted', numeric: true, width: 40 },
  { header: 'Members finished', width: 160 },
  { header: 'Last submission', width: 80 },
];

/** The share of the audience that finished a Track, as a bar with the numbers beside it. */
export function FinishedBar({ row }: { row: TrackRollup }) {
  if (row.submissions === 0) return <RowText className="vd-muted">No submissions yet</RowText>;
  const share = row.members === 0 ? 0 : Math.min(100, (row.members_finished / row.members) * 100);
  return (
    <span className="vd-inline">
      <span aria-hidden className="bg-surface-sunken inline-block h-1.5 w-[120px] rounded-sm">
        <span className="bg-primary block h-1.5 rounded-sm" style={{ width: `${share}%` }} />
      </span>
      <RowText className="vd-mono">
        {row.members_finished} of {row.members}
      </RowText>
    </span>
  );
}

/** Group by track, step 1: every Track with its numbers. A row opens the Track's problems. */
export function ByTrackView() {
  const { space } = useSpace();
  const { auth } = useAuth();
  const { values, set } = useUrlQuery(QUERY);
  const [draft, setDraft] = useDebouncedText(values.q, (q) => set({ q }));

  const query = useApiQuery(
    () =>
      reviewApi.byTrack(space, {
        q: values.q,
        visibility: values.visibility === 'all' ? undefined : values.visibility,
        sort: values.sort,
      }),
    JSON.stringify(['by-track', space.slug, values, auth.status])
  );

  const chips = [
    values.q && { key: 'q', label: `Search: “${values.q}”` },
    values.visibility !== 'all' && {
      key: 'visibility',
      label: `Visibility: ${VISIBILITY_OPTIONS.find((option) => option.value === values.visibility)!.label}`,
    },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));
  const clear = () => set({ q: '', visibility: 'all' });
  const remove = (key: string) => set({ [key]: QUERY[key as keyof typeof QUERY].default });
  const sort = (keys: { desc?: Sort; asc?: Sort }) => sortProps(values.sort, keys, (next) => set({ sort: next }));

  return (
    <>
      <FilterBar label="Filter tracks">
        <SearchField placeholder="Track name" value={draft} onChange={setDraft} />
        <Dropdown
          label="Visibility"
          className="w-[220px]"
          options={VISIBILITY_OPTIONS}
          value={values.visibility}
          onValueChange={(visibility) => set({ visibility: visibility as (typeof VISIBILITY)[number] })}
        />
        <Dropdown
          label="Sort"
          className="w-[220px]"
          options={SORT_OPTIONS}
          value={values.sort}
          onValueChange={(next) => set({ sort: next as Sort })}
        />
      </FilterBar>
      <FilterChips filters={chips} onRemove={remove} onClear={clear} />

      <TableState
        query={query}
        columns={COLUMNS}
        label="tracks"
        filtered={chips.length > 0}
        onClear={clear}
        isEmpty={(data) => data.items.length === 0}
        failure="Tracks could not be loaded"
        empty={
          <NothingYet
            title="No tracks yet"
            description="Tracks group the problems members work through. Create one, and its submissions are counted here."
            href={`/spaces/${space.slug}`}
            action="Back to the Space"
          />
        }
      >
        {(data) => (
          <>
            <div className="vd-tablewrap">
              <table className="vd-table">
                <caption className="vd-sr">Tracks and their submissions</caption>
                <thead>
                  <tr>
                    <th scope="col">Track</th>
                    <th scope="col">Visibility</th>
                    <th scope="col" className="is-num">
                      Problems
                    </th>
                    <th scope="col" className="is-num">
                      Members
                    </th>
                    <SortHeader numeric {...sort({ desc: 'submissions' })}>
                      Submissions
                    </SortHeader>
                    <th scope="col" className="is-num">
                      Accepted
                    </th>
                    <th scope="col">Members finished</th>
                    <SortHeader {...sort({ desc: 'last_submission' })}>Last submission</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const href = reviewPath(space.slug, 'tracks', row.track.slug);
                    return (
                      <ClickableRow key={row.track.slug} href={href}>
                        <td>
                          <Link href={href} className="vd-link">
                            {row.track.name}
                          </Link>{' '}
                          {row.track.is_default && <Badge>Default</Badge>}
                        </td>
                        <td>
                          <RowText className="inline-flex items-center gap-1">
                            {row.track.visibility === 'members' ? (
                              <>
                                <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
                                Track members only
                              </>
                            ) : (
                              'Everyone in the Space'
                            )}
                          </RowText>
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.problems}</RowText>
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.members}</RowText>
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.submissions}</RowText>
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.accepted}</RowText>
                        </td>
                        <td>
                          <FinishedBar row={row} />
                        </td>
                        <td>
                          <When iso={row.last_submission_at} />
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-small text-text-muted">
              A submission counts toward the track it was made from. Problems that are in the Space but in no track are
              listed under Group by Problem.
            </p>
          </>
        )}
      </TableState>
    </>
  );
}
