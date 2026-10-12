'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageContainer, PageHeader } from '@/components/layout/page';
import { EmptyState } from '@/components/states/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { problemsApi } from '../api/problems.api';
import { suggestProblemSlug } from '../slug';

/** Starts a draft with a title and a slug; everything else is filled in the editor. */
export function CreateProblemForm() {
  useRequireAuth();
  const { space, abilities } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const problem = await problemsApi.create(space.slug, { slug, title, statement: '' });
      toast({ tone: 'success', title: 'Draft created', description: 'Write the statement, then add testcases.' });
      router.push(`/spaces/${space.slug}/problems/${problem.slug}/edit`);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) setError(caught);
      else toast({ tone: 'danger', title: 'Could not create the problem', description: errorMessage(caught) });
      setSaving(false);
    }
  }

  const slugError = error?.fieldError('slug') ?? (error?.status === 409 ? error.message : undefined);

  return (
    <PageContainer narrow>
      <PageHeader
        title="New problem"
        description={`It starts as a draft in ${space.name}. Nobody else can see it until you publish it.`}
      />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Title"
          value={title}
          maxLength={200}
          required
          error={error?.fieldError('title')}
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
          hint="The address of the problem inside this Space: 2 to 64 lower-case letters, digits, “-” or “_”. It cannot be changed later."
          error={slugError}
          onChange={(event) => {
            setSlug(event.target.value.toLowerCase());
            setSlugEdited(true);
          }}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={saving || !title.trim() || slug.length < 2}>
            {saving ? 'Creating…' : 'Create draft'}
          </Button>
          <Button type="button" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
