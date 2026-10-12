'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { ProblemStatement } from '@/components/grader/problem-statement';
import { MarkdownView } from '@/components/markdown/markdown-view';
import { EmptyState } from '@/components/states/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { problemsApi } from '../api/problems.api';
import { problemSlugError, suggestProblemSlug } from '../slug';

const SLUG_CHECK_DELAY_MS = 300;

/**
 * The create-problem page: title, slug and the statement in one place. Nothing
 * exists in Core until the first Save, which creates the draft in one request
 * and opens the editor; leaving before that leaves no draft behind.
 */
export function CreateProblemForm() {
  useRequireAuth();
  const { space, abilities } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [statement, setStatement] = useState('');
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // The slug Core was last asked about, and its answer.
  const [checked, setChecked] = useState<{ slug: string; taken: boolean } | null>(null);

  const localSlugError = problemSlugError(slug);

  // Ask the Space whether the slug is free a moment after typing stops.
  const canCheck = abilities.canCreateProblems && !localSlugError;
  useEffect(() => {
    if (!canCheck) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      problemsApi.slugTaken(space.slug, slug).then(
        (taken) => !cancelled && setChecked({ slug, taken }),
        // Not being able to ask is not a reason to stop the person: Core refuses a duplicate on Save anyway.
        () => undefined
      );
    }, SLUG_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canCheck, space.slug, slug]);

  // Typed work that is not saved yet: ask before the tab closes.
  const hasWork = !saved && Boolean(title || slug || statement);
  useEffect(() => {
    if (!hasWork) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasWork]);

  if (!abilities.canCreateProblems) {
    return (
      <PageContainer narrow>
        <EmptyState
          title="You cannot add problems here"
          description={
            abilities.archived
              ? 'This Space is archived, so problems are read-only.'
              : 'Only owners and editors of a Space can create problems.'
          }
          action={
            <Link href={`/spaces/${space.slug}`} className={buttonVariants({ variant: 'secondary' })}>
              Back to {space.name}
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const taken = checked?.slug === slug && checked.taken;
  const titleError = error?.fieldError('title') ?? (attempted && !title.trim() ? 'Enter a title.' : undefined);
  const slugError =
    error?.fieldError('slug') ??
    (error?.status === 409 ? error.message : undefined) ??
    (slug || attempted ? localSlugError : undefined) ??
    (taken ? 'This Space already has a problem with this slug. Pick another.' : undefined);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setError(null);
    if (!title.trim() || localSlugError || taken) return;
    setSaving(true);
    try {
      const problem = await problemsApi.create(space.slug, { slug, title: title.trim(), statement });
      setSaved(true);
      toast({ tone: 'success', title: 'Draft saved', description: 'Add testcases and a reference solution next.' });
      router.push(`/spaces/${space.slug}/problems/${problem.slug}/edit`);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not save the problem', description: errorMessage(caught) });
      setSaving(false);
    }
  }

  return (
    <PageContainer tight className="max-w-7xl">
      <PageHeader
        title="New problem"
        description={`It starts as a draft in ${space.name}. Nobody else can see it until you publish it.`}
      />
      <form onSubmit={save} className="flex flex-col gap-6" noValidate>
        <section aria-labelledby="details-heading" className="flex flex-col gap-4">
          <h2 id="details-heading" className="text-h2">
            Details
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Title"
              value={title}
              maxLength={200}
              required
              error={titleError}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugEdited) setSlug(suggestProblemSlug(event.target.value));
              }}
            />
            <TextField
              label="Slug"
              mono
              value={slug}
              maxLength={64}
              required
              hint="The address of the problem in this Space: 2 to 64 lower-case letters, digits, “-” or “_”. It is fixed when you save for the first time and cannot be changed afterwards."
              error={slugError}
              onChange={(event) => {
                setSlug(event.target.value.toLowerCase());
                setSlugEdited(true);
              }}
            />
          </div>
        </section>

        <section aria-labelledby="statement-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="statement-heading" className="text-h2">
              Statement
            </h2>
            <div className="flex gap-1 lg:hidden" role="group" aria-label="Editor view">
              <Button
                size="sm"
                variant={view === 'write' ? 'primary' : 'secondary'}
                aria-pressed={view === 'write'}
                onClick={() => setView('write')}
              >
                Write
              </Button>
              <Button
                size="sm"
                variant={view === 'preview' ? 'primary' : 'secondary'}
                aria-pressed={view === 'preview'}
                onClick={() => setView('preview')}
              >
                Preview
              </Button>
            </div>
          </div>
          <p className="text-small text-text-muted">
            Markdown with maths: write <code className="vd-mono">$a + b$</code> inline or{' '}
            <code className="vd-mono">$$ … $$</code> on its own lines. Pictures, limits, languages and testcases are
            added in the editor after the first save.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={cn(view === 'write' ? 'block' : 'hidden', 'min-w-0 lg:block')}>
              <TextField
                label="Statement (Markdown)"
                multiline
                rows={22}
                mono
                value={statement}
                error={error?.fieldError('statement')}
                onChange={(event) => setStatement(event.target.value)}
              />
            </div>
            <div
              className={cn(
                view === 'preview' ? 'block' : 'hidden',
                'border-border bg-surface min-w-0 rounded-md border p-4 lg:block'
              )}
              aria-label="Preview as a solver sees it"
            >
              <ProblemStatement title={title || 'Untitled problem'} space={space.name}>
                {statement.trim() ? (
                  <MarkdownView source={statement} />
                ) : (
                  <p className="text-text-muted">The statement is empty.</p>
                )}
              </ProblemStatement>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
          <p className="text-small text-text-muted">The draft is created when you save.</p>
        </div>
      </form>
    </PageContainer>
  );
}
