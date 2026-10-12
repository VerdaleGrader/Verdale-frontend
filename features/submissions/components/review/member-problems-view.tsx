'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { Dropdown } from '@/components/ui/dropdown';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { StatSummary } from '@/components/ui/stat-summary';
import { FilterChips } from '@/components/ui/filter-chips';
import { Skeleton } from '@/components/states/states';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { ROLE_LABELS } from '@/features/spaces/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { reviewApi } from '../../api/review.api';
import {
  FilterBar,
  NothingYet,
  OPTION_ALL,
  SearchField,
  SummaryCard,
  TableState,
  Unavailable,
  When,
  dash,
  isMissing,
  reviewPath,
  sortProps,
  useLastSuccess,
  useTrackOptions,
} from './review-parts';

const PAGE_SIZE = 20;
const STATUSES = ['all', 'unsolved', 'solved'] as const;
const SORTS = ['last_submission', 'attempts', 'name'] as const;
type Sort = (typeof SORTS)[number];

const QUERY = {
  q: param.text(),
  track: param.text(OPTION_ALL),
  status: param.oneOf(STATUSES, 'all'),
  sort: param.oneOf(SORTS, 'last_submission'),
  page: param.page(),
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'unsolved', label: 'Not solved' },
  { value: 'solved', label: 'Solved' },
];
const SORT_OPTIONS = [
  { value: 'last_submission', label: 'Last submission, newest' },
  { value: 'attempts', label: 'Attempts, most' },
  { value: 'name', label: 'Problem, A to Z' },
];

const COLUMNS = [
  { header: 'Problem', width: 200 },
  { header: 'Track', width: 96 },
  { header: 'Attempts', numeric: true, width: 40 },
  { header: 'Best verdict', width: 96 },
  { header: 'Last verdict', width: 96 },
  { header: 'Last submission', width: 80 },
];

/** How far the person got in each Track: solved out of the Track's published problems. */
function TrackProgressCards({ slug, username }: { slug: string; username: string }) {
  const { auth } = useAuth();
  const progress = useApiQuery(async () => {
    const tracks = await reviewApi.byTrack({ slug });
    const rows = await Promise.all(
      tracks.items.map(async (track) => {
        try {
          const found = (await reviewApi.trackProgress({ slug }, track.track.slug)).items.find(
            (item) => item.user.username === username
          );
          return found ? { name: track.track.name, solved: found.solved, total: track.problems } : null;
        } catch {
          return null;
        }
      })
    );
    return rows.filter((row) => row !== null);
  }, `member-progress-${slug}-${username}-${auth.status}`);
  if (progress.status !== 'success' || progress.data.length === 0) return null;
  return (
    <section aria-label="Track progress" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {progress.data.map((row) => (
        <div key={row.name} className="border-border bg-surface flex flex-col gap-2 rounded-md border px-4 py-3">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{row.name}</span>
            <span className="vd-mono text-text-muted">
              {row.solved} of {row.total}
            </span>
          </div>
          <div aria-hidden className="bg-surface-sunken h-1.5 rounded-sm">
            <div
              className="bg-primary h-1.5 rounded-sm"
              style={{ width: `${row.total === 0 ? 0 : Math.min(100, (row.solved / row.total) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

/** Group by member, step 2: the problems one person tried, with their best and last verdict. */
export function MemberProblemsView() {
  const { username } = useParams<{ username: string }>();
  const { space } = useSpace();
  const { auth } = useAuth();
  const { values, set } = useUrlQuery(QUERY);
  const [draft, setDraft] = useDebouncedText(values.q, (q) => set({ q }));
  const tracks = useTrackOptions(space.slug);
  const track = tracks.known(values.track) ? values.track : OPTION_ALL;

  const query = useApiQuery(
    () =>
      reviewApi.memberProblems(space, username, {
        q: values.q,
        track,
        status: values.status,
        sort: values.sort,
        page: values.page,
        pageSize: PAGE_SIZE,
      }),
    JSON.stringify(['member-problems', space.slug, username, values, track, auth.status])
  );
  const page = useLastSuccess(query);
  const member = page?.member;
  const base = reviewPath(space.slug);

  if (query.status === 'error' && isMissing(query.error)) {
    return (
      <Unavailable
        title="This member isn’t available"
        description="They may not exist in this Space, or your role doesn’t let you see their submissions."
        href={base}
        action="Back to submissions"
      />
    );
  }

  const chips = [
    values.q && { key: 'q', label: `Search: “${values.q}”` },
    track !== OPTION_ALL && { key: 'track', label: `Track: ${tracks.nameOf(track)}` },
    values.status !== 'all' && {
      key: 'status',
      label: `Status: ${STATUS_OPTIONS.find((option) => option.value === values.status)!.label}`,
    },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));
  const clear = () => set({ q: '', track: OPTION_ALL, status: 'all' });
  const remove = (key: string) => set({ [key]: QUERY[key as keyof typeof QUERY].default });
  const sort = (keys: { desc?: Sort; asc?: Sort }) => sortProps(values.sort, keys, (next) => set({ sort: next }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Submissions', href: base },
          { label: 'By member', href: base },
          { label: member?.user.display_name ?? username },
        ]}
      />

      <SummaryCard label="Member summary">
        {member ? (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={member.user.display_name} src={member.user.avatar_url} size="lg" />
              <div className="flex flex-col">
                <h2 className="text-h2">{member.user.display_name}</h2>
                <span className="text-small text-text-muted">
                  @{member.user.username} · {member.role ? ROLE_LABELS[member.role] : 'Not a member'}
                </span>
              </div>
            </div>
            <StatSummary
              stats={[
                { label: 'Attempted', value: member.attempted },
                { label: 'Solved', value: member.solved, tone: 'brand' },
                { label: 'Submissions', value: member.submissions },
                { label: 'AC rate', value: member.ac_rate === null ? '—' : `${Math.round(member.ac_rate * 100)}%` },
              ]}
            />
          </>
        ) : (
          <Skeleton width={240} height={28} />
        )}
      </SummaryCard>

      <TrackProgressCards slug={space.slug} username={username} />

      <FilterBar label="Filter problems">
        <SearchField placeholder="Problem name or slug" value={draft} onChange={setDraft} />
        <Dropdown
          label="Track"
          className="w-[200px]"
          options={tracks.options}
          value={track}
          onValueChange={(next) => set({ track: next })}
        />
        <Dropdown
          label="Status"
          className="w-[180px]"
          options={STATUS_OPTIONS}
          value={values.status}
          onValueChange={(status) => set({ status: status as (typeof STATUSES)[number] })}
        />
        <Dropdown
          label="Sort"
          className="w-[220px]"
          options={SORT_OPTIONS}
          value={values.sort}
          onValueChange={(next) => set({ sort: next as Sort })}
        />
      </FilterBar>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChips filters={chips} onRemove={remove} onClear={clear} />
        {query.status === 'success' && member && (
          <span className="text-small text-text-muted ml-auto">
            {chips.length > 0 ? `${query.data.total} of ${member.attempted}` : query.data.total}{' '}
            {query.data.total === 1 && chips.length === 0 ? 'problem' : 'problems'}
          </span>
        )}
      </div>

      <TableState
        query={query}
        columns={COLUMNS}
        label="problems"
        filtered={chips.length > 0}
        onClear={clear}
        isEmpty={(data) => data.items.length === 0}
        failure="Problems could not be loaded"
        empty={
          <NothingYet
            title="No submissions yet"
            description="This person has not submitted to any problem in this Space."
            href={base}
            action="Back to submissions"
          />
        }
      >
        {(data) => (
          <>
            <div className="vd-tablewrap">
              <table className="vd-table">
                <caption className="vd-sr">Problems {member?.user.display_name ?? username} has attempted</caption>
                <thead>
                  <tr>
                    <SortHeader {...sort({ asc: 'name' })}>Problem</SortHeader>
                    <th scope="col">Track</th>
                    <SortHeader numeric {...sort({ desc: 'attempts' })}>
                      Attempts
                    </SortHeader>
                    <th scope="col">Best verdict</th>
                    <th scope="col">Last verdict</th>
                    <SortHeader {...sort({ desc: 'last_submission' })}>Last submission</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const href = reviewPath(space.slug, 'members', username, row.problem.slug);
                    return (
                      <ClickableRow key={row.problem.slug} href={href}>
                        <td>
                          <Link href={href} className="vd-link">
                            {row.problem.title}
                          </Link>{' '}
                          <RowText className="vd-mono vd-muted">{row.problem.slug}</RowText>
                        </td>
                        <td>
                          {row.track ? <Badge>{row.track.name}</Badge> : <RowText className="vd-muted">None</RowText>}
                        </td>
                        <td className="is-num vd-mono">
                          <RowText>{row.attempts}</RowText>
                        </td>
                        <td>{row.best_verdict ? <VerdictBadge verdict={row.best_verdict} format="auto" /> : dash}</td>
                        <td>{row.last_verdict ? <VerdictBadge verdict={row.last_verdict} format="auto" /> : dash}</td>
                        <td>
                          <When iso={row.last_submission_at} />
                        </td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={values.page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPage={(next) => set({ page: next })}
            />
          </>
        )}
      </TableState>
      <p className="text-small text-text-muted">
        Best verdict is the furthest a member got: Accepted if any submission passed, otherwise the verdict with the
        most testcases passed. Open the problem to see which testcase failed.
      </p>
    </>
  );
}
