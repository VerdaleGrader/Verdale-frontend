'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditorFrame } from '@/components/grader/code-editor-frame';
import { CodeEditor } from '@/components/code/code-editor';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { SubmissionTable } from '@/components/grader/submission-table';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { problemsApi, type ProblemTarget } from '@/features/problems/api/problems.api';
import { ProblemReader } from '@/features/problems/components/problem-reader';
import { LANGUAGE_LABELS, type Language, type Problem } from '@/features/problems/types';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { readStored, writeStored } from '@/lib/safe-storage';
import { useApiQuery } from '@/lib/use-api-query';
import { useMediaQuery } from '@/lib/use-media-query';
import { submissionsApi, type Submission, type SubmissionSummary } from '../api/submissions.api';
import { STARTER_CODE, codeStorageKey, languageStorageKey } from '../code-templates';
import { useMySubmissions } from '../hooks/use-my-submissions';
import { useSubmissionLive } from '../hooks/use-submission-live';
import { ResultPanel } from './result-panel';
import { SubmissionsTab } from './submissions-tab';
import { toRow } from './submission-history';

/** A summary (what creating or listing returns) in the shape the live view works with. */
export function fromSummary(summary: SubmissionSummary): Submission {
  return { ...summary, compile_message: null, error_code: null, results: [], can_rejudge: false };
}

/** What to tell the person when Core refuses a submission, in words that say what to do. */
export function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      // Core's message ends with "Try again in N seconds."; the limit itself is in the contract.
      const seconds = /(\d+) seconds?/.exec(error.message)?.[1];
      return `You can submit at most 10 times a minute. ${seconds ? `Try again in ${seconds} seconds.` : 'Wait a moment and try again.'}`;
    }
    if (error.status === 400) return error.fieldError('source') ?? error.fieldError('language') ?? error.message;
    if (
      error.status === 409 &&
      (error.errorCode === 'PROBLEM_NOT_OPEN' || error.errorCode === 'PROBLEM_NOT_PUBLISHED')
    ) {
      return error.message;
    }
    return error.message;
  }
  return errorMessage(error);
}

/** The problem page: the statement, and the editor to answer it, side by side where there is room. */
export function SolveView() {
  const { space } = useSpace();
  const { auth } = useAuth();
  const params = useParams<{ problemSlug: string }>();
  const target = useMemo(
    () => ({ slug: space.slug, problemSlug: params.problemSlug }),
    [space.slug, params.problemSlug]
  );
  const problem = useApiQuery(
    () => problemsApi.get(target),
    `problem-${target.slug}-${target.problemSlug}-${auth.status}`
  );

  if (problem.status === 'loading' || auth.status === 'loading') {
    return (
      <PageContainer>
        <Loading label="Loading the problem" />
      </PageContainer>
    );
  }
  if (problem.status === 'error') {
    const notFound = problem.error instanceof ApiError && problem.error.status === 404;
    return notFound ? (
      <ProblemNotAvailable target={target} />
    ) : (
      <PageContainer narrow>
        <ErrorState error={problem.error} onRetry={problem.reload} />
      </PageContainer>
    );
  }
  return <ProblemPage problem={problem.data} target={target} />;
}

/**
 * A problem Core answers 404 for: it does not exist, is not published, or is in no Track this
 * person can see (GRD-81, GRD-84). Someone who submitted to it before it was taken out of its last
 * Track still gets their history, with new submissions closed; everyone else sees plain "not found",
 * exactly as for a problem that does not exist.
 */
function ProblemNotAvailable({ target }: { target: ProblemTarget }) {
  const { space } = useSpace();
  const { auth } = useAuth();
  const base = `/spaces/${space.slug}/problems/${target.problemSlug}`;
  const loggedIn = auth.status === 'authenticated';
  const history = useApiQuery(
    () => (loggedIn ? submissionsApi.list(target, { scope: 'mine', page: 1, pageSize: 20 }) : Promise.resolve(null)),
    `removed-history-${target.slug}-${target.problemSlug}-${auth.status}`
  );
  if (history.status === 'loading') {
    return (
      <PageContainer narrow>
        <Loading label="Looking for your submissions" />
      </PageContainer>
    );
  }
  const items = history.status === 'success' ? (history.data?.items ?? []) : [];
  if (items.length === 0) {
    return (
      <PageContainer narrow>
        <EmptyState
          title="Problem not found"
          description="It may not exist, may not be published yet, or may not be in a Track you can see."
          action={
            <Link href={`/spaces/${space.slug}`} className={buttonVariants({ variant: 'secondary' })}>
              Back to {space.name}
            </Link>
          }
        />
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      <PageHeader
        title={items[0]!.problem.title}
        description="This problem is no longer in any Track you can see. You can still read your submissions, but new ones are closed."
        actions={
          // No Submit button here: there is no problem page to submit from, and a disabled button would
          // break the rule that Submit is only disabled while a submission is in flight (GRD-99).
          <Link href={`/spaces/${space.slug}`} className={buttonVariants({ variant: 'secondary' })}>
            Back to {space.name}
          </Link>
        }
      />
      <SubmissionTable rows={items.map((item) => toRow(item, base))} />
    </PageContainer>
  );
}

function ProblemPage({ problem, target }: { problem: Problem; target: ProblemTarget }) {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const base = `/spaces/${space.slug}/problems/${problem.slug}`;
  return (
    <PageContainer wide>
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${space.slug}`} className="vd-link">
          {space.name}
        </Link>
        <span aria-hidden>/</span>
        <span className="vd-mono">{problem.slug}</span>
        {auth.status === 'authenticated' && (
          <span className="ml-auto flex gap-4">
            {abilities.canAuthorProblems && (
              <Link href={`${base}/edit`} className="vd-link">
                Edit problem
              </Link>
            )}
          </span>
        )}
      </nav>

      {problem.status === 'draft' && (
        <p role="status" className="bg-warning-soft text-warning text-small rounded-md p-3">
          This is a preview of a draft: solvers cannot see it yet, and nothing can be submitted.
        </p>
      )}
      {problem.status === 'archived' && (
        <p role="status" className="bg-surface-sunken text-small text-text-muted rounded-md p-3">
          This problem is archived. You can read it, but it no longer takes new submissions.
        </p>
      )}
      {problem.status === 'published' && !problem.accepts_submissions && (
        <p role="status" className="bg-warning-soft text-warning text-small rounded-md p-3">
          This Space is archived, so nothing can be submitted.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <ProblemReader
            title={problem.title}
            spaceName={space.name}
            author={problem.created_by.display_name}
            versionLabel={problem.version_label}
            timeLimitMs={problem.time_limit_ms}
            memoryLimitKb={problem.memory_limit_kb}
            statement={problem.statement}
            statementMode={problem.statement_mode}
            statementPdf={problem.statement_pdf}
            samples={problem.samples}
          />
        </div>
        <div className="min-w-0 lg:sticky lg:top-4">
          <SolvePanel problem={problem} target={target} />
        </div>
      </div>
    </PageContainer>
  );
}

const SAVE_DELAY_MS = 500;

/** Why nothing can be submitted, said after the click instead of by a disabled button. */
function closedMessage(problem: Problem, spaceArchived: boolean): string {
  if (problem.status === 'draft') return 'This problem is a draft. Nothing can be submitted until it is published.';
  if (problem.status === 'archived') return 'This problem is archived and no longer accepts submissions.';
  if (spaceArchived) return 'This Space is archived, so nothing can be submitted.';
  return 'Submissions are closed for this problem.';
}

function SolvePanel({ problem, target }: { problem: Problem; target: ProblemTarget }) {
  const { auth, expire } = useAuth();
  const { space } = useSpace();
  const router = useRouter();
  const pathname = usePathname();
  const roomy = useMediaQuery('(min-width: 768px)');
  const languages = problem.allowed_languages;
  const key = (lang: Language) => codeStorageKey(target.slug, target.problemSlug, lang);
  // This panel only exists once the problem has loaded in the browser, so reading
  // what this browser remembers while choosing the first state is safe.
  const [language, setLanguage] = useState<Language>(() => {
    const remembered = readStored(languageStorageKey(target.slug, target.problemSlug)) as Language | null;
    return remembered && languages.includes(remembered) ? remembered : (languages[0] ?? 'cpp');
  });
  const [code, setCode] = useState(() => readStored(key(language)) ?? STARTER_CODE[language]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Submission | undefined>();
  const [tab, setTab] = useState<'code' | 'submissions'>('code');
  // The submission whose code was loaded into the editor, while the editor still holds exactly that code.
  const [loadedFrom, setLoadedFrom] = useState<{ number: number; source: string } | null>(null);
  const showToast = useToast();
  const loggedIn = auth.status === 'authenticated';
  const open = problem.accepts_submissions;

  // Remember what is typed, shortly after typing stops.
  const latest = useRef({ code, language });
  useEffect(() => {
    latest.current = { code, language };
  });
  // Typing updates the ref at once, so a submit that follows right away sends exactly what is in the editor.
  const editCode = useCallback((value: string) => {
    latest.current = { ...latest.current, code: value };
    setCode(value);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => writeStored(key(language), code), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, language]);

  const live = useSubmissionLive(current?.id ?? null, current);
  const submission = live.submission ?? current;
  // My submissions follow the latest one: a new submission, then its result, start the list again.
  const mine = useMySubmissions(target, loggedIn, `${submission?.id ?? 'none'}-${submission?.status ?? 'none'}`);
  // So a refresh does not lose the result: the latest of mine is the one under the editor.
  useEffect(() => {
    const latestOne = mine.items[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopts the list's latest once it has loaded
    if (latestOne) setCurrent((existing) => existing ?? fromSummary(latestOne));
  }, [mine.items]);
  // The button is the same in every state except while a submission is on its way or being judged.
  const waiting = submission !== undefined && submission.status !== 'completed';

  const changeLanguage = useCallback(
    (next: Language) => {
      writeStored(key(latest.current.language), latest.current.code);
      writeStored(languageStorageKey(target.slug, target.problemSlug), next);
      setLanguage(next);
      setCode(readStored(key(next)) ?? STARTER_CODE[next]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target.slug, target.problemSlug]
  );

  const submit = useCallback(async () => {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (submitting || waiting) return;
    if (!open) {
      setError(closedMessage(problem, space.archived_at !== null));
      return;
    }
    setSubmitting(true);
    setError(null);
    setLoadedFrom(null);
    try {
      const created = await submissionsApi.create(target, { language, source: latest.current.code });
      setCurrent(fromSummary(created));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        expire();
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(submitErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }, [loggedIn, open, submitting, waiting, problem, space.archived_at, target, language, router, pathname, expire]);

  /** Puts an earlier submission's code in the editor; nothing is submitted. The toast can undo it. */
  const replaceCode = useCallback(
    async (summary: SubmissionSummary) => {
      try {
        const full = await submissionsApi.get(summary.id);
        if (full.source === undefined) throw new Error('The code of this submission is not available.');
        const before = { ...latest.current, loadedFrom };
        if (full.language !== latest.current.language) changeLanguage(full.language);
        editCode(full.source);
        setLoadedFrom({ number: summary.number, source: full.source });
        setError(null);
        setTab('code');
        showToast({
          tone: 'success',
          title: `Code replaced with submission #${summary.number}`,
          description: 'Your previous code is kept until you leave this page.',
          action: (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (before.language !== latest.current.language) changeLanguage(before.language);
                editCode(before.code);
                setLoadedFrom(before.loadedFrom);
              }}
            >
              Undo
            </Button>
          ),
        });
      } catch (caught) {
        setError(errorMessage(caught));
        setTab('code');
      }
    },
    [changeLanguage, editCode, loadedFrom, showToast]
  );

  const base = `/spaces/${target.slug}/problems/${target.problemSlug}`;
  const codeTab = (
    <div className="flex flex-col gap-4">
      <CodeEditorFrame
        languages={languages.map((value) => ({ value, label: LANGUAGE_LABELS[value] }))}
        language={language}
        onLanguageChange={(next) => changeLanguage(next as Language)}
        onSubmit={() => void submit()}
        submitting={submitting}
        submitLabel={
          waiting ? 'Waiting for the result…' : loggedIn || auth.status === 'loading' ? 'Submit' : 'Log in to submit'
        }
        submitDisabled={waiting}
      >
        <div>
          {loadedFrom !== null && code === loadedFrom.source && (
            <div className="border-border bg-primary-soft flex flex-wrap items-center gap-2 border-b px-3 py-2 text-[13px] leading-[18px]">
              <span className="font-medium">Loaded from submission #{loadedFrom.number}</span>
              <span className="text-text-muted">Not submitted yet. Submit to judge this version again.</span>
            </div>
          )}
          <CodeEditor
            value={code}
            onChange={editCode}
            language={language}
            label={`${LANGUAGE_LABELS[language]} source code`}
            height={roomy ? 440 : 280}
            plain={!roomy}
            onSubmit={() => void submit()}
          />
        </div>
      </CodeEditorFrame>
      {!roomy && (
        <p className="text-small text-text-muted">
          Writing code is easier on a larger screen, but you can read the problem, submit and follow the result here.
        </p>
      )}
      {error && (
        <p role="alert" className="bg-danger-soft text-danger text-small rounded-md p-3">
          {error}
        </p>
      )}
      {loggedIn ? (
        <ResultPanel
          submission={submission}
          connection={live.connection}
          detailHref={`${base}/submissions/${submission?.id ?? ''}`}
          samples={problem.samples}
          closed={!open}
        />
      ) : (
        <p className="text-small text-text-muted">
          {open
            ? 'Log in to submit a solution. Your code is kept in this browser until then.'
            : 'Submissions are closed.'}
        </p>
      )}
    </div>
  );

  if (!loggedIn) return codeTab;
  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as 'code' | 'submissions')} className="flex flex-col gap-4">
      <TabsList aria-label="Workspace">
        <TabsTrigger value="code">Code</TabsTrigger>
        <TabsTrigger value="submissions" count={mine.total}>
          Submissions
        </TabsTrigger>
      </TabsList>
      <TabsContent value="code">{codeTab}</TabsContent>
      <TabsContent value="submissions">
        <SubmissionsTab
          best={mine.best}
          items={mine.items}
          total={mine.total}
          loaded={mine.loaded}
          error={mine.error}
          loadingMore={mine.loadingMore}
          onLoadMore={() => void mine.loadMore()}
          onReplace={(summary) => void replaceCode(summary)}
          canReplace={(language) => languages.includes(language)}
          detailBase={`${base}/submissions`}
        />
      </TabsContent>
    </Tabs>
  );
}
