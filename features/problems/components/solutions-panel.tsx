'use client';

import { useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { CodeEditor } from '@/components/code/code-editor';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Dropdown } from '@/components/ui/dropdown';
import { useToast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { useRefreshableQuery } from '@/lib/use-api-query';
import { useMediaQuery } from '@/lib/use-media-query';
import { problemsApi } from '../api/problems.api';
import { LANGUAGE_LABELS, LANGUAGE_OPTIONS, formatBytes, type Language, type ReferenceSolution } from '../types';
import { useProblemWorkspace } from './problem-workspace';

/**
 * The Solutions tab: the author's reference solutions. Only owners and editors
 * can ever read these; Core never sends them anywhere else.
 */
export function SolutionsPanel() {
  const { target, editor, refresh } = useProblemWorkspace();
  const toast = useToast();
  const solutions = useRefreshableQuery(
    () => problemsApi.solutions(target),
    `solutions-${target.slug}-${target.problemSlug}`
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReferenceSolution | null>(null);
  const [removing, setRemoving] = useState<ReferenceSolution | null>(null);

  if (solutions.status === 'loading') return <Loading label="Loading reference solutions" />;
  if (solutions.status === 'error') return <ErrorState error={solutions.error} onRetry={solutions.reload} />;

  const items = solutions.data;
  const changed = async () => {
    await Promise.all([solutions.refetch(), refresh()]);
  };
  async function run(key: string, action: () => Promise<unknown>, failure: string) {
    setBusy(key);
    try {
      await action();
      await changed();
    } catch (caught) {
      toast({ tone: 'danger', title: failure, description: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-small text-text-muted max-w-[var(--measure)]">
        A reference solution proves the problem and its tests are right, and is needed before you can publish. Only
        owners and editors of this Space can see it. The primary solution is the one that is checked first.
      </p>

      <section aria-labelledby="solutions-heading" className="flex flex-col gap-3">
        <h2 id="solutions-heading" className="text-h2">
          Reference solutions
        </h2>
        {items.length === 0 ? (
          <EmptyState
            title="No reference solution yet"
            description="Add one below. The first one becomes the primary solution."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((solution) => (
              <li
                key={solution.id}
                className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-body-strong">{LANGUAGE_LABELS[solution.language]}</span>
                  <span className="text-small text-text-muted">{formatBytes(solution.source_bytes)}</span>
                  {solution.is_primary && (
                    <Badge tone="brand" icon={Star}>
                      Primary
                    </Badge>
                  )}
                  <span className="text-small text-text-muted">added by {solution.created_by.display_name}</span>
                </span>
                {editor.editable && (
                  <span className="flex flex-wrap gap-1">
                    {!solution.is_primary && (
                      <Button
                        size="sm"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `primary-${solution.id}`,
                            () => problemsApi.updateSolution(target, solution.id, { is_primary: true }),
                            'Could not change the primary solution'
                          )
                        }
                      >
                        Make primary
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setEditing(solution)}
                      aria-label={`Edit the ${LANGUAGE_LABELS[solution.language]} solution`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy !== null}
                      aria-label={`Delete the ${LANGUAGE_LABELS[solution.language]} solution`}
                      onClick={() => setRemoving(solution)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editor.editable && (
        <SolutionForm
          key={items.length}
          heading="Add a reference solution"
          submitLabel="Add solution"
          allowed={editor.constraints.languages}
          maxBytes={editor.constraints.source_max_bytes}
          primaryDefault={items.length === 0}
          onSubmit={async (value) => {
            await problemsApi.addSolution(target, value);
            await changed();
            toast({ tone: 'success', title: 'Reference solution added' });
          }}
        />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        size="lg"
        title={`Edit the ${editing ? LANGUAGE_LABELS[editing.language] : ''} solution`}
        description="Changes apply to the draft only."
      >
        {editing && (
          <SolutionForm
            key={editing.id}
            embedded
            heading=""
            submitLabel="Save solution"
            allowed={editor.constraints.languages}
            maxBytes={editor.constraints.source_max_bytes}
            initial={{ language: editing.language, source: editing.source }}
            onSubmit={async (value) => {
              await problemsApi.updateSolution(target, editing.id, { language: value.language, source: value.source });
              setEditing(null);
              await changed();
              toast({ tone: 'success', title: 'Solution saved' });
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Delete the ${removing ? LANGUAGE_LABELS[removing.language] : ''} solution?`}
        description={
          removing?.is_primary
            ? 'It is the primary solution. The problem cannot be published until you choose another primary one.'
            : 'This cannot be undone.'
        }
        footer={
          <>
            <Button onClick={() => setRemoving(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={async () => {
                const solution = removing!;
                setRemoving(null);
                await run(
                  `delete-${solution.id}`,
                  () => problemsApi.removeSolution(target, solution.id),
                  'Could not delete the solution'
                );
              }}
            >
              Delete solution
            </Button>
          </>
        }
      />
    </div>
  );
}

function SolutionForm({
  heading,
  submitLabel,
  allowed,
  maxBytes,
  initial,
  primaryDefault = false,
  embedded,
  onSubmit,
}: {
  heading: string;
  submitLabel: string;
  allowed: Language[];
  maxBytes: number;
  initial?: { language: Language; source: string };
  primaryDefault?: boolean;
  embedded?: boolean;
  onSubmit: (value: { language: Language; source: string; is_primary?: boolean }) => Promise<void>;
}) {
  const [language, setLanguage] = useState<Language>(initial?.language ?? allowed[0] ?? 'cpp');
  const [source, setSource] = useState(initial?.source ?? '');
  const [primary, setPrimary] = useState(primaryDefault);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const small = !useMediaQuery('(min-width: 768px)');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ language, source, ...(initial ? {} : { is_primary: primary }) });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.fieldError('source') ?? caught.fieldError('language') ?? caught.message)
          : errorMessage(caught)
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      {heading && <h2 className="text-h2">{heading}</h2>}
      <Dropdown
        label="Language"
        value={language}
        options={LANGUAGE_OPTIONS.filter((option) => allowed.includes(option.value))}
        onValueChange={(next) => setLanguage(next as Language)}
        className="max-w-xs"
      />
      <div className="border-border overflow-hidden rounded-md border">
        <CodeEditor
          value={source}
          onChange={setSource}
          language={language}
          label="Reference solution source code"
          height={embedded ? 320 : 280}
          plain={small}
        />
      </div>
      <p className="text-small text-text-muted">Up to {formatBytes(maxBytes)}.</p>
      {!initial && (
        <Checkbox
          label="Make this the primary solution"
          checked={primary}
          onCheckedChange={(next) => setPrimary(next === true)}
        />
      )}
      {error && (
        <p role="alert" className="vd-hint vd-hint--error">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={saving || source.trim() === ''}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
