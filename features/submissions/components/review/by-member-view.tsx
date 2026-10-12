'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { Dropdown } from '@/components/ui/dropdown';
import { FilterChips } from '@/components/ui/filter-chips';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { ROLE_LABELS } from '@/features/spaces/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { formatCount } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { reviewApi } from '../../api/review.api';
import {
  FilterBar,
  NothingYet,
  OPTION_ALL,
  SearchField,
  TableState,
  When,
  dash,
  reviewPath,
  sortProps,
  useTrackOptions,
} from './review-parts';

const PAGE_SIZE = 10;

const ROLES = ['all', 'owner', 'administrator', 'editor', 'observer', 'solver', 'none'] as const;
const WINDOWS = ['any', '7d', '30d'] as const;
const SORTS = ['last_submission', 'solved', 'name'] as const;
type Sort = (typeof SORTS)[number];
const FLAG = ['true', 'false'] as const;

// Everything the view can show lives in the URL; defaults are left out of it.
const QUERY = {
  q: param.text(),
  role: param.oneOf(ROLES, 'all'),
  track: param.text(OPTION_ALL),
  window: param.oneOf(WINDOWS, 'any'),
  sort: param.oneOf(SORTS, 'last_submission'),
  hide_empty: param.oneOf(FLAG, 'true'),
  page: param.page(),
};

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'owner', label: ROLE_LABELS.owner },
  { value: 'administrator', label: ROLE_LABELS.administrator },
  { value: 'editor', label: ROLE_LABELS.editor },
  { value: 'observer', label: ROLE_LABELS.observer },
  { value: 'solver', label: ROLE_LABELS.solver },
  { value: 'none', label: 'Not a member' },
];
const WINDOW_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];
const SORT_OPTIONS = [
  { value: 'last_submission', label: 'Last submission, newest' },
  { value: 'solved', label: 'Solved, most' },
  { value: 'name', label: 'Name, A to Z' },
];

const COLUMNS = [
  { header: 'Member', width: 160 },
  { header: 'Role', width: 72 },
  { header: 'Attempted', numeric: true, width: 40 },
  { header: 'Solved', numeric: true, width: 40 },
  { header: 'Submissions', numeric: true, width: 40 },
  { header: 'AC rate', numeric: true, width: 40 },
  { header: 'Last verdict', width: 96 },
  { header: 'Last submission', width: 80 },
];

/** Group by member, step 1: everyone with their numbers. A row opens that person's problems. */
export function ByMemberView() {
  const { space } = useSpace();
  const { auth } = useAuth();
  const { values, set } = useUrlQuery(QUERY);
  const [draft, setDraft] = useDebouncedText(values.q, (q) => set({ q }));
  const tracks = useTrackOptions(space.slug);
  const track = tracks.known(values.track) ? values.track : OPTION_ALL;
  const hideEmpty = values.hide_empty === 'true';

  const query = useApiQuery(
    () =>
      reviewApi.byMember(space, {
        q: values.q,
        role: values.role === 'all' ? undefined : values.role,
        track,
        window: values.window,
        sort: values.sort,
        hideEmpty,
        page: values.page,
        pageSize: PAGE_SIZE,
      }),
    JSON.stringify(['by-member', space.slug, values, track, auth.status])
  );

  const chips = [
    values.q && { key: 'q', label: `Search: “${values.q}”` },
    values.role !== 'all' && {
      key: 'role',
      label: `Role: ${ROLE_OPTIONS.find((option) => option.value === values.role)!.label}`,
    },
    track !== OPTION_ALL && { key: 'track', label: `Track: ${tracks.nameOf(track)}` },
    values.window !== 'any' && {
      key: 'window',
      label: `Submitted: ${WINDOW_OPTIONS.find((option) => option.value === values.window)!.label}`,
    },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));
  const clear = () => set({ q: '', role: 'all', track: OPTION_ALL, window: 'any' });
  const remove = (key: string) => set({ [key]: QUERY[key as keyof typeof QUERY].default });
  const sort = (keys: { desc?: Sort; asc?: Sort }) => sortProps(values.sort, keys, (next) => set({ sort: next }));

  return (
    <>
      <FilterBar label="Filter members">
        <SearchField placeholder="Name or username" value={draft} onChange={setDraft} />
        <Dropdown
          label="Role"
          className="w-[160px]"
          options={ROLE_OPTIONS}
          value={values.role}
          onValueChange={(role) => set({ role: role as (typeof ROLES)[number] })}
        />
        <Dropdown
          label="Track"
          className="w-[200px]"
          options={tracks.options}
          value={track}
          onValueChange={(next) => set({ track: next })}
        />
        <Dropdown
          label="Submitted"
          className="w-[180px]"
          options={WINDOW_OPTIONS}
          value={values.window}
          onValueChange={(window) => set({ window: window as (typeof WINDOWS)[number] })}
        />
        <Dropdown
          label="Sort"
          className="w-[220px]"
          options={SORT_OPTIONS}
          value={values.sort}
          onValueChange={(next) => set({ sort: next as (typeof SORTS)[number] })}
        />
      </FilterBar>

      <FilterChips filters={chips} onRemove={remove} onClear={clear} />
      <div className="flex flex-wrap items-center gap-2">
        {query.status === 'success' && (
          <>
            <span className="text-small text-text-muted">
              {formatCount(query.data.totals.members)} {query.data.totals.members === 1 ? 'member' : 'members'},{' '}
              {formatCount(query.data.totals.submissions)}{' '}
              {query.data.totals.submissions === 1 ? 'submission' : 'submissions'}
            </span>
            <span aria-hidden className="text-border-strong">
              ·
            </span>
          </>
        )}
        <Checkbox
          label="Hide members with no submissions"
          checked={hideEmpty}
          onCheckedChange={(checked) => set({ hide_empty: checked === true ? 'true' : 'false' })}
        />
      </div>

      <TableState
        query={query}
        columns={COLUMNS}
        label="members"
        filtered={chips.length > 0}
        onClear={clear}
        isEmpty={(data) => data.items.length === 0}
        failure="Members could not be loaded"
        empty={
          <NothingYet
            title="No submissions yet"
            description="Submissions appear here once members solve problems in a track. Problems outside every track can only be tried by owners, administrators and editors."
            href={`/spaces/${space.slug}`}
            action="Back to the Space"
          />
        }
      >
        {(data) => (
          <>
            <div className="vd-tablewrap">
              <table className="vd-table">
                <caption className="vd-sr">Members and their submissions</caption>
                <thead>
                  <tr>
                    <SortHeader {...sort({ asc: 'name' })}>Member</SortHeader>
                    <th scope="col">Role</th>
                    <th scope="col" className="is-num">
                      Attempted
                    </th>
                    <SortHeader numeric {...sort({ desc: 'solved' })}>
                      Solved
                    </SortHeader>
                    <th scope="col" className="is-num">
                      Submissions
                    </th>
                    <th scope="col" className="is-num">
                      AC rate
                    </th>
                    <th scope="col">Last verdict</th>
                    <SortHeader {...sort({ desc: 'last_submission' })}>Last submission</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <ClickableRow key={row.user.username} href={reviewPath(space.slug, 'members', row.user.username)}>
                      <td>
                        <span className="vd-inline">
                          <Avatar name={row.user.display_name} src={row.user.avatar_url} size="sm" />
                          <Link href={reviewPath(space.slug, 'members', row.user.username)} className="vd-link">
                            {row.user.display_name}
                          </Link>
                          <RowText className="vd-muted">@{row.user.username}</RowText>
                        </span>
                      </td>
                      <td>
                        <RowText className={row.role ? undefined : 'vd-muted'}>
                          {row.role ? ROLE_LABELS[row.role] : 'Not a member'}
                        </RowText>
                      </td>
                      <td className="is-num vd-mono">
                        <RowText>{row.attempted}</RowText>
                      </td>
                      <td className="is-num vd-mono">
                        <RowText>{row.solved}</RowText>
                      </td>
                      <td className="is-num vd-mono">
                        <RowText>{row.submissions}</RowText>
                      </td>
                      <td className="is-num vd-mono">
                        <RowText>{row.ac_rate === null ? dash : `${Math.round(row.ac_rate * 100)}%`}</RowText>
                      </td>
                      <td>{row.last_verdict ? <VerdictBadge verdict={row.last_verdict} format="auto" /> : dash}</td>
                      <td>
                        <When iso={row.last_submission_at} />
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={values.page} pageSize={PAGE_SIZE} total={data.total} onPage={(page) => set({ page })} />
          </>
        )}
      </TableState>
    </>
  );
}
