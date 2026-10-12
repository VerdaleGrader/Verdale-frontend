'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { buttonVariants } from '@/components/ui/button';
import { ClickableRow, RowText } from '@/components/ui/clickable-row';
import { Dropdown } from '@/components/ui/dropdown';
import { FilterChips } from '@/components/ui/filter-chips';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { StatSummary } from '@/components/ui/stat-summary';
import { Skeleton } from '@/components/states/states';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VerdictInfo } from '@/components/grader/verdict-info';
import { FINAL_VERDICTS, VERDICTS } from '@/components/grader/verdict';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { LANGUAGE_LABELS, LANGUAGE_OPTIONS } from '@/features/problems/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { formatMemory, formatTime } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { param, useDebouncedText, useUrlQuery } from '@/lib/use-url-query';
import { reviewApi, type SpaceSubmissionRow } from '../../api/review.api';
import { displayVerdict } from '../../verdicts';
import { factsLine, useProblemFacts } from './problem-facts';
import {
  FilterBar,
  NothingYet,
  OPTION_ALL,
  SearchField,
  SummaryCard,
  TableState,
  Unavailable,
  When,
  isMissing,
  reviewPath,
  shortId,
  sortProps,
  useLastSuccess,
  useTrackOptions,
} from './review-parts';

const PAGE_SIZE = 20;
const SORTS = ['newest', 'oldest', 'member', 'tests_passed', 'time'] as const;
type Sort = (typeof SORTS)[number];

const VERDICT_CODES = ['all', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'OLE', 'ISE'] as const;
const LANGUAGES = ['all', 'c', 'cpp', 'python'] as const;

// Search, verdict, Track, language, version, sort and page are all in the URL; defaults are left out.
const QUERY = {
  q: param.text(),
  verdict: param.oneOf(VERDICT_CODES, 'all'),
  track: param.text(OPTION_ALL),
  language: param.oneOf(LANGUAGES, 'all'),
  version: param.text(OPTION_ALL),
  sort: param.oneOf(SORTS, 'newest'),
  page: param.page(),
};

const VERDICT_OPTIONS = [
  { value: 'all', label: 'All verdicts' },
  ...FINAL_VERDICTS.map((verdict) => ({ value: verdict, label: VERDICTS[verdict].label })),
];
const LANGUAGE_FILTER_OPTIONS = [{ value: 'all', label: 'All languages' }, ...LANGUAGE_OPTIONS];
const SORT_OPTIONS_PROBLEM = [
  { value: 'newest', label: 'Submitted, newest' },
  { value: 'member', label: 'Member, A to Z' },
  { value: 'tests_passed', label: 'Testcases passed, most' },
  { value: 'time', label: 'Time, fastest' },
];
const SORT_OPTIONS_MEMBER = [
  { value: 'newest', label: 'Submitted, newest' },
  { value: 'oldest', label: 'Submitted, oldest' },
  { value: 'tests_passed', label: 'Testcases passed, most' },
  { value: 'time', label: 'Time, fastest' },
];

/**
 * "Wrong answer on testcase 4", "Running testcase 7 of 20". Judging stops at the first failed testcase, so that is
 * the one after those that passed.
 */
function rowDetail(row: SpaceSubmissionRow): string | undefined {
  const next = (row.tests_passed ?? 0) + 1;
  if (row.status === 'running' && row.tests_total)
    return `Running testcase ${Math.min(next, row.tests_total)} of ${row.tests_total}`;
  if (
    row.status === 'completed' &&
    row.verdict &&
    ['WA', 'TLE', 'MLE', 'RE', 'OLE'].includes(row.verdict) &&
    row.tests_total
  ) {
    return `${VERDICTS[row.verdict].label} on testcase ${next}`;
  }
  return undefined;
}

/** Submissions in rows, newest first by default. A row opens the submission; its `#id` link is the keyboard target. */
export function SubmissionRows({
  rows,
  slug,
  showMember,
  sort,
  onSort,
}: {
  rows: SpaceSubmissionRow[];
  slug: string;
  showMember: boolean;
  sort: Sort;
  onSort: (sort: Sort) => void;
}) {
  const header = (keys: { desc?: Sort; asc?: Sort }) => sortProps(sort, keys, onSort);
  return (
    <div className="vd-tablewrap">
      <table className="vd-table">
        <caption className="vd-sr">Submissions</caption>
        <thead>
          <tr>
            <th scope="col">Submission</th>
            <SortHeader {...header({ desc: 'newest', asc: 'oldest' })}>Submitted</SortHeader>
            {showMember && <SortHeader {...header({ asc: 'member' })}>Member</SortHeader>}
            <th scope="col">Verdict</th>
            <SortHeader numeric {...header({ desc: 'tests_passed' })}>
              Testcases
            </SortHeader>
            <SortHeader numeric {...header({ asc: 'time' })}>
              Time
            </SortHeader>
            <th scope="col" className="is-num">
              Memory
            </th>
            <th scope="col">Language</th>
            <th scope="col">Track</th>
            <th scope="col">Version</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = reviewPath(slug, row.id);
            const ran = row.status === 'completed' && row.verdict !== 'CE';
            return (
              <ClickableRow key={row.id} href={href}>
                <td>
                  <Link href={href} className="vd-link vd-mono">
                    {shortId(row.id)}
                  </Link>
                </td>
                <td>
                  <When iso={row.created_at} />
                </td>
                {showMember && (
                  <td>
                    <span className="vd-inline">
                      <Avatar name={row.member.display_name} src={row.member.avatar_url} size="sm" />
                      <RowText>{row.member.display_name}</RowText>
                    </span>
                  </td>
                )}
                <td>
                  <VerdictBadge verdict={displayVerdict(row)} detail={rowDetail(row)} format="auto" />
                </td>
                <td className="is-num vd-mono">
                  <RowText className={row.tests_total === null ? 'vd-muted' : undefined}>
                    {row.tests_total === null ? '—' : `${row.tests_passed ?? 0} / ${row.tests_total}`}
                  </RowText>
                </td>
                <td className="is-num vd-mono">
                  <RowText className={ran && row.time_ms !== null ? undefined : 'vd-muted'}>
                    {ran && row.time_ms !== null ? formatTime(row.time_ms) : '—'}
                  </RowText>
                </td>
                <td className="is-num vd-mono">
                  <RowText className={ran && row.memory_kb !== null ? undefined : 'vd-muted'}>
                    {ran && row.memory_kb !== null ? formatMemory(row.memory_kb) : '—'}
                  </RowText>
                </td>
                <td>
                  <RowText>{LANGUAGE_LABELS[row.language]}</RowText>
                </td>
                <td>
                  {row.track ? <Badge>{row.track.name}</Badge> : <RowText className="vd-muted italic">None</RowText>}
                </td>
                <td>
                  <RowText className="vd-mono">v{row.version}</RowText>
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const columns = (showMember: boolean) => [
  { header: 'Submission', width: 56 },
  { header: 'Submitted', width: 80 },
  ...(showMember ? [{ header: 'Member', width: 120 }] : []),
  { header: 'Verdict', width: 104 },
  { header: 'Testcases', numeric: true, width: 48 },
  { header: 'Time', numeric: true, width: 48 },
  { header: 'Memory', numeric: true, width: 48 },
  { header: 'Language', width: 64 },
  { header: 'Track', width: 88 },
  { header: 'Version', width: 32 },
];

function Facts({ parts }: { parts: Array<string | { mono: string }> }) {
  return (
    <span className="text-small text-text-muted">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && ' · '}
          {typeof part === 'string' ? part : <span className="vd-mono">{part.mono}</span>}
        </span>
      ))}
    </span>
  );
}

/**
 * The flat submissions table for one problem: everyone's (`mode="problem"`, optionally inside one Track) or one
 * person's (`mode="member"`). Filters, search, sort and page live in the URL.
 */
export function ProblemSubmissionsView({ mode }: { mode: 'problem' | 'member' }) {
  const params = useParams<{ problemSlug: string; username?: string }>();
  const { problemSlug } = params;
  const username = mode === 'member' ? params.username : undefined;
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const { values, set } = useUrlQuery(QUERY);
  const [draft, setDraft] = useDebouncedText(values.q, (q) => set({ q }));
  const tracks = useTrackOptions(space.slug);
  const track = mode === 'problem' && tracks.known(values.track) ? values.track : OPTION_ALL;
  const facts = useProblemFacts(space.slug, problemSlug);

  const versions = useApiQuery(
    () => reviewApi.versions(space, problemSlug).catch(() => ({ items: [] as number[] })),
    `versions-${space.slug}-${problemSlug}-${auth.status}`
  );
  const versionList = versions.status === 'success' ? versions.data.items : [];
  const version =
    versionList.length === 0 || versionList.includes(Number(values.version)) ? values.version : OPTION_ALL;
  const versionOptions = [
    { value: OPTION_ALL, label: 'All versions' },
    ...versionList.map((number) => ({
      value: String(number),
      label: `Version ${number}${facts.problem?.version_number === number ? ' (current)' : ''}`,
    })),
  ];

  const query = useApiQuery(
    () =>
      reviewApi.list(space, {
        member: username,
        problem: problemSlug,
        q: mode === 'problem' ? values.q : undefined,
        track,
        verdict: values.verdict === 'all' ? undefined : values.verdict,
        language: values.language === 'all' ? undefined : values.language,
        version: version === OPTION_ALL ? undefined : Number(version),
        sort: values.sort,
        page: values.page,
        pageSize: PAGE_SIZE,
      }),
    JSON.stringify(['problem-submissions', space.slug, problemSlug, username, values, track, version, auth.status])
  );
  const page = useLastSuccess(query);

  // The people and numbers in the header.
  const rollup = useApiQuery(
    async () => {
      if (mode === 'member') {
        const result = await reviewApi.memberProblems(space, username!, { q: problemSlug, page: 1, pageSize: 10 });
        return {
          member: result.member,
          mine: result.items.find((item) => item.problem.slug === problemSlug) ?? null,
          problem: null,
          trackRow: null,
        };
      }
      if (track !== OPTION_ALL && track !== 'none') {
        const result = await reviewApi.trackProblems(space, track, { q: problemSlug });
        return {
          member: null,
          mine: null,
          problem: null,
          trackRow: result.items.find((item) => item.problem.slug === problemSlug) ?? null,
        };
      }
      const result = await reviewApi.byProblem(space, { q: problemSlug, page: 1, pageSize: 10 });
      return {
        member: null,
        mine: null,
        problem: result.items.find((item) => item.problem.slug === problemSlug) ?? null,
        trackRow: null,
      };
    },
    JSON.stringify(['problem-rollup', space.slug, problemSlug, username, track, auth.status])
  );
  const header = useLastSuccess(rollup);
  const title =
    facts.problem?.title ??
    header?.problem?.problem.title ??
    header?.trackRow?.problem.title ??
    header?.mine?.problem.title ??
    problemSlug;

  const base = reviewPath(space.slug);
  const trackName = track !== OPTION_ALL && track !== 'none' ? tracks.nameOf(track) : null;

  if (query.status === 'error' && isMissing(query.error)) {
    return (
      <Unavailable
        title="These submissions aren’t available"
        description="The problem or person may not exist, or your role doesn’t let you see them."
        href={base}
        action="Back to submissions"
      />
    );
  }

  const chips = [
    mode === 'problem' && values.q && { key: 'q', label: `Search: “${values.q}”` },
    values.verdict !== 'all' && { key: 'verdict', label: `Verdict: ${VERDICTS[values.verdict].label}` },
    track !== OPTION_ALL && { key: 'track', label: `Track: ${tracks.nameOf(track)}` },
    values.language !== 'all' && { key: 'language', label: `Language: ${LANGUAGE_LABELS[values.language]}` },
    version !== OPTION_ALL && { key: 'version', label: `Version: ${version}` },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));
  const clear = () => set({ q: '', verdict: 'all', track: OPTION_ALL, language: 'all', version: OPTION_ALL });
  const remove = (key: string) => set({ [key]: QUERY[key as keyof typeof QUERY].default });

  const crumbs =
    mode === 'member'
      ? [
          { label: 'Submissions', href: base },
          { label: 'By member', href: base },
          {
            label: header?.member?.user.display_name ?? username,
            href: reviewPath(space.slug, 'members', username!),
          },
          { label: title },
        ]
      : trackName
        ? [
            { label: 'Submissions', href: base },
            { label: 'By track', href: `${base}?group=track` },
            { label: trackName, href: reviewPath(space.slug, 'tracks', track) },
            { label: title },
          ]
        : [
            { label: 'Submissions', href: base },
            { label: 'By problem', href: `${base}?group=problem` },
            { label: title },
          ];

  const problemHref = `/spaces/${space.slug}/problems/${problemSlug}`;
  const total = query.status === 'success' ? query.data.total : page?.total;
  const sortOptions = mode === 'member' ? SORT_OPTIONS_MEMBER : SORT_OPTIONS_PROBLEM;
  const line = factsLine(problemSlug, facts, { split: mode === 'member' });
  const tracksLine = header?.problem?.tracks
    ? header.problem.tracks.length === 0
      ? 'Not in any track'
      : `In ${header.problem.tracks.length} ${header.problem.tracks.length === 1 ? 'track' : 'tracks'}: ${header.problem.tracks.map((item) => item.name).join(', ')}`
    : null;

  return (
    <>
      <Breadcrumb items={crumbs} />

      {mode === 'member' ? (
        <SummaryCard label="Context">
          <div className="flex flex-wrap items-center gap-4">
            <span className="vd-inline">
              <Avatar
                name={header?.member?.user.display_name ?? username ?? ''}
                src={header?.member?.user.avatar_url}
                size="md"
              />
              <span className="font-medium">{header?.member?.user.display_name ?? username}</span>
            </span>
            <span aria-hidden className="text-border-strong">
              on
            </span>
            <div className="flex flex-col">
              <h2 className="text-h2">{title}</h2>
              <Facts parts={line} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {header?.mine?.best_verdict && (
              <VerdictBadge
                verdict={header.mine.best_verdict}
                detail={
                  header.mine.solved
                    ? `Solved · ${header.mine.attempts} ${header.mine.attempts === 1 ? 'attempt' : 'attempts'}`
                    : `Not solved yet · ${header.mine.attempts} ${header.mine.attempts === 1 ? 'attempt' : 'attempts'}`
                }
              />
            )}
            <Link href={problemHref} className={buttonVariants({ size: 'sm' })}>
              Open problem
            </Link>
          </div>
        </SummaryCard>
      ) : (
        <SummaryCard label="Problem summary">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-h2">{title}</h2>
            <Facts parts={tracksLine ? [...line, tracksLine] : line} />
          </div>
          {header && (header.problem || header.trackRow) ? (
            <StatSummary
              stats={[
                { label: 'Tried', value: (header.problem ?? header.trackRow!).tried },
                { label: 'Solved', value: (header.problem ?? header.trackRow!).solved, tone: 'brand' },
                { label: 'Submissions', value: (header.problem ?? header.trackRow!).submissions },
              ]}
            />
          ) : (
            <Skeleton width={200} height={28} />
          )}
          <div className="flex gap-2">
            <Link href={problemHref} className={buttonVariants({ size: 'sm' })}>
              Open problem
            </Link>
            {abilities.canEditProblems && (
              <Link href={`${problemHref}/edit`} className={buttonVariants({ size: 'sm' })}>
                Edit problem
              </Link>
            )}
            {!abilities.canEditProblems && abilities.canAuthorProblems && (
              <Link href={`${problemHref}/edit/tests`} className={buttonVariants({ size: 'sm' })}>
                <Lock aria-hidden className="size-3.5" />
                View testcases
              </Link>
            )}
          </div>
        </SummaryCard>
      )}

      <FilterBar label="Filter submissions">
        {mode === 'problem' && (
          <SearchField
            placeholder="Member name or username"
            value={draft}
            onChange={setDraft}
            className="max-w-[280px] flex-[1_1_220px]"
          />
        )}
        <Dropdown
          label="Verdict"
          className={mode === 'member' ? 'w-[200px]' : 'w-[180px]'}
          options={VERDICT_OPTIONS}
          value={values.verdict}
          onValueChange={(verdict) => set({ verdict: verdict as (typeof VERDICT_CODES)[number] })}
        />
        {mode === 'problem' && (
          <Dropdown
            label="Track"
            className="w-[180px]"
            options={tracks.options}
            value={track}
            onValueChange={(next) => set({ track: next })}
          />
        )}
        <Dropdown
          label="Language"
          className="w-[160px]"
          options={LANGUAGE_FILTER_OPTIONS}
          value={values.language}
          onValueChange={(language) => set({ language: language as (typeof LANGUAGES)[number] })}
        />
        <Dropdown
          label={mode === 'member' ? 'Problem version' : 'Version'}
          className={mode === 'member' ? 'w-[160px]' : 'w-[150px]'}
          options={versionOptions}
          value={version}
          onValueChange={(next) => set({ version: next })}
        />
        <Dropdown
          label="Sort"
          className="w-[200px]"
          options={sortOptions}
          value={values.sort === 'oldest' && mode === 'problem' ? 'newest' : values.sort}
          onValueChange={(next) => set({ sort: next as Sort })}
        />
        {mode === 'member' && (
          <span className="ml-auto self-center">
            <VerdictInfo />
          </span>
        )}
      </FilterBar>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChips filters={chips} onRemove={remove} onClear={clear} />
        {mode === 'problem' && (
          <span className="text-small text-text-muted ml-auto inline-flex items-center gap-2">
            {total !== undefined && `${total} ${total === 1 ? 'submission' : 'submissions'}`}
            <VerdictInfo align="end" />
          </span>
        )}
      </div>

      <TableState
        query={query}
        columns={columns(mode === 'problem')}
        label="submissions"
        filtered={chips.length > 0}
        onClear={clear}
        isEmpty={(data) => data.items.length === 0}
        failure="Submissions could not be loaded"
        empty={
          <NothingYet
            title="No submissions yet"
            description="Submissions appear here once someone submits to this problem."
            href={base}
            action="Back to submissions"
          />
        }
      >
        {(data) => (
          <>
            <SubmissionRows
              rows={data.items}
              slug={space.slug}
              showMember={mode === 'problem'}
              sort={values.sort}
              onSort={(next) => set({ sort: next })}
            />
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
        Submissions keep the result of the problem version they were judged on.
        {mode === 'member' && ' Older versions were judged before the testcases changed.'}
      </p>
    </>
  );
}
