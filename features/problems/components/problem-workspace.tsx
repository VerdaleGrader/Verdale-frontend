'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CircleCheck, Eye } from 'lucide-react';
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
import { STATUS_LABELS, VERSION_STATUS_LABELS, type ProblemEditor } from '../types';
import { hasMajorDraft, isUpdatable } from '../versioning';
import { MajorDraftBanner } from './major-draft';
import { PublishGate } from './publish-gate';

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

const TONE = {
  draft: 'warning',
  verifying: 'info',
  verified: 'brand',
  published: 'brand',
  archived: 'neutral',
} as const;

/** One status for the header: Archived, or the state of the version (Draft, Verifying, Verified, Published). */
export function statusOf(editor: Pick<ProblemEditor, 'status' | 'version'>) {
  const key = editor.status === 'archived' ? 'archived' : editor.version.status;
  return { tone: TONE[key], label: key === 'archived' ? STATUS_LABELS.archived : VERSION_STATUS_LABELS[key] };
}

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
    { href: `${base}/edit/history`, label: 'History' },
  ];
  const status = statusOf(editor);

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
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge>{editor.version.label}</Badge>
              {hasMajorDraft(editor) && editor.open_version && (
                <Badge tone="brand">Open: {editor.open_version.label}</Badge>
              )}
            </span>
          </div>
          <Link href={base} className={buttonVariants({ variant: 'secondary' })}>
            <Eye aria-hidden />
            {editor.status === 'draft' ? 'Preview as solver' : 'View as solver'}
          </Link>
        </header>

        <MajorDraftBanner />
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
        : editor.version.status === 'verifying'
          ? 'Verification is running, so editing is paused until it finishes.'
          : isUpdatable(editor)
            ? 'Edit the statement, title, limits and languages on the Statement tab. Testcases and solutions change in a Major draft.'
            : 'This version is published and can no longer be changed. Solvers always see the version they submitted to.';
  return (
    <p role="status" className="bg-surface-sunken text-small text-text-muted rounded-md p-3">
      {text}
    </p>
  );
}

/** Archive for a published problem; verify, checklist and Publish for a draft. */
export function PublishPanel() {
  const { target, editor, setEditor } = useProblemWorkspace();
  const { abilities } = useSpace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
      setConfirming(false);
    }
  }

  if (editor.status === 'archived') return null;

  if (editor.version.status === 'published') {
    if (!abilities.canEditProblems) return null;
    return (
      <section
        aria-label="Publishing"
        className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
      >
        <p className="text-small">
          <CircleCheck className="text-success mr-1.5 inline size-4" strokeWidth={1.75} aria-hidden />
          Published as {editor.version.label}. Solvers can read it and submit solutions.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setConfirming(true)} disabled={busy}>
          Archive
        </Button>
        <Dialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title={`Archive “${editor.version.title}”?`}
          description="It stays readable and old submissions are kept, but nobody can submit new solutions."
          footer={
            <>
              <Button onClick={() => setConfirming(false)} disabled={busy}>
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

  return <PublishGate />;
}
