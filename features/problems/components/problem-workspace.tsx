'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CircleCheck, CircleDashed, Eye } from 'lucide-react';
import { PageContainer } from '@/components/layout/page';
import { TabNav } from '@/components/layout/tab-nav';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/features/auth/hooks/auth-provider';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { isUnauthorized, useApiQuery } from '@/lib/use-api-query';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import { STATUS_LABELS, type ProblemEditor } from '../types';

interface WorkspaceValue {
  target: ProblemTarget;
  editor: ProblemEditor;
  /** Replace the editor view with a fresher one (after a save, a test upload, …). */
  setEditor: (next: ProblemEditor) => void;
  /** Ask Core again, e.g. after tests or solutions changed. */
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useProblemWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useProblemWorkspace must be used inside <ProblemWorkspace>');
  return value;
}

/** Exported for tests, which render panels without loading a problem. */
export { WorkspaceContext };

const TONE = { draft: 'warning', published: 'brand', archived: 'neutral' } as const;

/**
 * The authoring workspace of one problem: header, publish checklist and the
 * Statement / Tests / Solutions tabs. Only the staff (owner, administrator, editor, observer) get in; Core
 * answers 403 to everyone else and this shows why.
 */
export function ProblemWorkspace({ children }: { children: React.ReactNode }) {
  useRequireAuth();
  const { space, abilities } = useSpace();
  const { auth, expire } = useAuth();
  const params = useParams<{ problemSlug: string }>();
  const target = useMemo(
    () => ({ slug: space.slug, problemSlug: params.problemSlug }),
    [space.slug, params.problemSlug]
  );
  const loaded = useApiQuery(
    () => problemsApi.editor(target),
    `editor-${target.slug}-${target.problemSlug}-${auth.status}`
  );
  const [override, setOverride] = useState<{ source: ProblemEditor; next: ProblemEditor } | null>(null);

  // A session Core no longer accepts: let the rest of the app know.
  const sessionGone = loaded.status === 'error' && isUnauthorized(loaded.error);
  useEffect(() => {
    if (sessionGone) expire();
  }, [sessionGone, expire]);

  const setEditor = useCallback(
    (next: ProblemEditor) => {
      if (loaded.status === 'success') setOverride({ source: loaded.data, next });
    },
    [loaded]
  );

  // Quiet refresh: fetch again and swap the data in, without the loading screen
  // that would throw away what a tab below is holding (typed text, chosen files).
  const refresh = useCallback(async () => {
    try {
      setEditor(await problemsApi.editor(target));
    } catch {
      /* the next action shows the real error */
    }
  }, [target, setEditor]);

  if (loaded.status === 'loading' || auth.status === 'loading') {
    return (
      <PageContainer>
        <Loading label="Loading the problem" />
      </PageContainer>
    );
  }
  if (loaded.status === 'error') {
    const status = loaded.error instanceof ApiError ? loaded.error.status : 0;
    return (
      <PageContainer narrow>
        {status === 403 || status === 404 ? (
          <EmptyState
            title={status === 403 ? 'Only the Space’s staff can open the editor' : 'Problem not found'}
            description={
              status === 403
                ? 'You can read published problems and solve them, but changing them is for the people who run this Space.'
                : 'It may have been deleted, or the address is wrong.'
            }
            action={
              <Link href={`/spaces/${space.slug}`} className={buttonVariants({ variant: 'secondary' })}>
                Back to {space.name}
              </Link>
            }
          />
        ) : (
          <ErrorState error={loaded.error} onRetry={loaded.reload} />
        )}
      </PageContainer>
    );
  }

  // A fresher copy set by a save wins until the next load replaces it.
  const fresh = override && override.source === loaded.data ? override.next : loaded.data;
  // Observers open the editor to read drafts and hidden testcases, but cannot change anything.
  const editor = { ...fresh, editable: fresh.editable && abilities.canEditProblems };
  const base = `/spaces/${space.slug}/problems/${editor.slug}`;
  const tabs = [
    { href: `${base}/edit`, label: 'Statement' },
    { href: `${base}/edit/tests`, label: 'Testcases', count: editor.tests.count },
    { href: `${base}/edit/solutions`, label: 'Solutions', count: editor.solutions.count },
  ];

  return (
    <WorkspaceContext.Provider value={{ target, editor, setEditor, refresh }}>
      <PageContainer wide>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-mono-label text-text-muted">
              <Link href={`/spaces/${space.slug}`} className="vd-link">
                {space.slug}
              </Link>{' '}
              / {editor.slug}
            </p>
            <h1 className="text-h1 break-words">{editor.version.title}</h1>
            <span className="flex flex-wrap items-center gap-1.5">
              <Badge tone={TONE[editor.status]}>{STATUS_LABELS[editor.status]}</Badge>
              <Badge>Version {editor.version.number}</Badge>
            </span>
          </div>
          <Link href={base} className={buttonVariants({ variant: 'secondary' })}>
            <Eye aria-hidden />
            {editor.status === 'draft' ? 'Preview as solver' : 'View as solver'}
          </Link>
        </header>

        {!editor.editable && <ReadOnlyNotice editor={editor} />}
        <PublishPanel />
        <TabNav items={tabs} label="Problem sections" />
        {children}
      </PageContainer>
    </WorkspaceContext.Provider>
  );
}

function ReadOnlyNotice({ editor }: { editor: ProblemEditor }) {
  const { abilities } = useSpace();
  const text = abilities.archived
    ? 'This Space is archived, so its problems are read-only.'
    : !abilities.canEditProblems
      ? 'You can read everything here as an observer, but only owners, administrators and editors can change problems.'
      : editor.status === 'archived'
        ? 'This problem is archived and cannot be changed.'
        : 'This version is published and can no longer be changed. Solvers always see the version they submitted to.';
  return (
    <p role="status" className="bg-surface-sunken text-small text-text-muted rounded-md p-3">
      {text}
    </p>
  );
}

/** The checklist that decides whether the draft can be published, and the button. */
export function PublishPanel() {
  const { target, editor, setEditor } = useProblemWorkspace();
  const { abilities } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<'publish' | 'archive' | null>(null);

  async function publish() {
    setBusy(true);
    setBlocked([]);
    try {
      const next = await problemsApi.publish(target);
      setEditor(next);
      toast({ tone: 'success', title: 'Published', description: 'Solvers can see and submit to this problem now.' });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.errorCode === 'PUBLISH_BLOCKED') {
        setBlocked((caught.details ?? []).map((detail) => detail.message));
      } else {
        toast({ tone: 'danger', title: 'Could not publish', description: errorMessage(caught) });
      }
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  async function archive() {
    setBusy(true);
    try {
      setEditor(await problemsApi.archive(target));
      toast({
        tone: 'success',
        title: 'Archived',
        description: 'The problem stays readable but takes no new submissions.',
      });
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not archive', description: errorMessage(caught) });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  if (editor.status === 'archived' || !abilities.canEditProblems) return null;

  if (editor.version.status === 'published') {
    return (
      <section
        aria-label="Publishing"
        className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
      >
        <p className="text-small">
          <CircleCheck className="text-success mr-1.5 inline size-4" strokeWidth={1.75} aria-hidden />
          Published. Solvers can read it and submit solutions.
        </p>
        {abilities.canEditProblems && (
          <Button variant="destructive" size="sm" onClick={() => setConfirming('archive')} disabled={busy}>
            Archive
          </Button>
        )}
        <Dialog
          open={confirming === 'archive'}
          onClose={() => setConfirming(null)}
          title={`Archive “${editor.version.title}”?`}
          description="It stays readable and old submissions are kept, but nobody can submit new solutions."
          footer={
            <>
              <Button onClick={() => setConfirming(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={archive} disabled={busy}>
                {busy ? 'Archiving…' : 'Archive problem'}
              </Button>
            </>
          }
        />
      </section>
    );
  }

  const done = editor.publish_checks.filter((check) => check.ok).length;
  return (
    <section
      aria-labelledby="publish-heading"
      className="border-border bg-surface flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="publish-heading" className="text-body-strong">
          Before you publish ({done} of {editor.publish_checks.length} ready)
        </h2>
        <Button
          variant="primary"
          size="sm"
          disabled={!editor.can_publish || busy || !abilities.canEditProblems}
          onClick={() => setConfirming('publish')}
        >
          Publish
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {editor.publish_checks.map((check) => (
          <li key={check.key} className="text-small flex items-start gap-2">
            {check.ok ? (
              <CircleCheck className="text-success mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-label="Done" />
            ) : (
              <CircleDashed
                className="text-text-muted mt-0.5 size-4 shrink-0"
                strokeWidth={1.75}
                aria-label="Still to do"
              />
            )}
            <span className={check.ok ? 'text-text-muted' : undefined}>{check.message}</span>
          </li>
        ))}
      </ul>
      {blocked.length > 0 && (
        <div role="alert" className="bg-danger-soft text-small rounded-md p-3">
          <p className="text-danger text-body-strong">Core says it is not ready:</p>
          <ul className="list-disc pl-5">
            {blocked.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <Dialog
        open={confirming === 'publish'}
        onClose={() => setConfirming(null)}
        title={`Publish “${editor.version.title}”?`}
        description="The statement, limits, testcases and solutions of this version are frozen once it is published. Solvers will see the statement and the sample testcases only."
        footer={
          <>
            <Button onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={publish} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish'}
            </Button>
          </>
        }
      />
    </section>
  );
}
