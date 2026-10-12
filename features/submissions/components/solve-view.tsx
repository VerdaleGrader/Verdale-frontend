'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditorFrame } from '@/components/grader/code-editor-frame';
import { CodeEditor } from '@/components/code/code-editor';
import { PageContainer } from '@/components/layout/page';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { buttonVariants } from '@/components/ui/button';
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
import { useSubmissionLive } from '../hooks/use-submission-live';
import { LiveStatus } from './live-status';

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
    return (
      <PageContainer narrow>
        {notFound ? (
          <EmptyState
            title="Problem not found"
            description="It may not exist, may not be published yet, or may be in a private Space you are not a member of."
            action={
              <Link href={`/spaces/${space.slug}`} className={buttonVariants({ variant: 'secondary' })}>
                Back to {space.name}
              </Link>
            }
          />
        ) : (
          <ErrorState error={problem.error} onRetry={problem.reload} />
        )}
      </PageContainer>
    );
  }
  return <ProblemPage problem={problem.data} target={target} />;
}

function ProblemPage({ problem, target }: { problem: Problem; target: ProblemTarget }) {
  const { space, abilities } = useSpace();
  const { auth } = useAuth();
  const base = `/spaces/${space.slug}/problems/${problem.slug}`;
  return (
    <PageContainer tight className="max-w-7xl">
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
            <Link href={`${base}/submissions`} className="vd-link">
              Your submissions
            </Link>
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
            authorAvatarUrl={problem.created_by.avatar_url}
            timeLimitMs={problem.time_limit_ms}
            memoryLimitKb={problem.memory_limit_kb}
            statement={problem.statement}
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

  // The latest submission of mine, so a refresh does not lose the result.
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    submissionsApi.list(target, { scope: 'mine', page: 1, pageSize: 1 }).then(
      (page) => {
        const latestOne = page.items[0];
        if (!cancelled && latestOne) setCurrent((existing) => existing ?? fromSummary(latestOne));
      },
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [loggedIn, target]);

  const live = useSubmissionLive(current?.id ?? null, current);
  const submission = live.submission ?? current;
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

  const base = `/spaces/${target.slug}/problems/${target.problemSlug}`;
  return (
    <div className="flex flex-col gap-3">
      <CodeEditorFrame
        languages={languages.map((value) => ({ value, label: LANGUAGE_LABELS[value] }))}
        language={language}
        onLanguageChange={(event) => changeLanguage(event.target.value as Language)}
        onSubmit={() => void submit()}
        submitting={submitting}
        submitLabel={
          waiting ? 'Waiting for the result…' : loggedIn || auth.status === 'loading' ? 'Submit' : 'Log in to submit'
        }
        submitDisabled={waiting}
        status={
          <div className="flex flex-col gap-3">
            {error && (
              <p role="alert" className="bg-danger-soft text-danger text-small rounded-md p-3">
                {error}
              </p>
            )}
            {submission ? (
              <LiveStatus
                submission={submission}
                connection={live.connection}
                detailHref={`${base}/submissions/${submission.id}`}
              />
            ) : (
              <p className="text-small text-text-muted">
                {open
                  ? loggedIn
                    ? 'Submit your solution to see the result here.'
                    : 'Log in to submit a solution. Your code is kept in this browser until then.'
                  : 'Submissions are closed.'}
              </p>
            )}
          </div>
        }
      >
        <CodeEditor
          value={code}
          onChange={editCode}
          language={language}
          label={`${LANGUAGE_LABELS[language]} source code`}
          height={roomy ? 440 : 280}
          plain={!roomy}
          onSubmit={() => void submit()}
        />
      </CodeEditorFrame>
      {!roomy && (
        <p className="text-small text-text-muted">
          Writing code is easier on a larger screen, but you can read the problem, submit and follow the result here.
        </p>
      )}
    </div>
  );
}
