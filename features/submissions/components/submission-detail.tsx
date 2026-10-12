'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PageContainer } from '@/components/layout/page';
import { CopyButton } from '@/components/grader/sample-io';
import { TestResultList } from '@/components/grader/test-result-list';
import { VERDICT_EXPLANATIONS } from '@/components/grader/verdict';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { LANGUAGE_LABELS } from '@/features/problems/types';
import { ApiError, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { submissionsApi, type Submission } from '../api/submissions.api';
import { useSubmissionLive } from '../hooks/use-submission-live';
import { COMPILE_PREVIEW_CHARS, displayVerdict, resultRows, sampleFeedback } from '../verdicts';
import { LiveStatus } from './live-status';

/** The full result of one submission, live until it finishes. */
export function SubmissionDetail() {
  const params = useParams<{ slug: string; problemSlug: string; submissionId: string }>();
  const { auth } = useAuth();
  const first = useApiQuery(
    () => submissionsApi.get(params.submissionId),
    `submission-${params.submissionId}-${auth.status}`
  );
  const back = `/spaces/${params.slug}/problems/${params.problemSlug}`;

  if (first.status === 'loading' || auth.status === 'loading') {
    return (
      <PageContainer>
        <Loading label="Loading the result" />
      </PageContainer>
    );
  }
  if (first.status === 'error') {
    const notFound = first.error instanceof ApiError && first.error.status === 404;
    return (
      <PageContainer narrow>
        {notFound ? (
          <EmptyState
            title="Submission not found"
            description="It may not exist, or it belongs to someone else. You can only open your own submissions, unless you are an owner or editor of the Space."
            action={
              <Link href={back} className={buttonVariants({ variant: 'secondary' })}>
                Back to the problem
              </Link>
            }
          />
        ) : (
          <ErrorState error={first.error} onRetry={first.reload} />
        )}
      </PageContainer>
    );
  }
  return <ResultView initial={first.data} back={back} />;
}

function ResultView({ initial, back }: { initial: Submission; back: string }) {
  const toast = useToast();
  const live = useSubmissionLive(initial.id, initial);
  const submission = live.submission ?? initial;
  const [checking, setChecking] = useState(false);
  const [fullCompile, setFullCompile] = useState(false);
  const verdict = displayVerdict(submission);
  const finished = submission.status === 'completed';
  const feedback = sampleFeedback(submission.results);
  const source = submission.source ?? initial.source ?? '';
  const compile = submission.compile_message ?? '';
  const longCompile = compile.length > COMPILE_PREVIEW_CHARS;

  async function checkAgain() {
    setChecking(true);
    try {
      const next = await submissionsApi.rejudge(submission.id);
      live.restart(next);
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not check it again', description: errorMessage(caught) });
    } finally {
      setChecking(false);
    }
  }

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="text-small text-text-muted flex flex-wrap items-center gap-1.5">
        <Link href={`/spaces/${submission.space.slug}`} className="vd-link">
          {submission.space.name}
        </Link>
        <span aria-hidden>/</span>
        <Link href={back} className="vd-link">
          {submission.problem.title}
        </Link>
        <span aria-hidden>/</span>
        <Link href={`${back}/submissions`} className="vd-link">
          Submissions
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-h1">Result</h1>
        <p className="text-small text-text-muted">
          {LANGUAGE_LABELS[submission.language]} · submitted {timeAgo(submission.created_at)} by{' '}
          <span className="vd-inline align-middle">
            <Avatar name={submission.author.display_name} src={submission.author.avatar_url} size="sm" />
            {submission.author.display_name}
          </span>
        </p>
      </header>

      <section
        aria-labelledby="outcome-heading"
        className="border-border bg-surface flex flex-col gap-4 rounded-md border p-4"
      >
        <h2 id="outcome-heading" className="sr-only">
          Outcome
        </h2>
        <LiveStatus submission={submission} connection={live.connection} />
        <p className="text-prose max-w-[var(--measure)]">{VERDICT_EXPLANATIONS[verdict]}</p>
        {submission.verdict === 'ISE' && submission.can_rejudge && (
          <div className="flex flex-col items-start gap-2">
            <Button variant="primary" onClick={checkAgain} disabled={checking}>
              {checking ? 'Queuing…' : 'Check again'}
            </Button>
            {submission.error_code && (
              <p className="text-small text-text-muted">Reference for support: {submission.error_code}</p>
            )}
          </div>
        )}
        {live.error && !finished && (
          <p role="alert" className="text-small text-danger">
            Could not refresh the status: {live.error.message}
          </p>
        )}
      </section>

      {submission.verdict === 'CE' && compile && (
        <section aria-labelledby="compile-heading" className="flex flex-col gap-2">
          <h2 id="compile-heading" className="text-h2">
            Compiler message
          </h2>
          <pre className="vd-io__pre border-border bg-surface-sunken rounded-md border" tabIndex={0}>
            {fullCompile || !longCompile ? compile : `${compile.slice(0, COMPILE_PREVIEW_CHARS)}\n…`}
          </pre>
          {longCompile && (
            <div>
              <Button size="sm" onClick={() => setFullCompile((value) => !value)}>
                {fullCompile ? 'Show less' : `Show the whole message (${compile.length} characters)`}
              </Button>
            </div>
          )}
        </section>
      )}

      {finished && submission.results.length > 0 && (
        <section aria-labelledby="tests-heading" className="flex flex-col gap-3">
          <h2 id="tests-heading" className="text-h2">
            Testcases
          </h2>
          <p className="text-small text-text-muted">
            Hidden testcases show a verdict, time and memory only. Their data is never shown.
          </p>
          <TestResultList rows={resultRows(submission.results)} />
          {feedback.map((result) => (
            <div
              key={result.position}
              className="border-border bg-surface-sunken text-small flex flex-col gap-1 rounded-md border p-3"
            >
              <p className="text-body-strong">Sample testcase {result.position}</p>
              {result.checker_message && <p>{result.checker_message}</p>}
              {result.stdout_preview && (
                <>
                  <p className="text-text-muted">The start of your output:</p>
                  <pre className="vd-mono whitespace-pre-wrap">{result.stdout_preview}</pre>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {source && (
        <section aria-labelledby="code-heading" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="code-heading" className="text-h2">
              Your code
            </h2>
            <CopyButton text={source} label="code" />
          </div>
          <pre
            className="vd-io__pre border-border bg-surface-sunken max-h-[32rem] overflow-auto rounded-md border"
            tabIndex={0}
          >
            {source}
          </pre>
        </section>
      )}

      <p className="text-small">
        <Link href={back} className="vd-link">
          Back to the problem
        </Link>
      </p>
    </PageContainer>
  );
}
