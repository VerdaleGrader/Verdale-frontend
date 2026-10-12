'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { problemsApi } from '../api/problems.api';
import { suggestProblemSlug, validateProblemSlug } from '../slug';
import { kilobytesToMegabytes, megabytesToKilobytes, type ProblemConstraints } from '../types';
import { ProblemReader } from './problem-reader';
import { validateDraft, type StatementDraft } from './statement-draft';
import { DetailsFields, MarkdownStatementField } from './statement-fields';

const SLUG_CHECK_DELAY_MS = 400;

function initialDraft(constraints: ProblemConstraints): StatementDraft {
  return {
    title: '',
    statement: '',
    timeLimitMs: String(constraints.time_limit_ms.default),
    memoryLimitMb: String(kilobytesToMegabytes(constraints.memory_limit_kb.default)),
    languages: [...constraints.languages].sort(),
  };
}

/**
 * The create page (GRD-72): title and slug at the top, then the same fields as the editor. Nothing exists
 * until the first Save, which creates the draft with everything on the page in one request and opens the
 * editor. Leaving before that leaves nothing behind.
 */
export function CreateProblemForm() {
  useRequireAuth();
  const { space, abilities } = useSpace();
  const constraints = useApiQuery(() => problemsApi.constraints(), 'problem-constraints');

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
  if (constraints.status === 'loading') {
    return (
      <PageContainer wide>
        <Loading label="Loading the editor" />
      </PageContainer>
    );
  }
  if (constraints.status === 'error') {
    return (
      <PageContainer narrow>
        <ErrorState error={constraints.error} onRetry={constraints.reload} />
      </PageContainer>
    );
  }
  return <CreateProblemPage constraints={constraints.data} />;
}

function CreateProblemPage({ constraints }: { constraints: ProblemConstraints }) {
  const { space } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<StatementDraft>(() => initialDraft(constraints));
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [taken, setTaken] = useState<string | null>(null);

  const dirty = draft.title !== '' || draft.statement !== '' || slug !== '';
  const localErrors = validateDraft(draft, constraints);
  const slugProblem = slug ? validateProblemSlug(slug) : undefined;

  // Ask whether the slug is free while the person types, so a clash shows before Save.
  useEffect(() => {
    if (!slug || slugProblem) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      problemsApi.get({ slug: space.slug, problemSlug: slug }).then(
        () => !cancelled && setTaken(slug),
        () => undefined // 404 means free; any other failure is left for Save to report
      );
    }, SLUG_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug, slugProblem, space.slug]);

  // Leaving with typed work and no draft: the browser asks first.
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  const serverFor = (field: string) => error?.fieldError(field);
  const fieldError = (key: keyof typeof localErrors) => {
    // Stay quiet about an empty form; mistakes show once the person has typed something.
    if (!dirty) return undefined;
    const serverField = {
      title: 'title',
      timeLimitMs: 'time_limit_ms',
      memoryLimitMb: 'memory_limit_kb',
      languages: 'allowed_languages',
    }[key];
    return (key === 'title' && draft.title === '' ? undefined : localErrors[key]) ?? serverFor(serverField);
  };

  const slugError =
    slugProblem ??
    (taken === slug ? 'A problem with this slug already exists in this Space.' : undefined) ??
    serverFor('slug') ??
    (error?.status === 409 ? error.message : undefined);
  const canSave =
    !saving && draft.title.trim() !== '' && slug !== '' && !slugError && Object.keys(localErrors).length === 0;

  const preview = useMemo(
    () => (
      <ProblemReader
        title={draft.title}
        spaceName={space.name}
        timeLimitMs={Number(draft.timeLimitMs) > 0 ? Number(draft.timeLimitMs) : constraints.time_limit_ms.default}
        memoryLimitKb={
          Number(draft.memoryLimitMb) > 0
            ? megabytesToKilobytes(Number(draft.memoryLimitMb))
            : constraints.memory_limit_kb.default
        }
        statement={draft.statement}
        samples={[]}
        samplesNote="Sample testcases are added on the Testcases tab after the first save."
      />
    ),
    [draft, space.name, constraints]
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const created = await problemsApi.create(space.slug, {
        slug,
        title: draft.title.trim(),
        statement: draft.statement,
        time_limit_ms: Number(draft.timeLimitMs),
        memory_limit_kb: megabytesToKilobytes(Number(draft.memoryLimitMb)),
        allowed_languages: draft.languages,
      });
      toast({
        tone: 'success',
        title: 'Draft saved',
        description: 'Add testcases and a reference solution, then publish.',
      });
      router.replace(`/spaces/${space.slug}/problems/${created.slug}/edit`);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not save the draft', description: errorMessage(caught) });
      setSaving(false);
    }
  }

  return (
    <PageContainer wide>
      <PageHeader
        title="New problem"
        description={`It starts as a draft in ${space.name}. Nobody else can see it until you publish it.`}
      />
      <form onSubmit={save} className="flex flex-col gap-6" noValidate>
        <DetailsFields
          draft={draft}
          constraints={constraints}
          readOnly={false}
          error={fieldError}
          onChange={(key, value) => {
            setDraft((current) => ({ ...current, [key]: value }));
            setError(null);
            if (key === 'title' && !slugEdited) setSlug(suggestProblemSlug(String(value)));
          }}
          slug={
            <TextField
              label="Slug"
              mono
              value={slug}
              maxLength={64}
              required
              hint="The address of the problem inside this Space: 2 to 64 lower-case letters, digits, “-” or “_”. Once the draft is saved the slug is locked and cannot be changed, because links and submissions point at it."
              error={slugError}
              onChange={(event) => {
                setSlug(event.target.value.toLowerCase());
                setSlugEdited(true);
                setError(null);
              }}
            />
          }
        />
        <MarkdownStatementField
          statement={draft.statement}
          constraints={constraints}
          readOnly={false}
          error={serverFor('statement')}
          onChange={(value) => setDraft((current) => ({ ...current, statement: value }))}
          preview={preview}
          imageDisabledReason="Pictures and a PDF statement can be added after the first save."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={!canSave}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
          <p className="text-small text-text-muted">The draft is created when you save, not before.</p>
        </div>
      </form>
    </PageContainer>
  );
}
