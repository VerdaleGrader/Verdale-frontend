'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { problemsApi } from '../api/problems.api';
import { saveStateLabel, useAutosave } from '../hooks/use-autosave';
import { megabytesToKilobytes, type ProblemEditor } from '../types';
import {
  SERVER_FIELDS,
  draftOf,
  patchOf,
  validateDraft,
  type DraftErrors,
  type StatementDraft,
} from './statement-draft';
import { PdfStatementPanel, StatementFormat } from './pdf-statement-panel';
import { ProblemReader } from './problem-reader';
import { DetailsFields, MarkdownStatementField } from './statement-fields';
import { useProblemWorkspace } from './problem-workspace';

export { draftOf, patchOf, validateDraft } from './statement-draft';
export type { DraftErrors, StatementDraft } from './statement-draft';

/** The Statement tab: title, limits, languages, and the Markdown with a live preview. */
export function StatementEditor() {
  const { target, editor, setEditor } = useProblemWorkspace();
  const { space } = useSpace();
  const router = useRouter();
  const toast = useToast();
  const saved = useMemo(() => draftOf(editor), [editor]);
  // What the person has typed on top of the server copy. Everything else follows the server.
  const [edits, setEdits] = useState<Partial<StatementDraft>>({});
  const draft = useMemo<StatementDraft>(() => ({ ...saved, ...edits }), [saved, edits]);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  // Picking PDF before a file exists only opens the upload panel; Core switches the mode when the upload lands.
  const [pdfPicked, setPdfPicked] = useState(false);
  const constraints = editor.constraints;
  const readOnly = !editor.editable;
  const shownMode = pdfPicked && !editor.version.statement_pdf ? 'pdf' : editor.version.statement_mode;

  const localErrors = validateDraft(draft, constraints);
  const valid = Object.keys(localErrors).length === 0;

  const autosave = useAutosave<StatementDraft>({
    value: draft,
    saved,
    enabled: editor.editable && valid,
    save: async (value) => {
      const patch = patchOf(value, saved);
      if (Object.keys(patch).length === 0) return;
      try {
        const next = await problemsApi.update(target, patch);
        setServerErrors({});
        setEditor(next);
        // Keep only what still differs from the server, so typing during the save is not lost.
        const fresh = draftOf(next);
        setEdits(
          (current) =>
            Object.fromEntries(
              Object.entries(current).filter(
                ([field, value]) => JSON.stringify(value) !== JSON.stringify(fresh[field as keyof StatementDraft])
              )
            ) as Partial<StatementDraft>
        );
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 400) {
          const fields: Record<string, string> = {};
          for (const detail of caught.details ?? []) {
            const key = SERVER_FIELDS[detail.field.split('.')[0] ?? ''];
            if (key) fields[key] = detail.message;
          }
          setServerErrors(fields);
          throw new Error('Check the highlighted fields.');
        }
        throw new Error(errorMessage(caught));
      }
    },
  });

  const set = <K extends keyof StatementDraft>(key: K, value: StatementDraft[K]) => {
    setEdits((current) => ({ ...current, [key]: value }));
    setServerErrors((current) =>
      SERVER_FIELD_BY_DRAFT[key] in current ? omit(current, SERVER_FIELD_BY_DRAFT[key]) : current
    );
  };
  const error = (key: keyof DraftErrors | 'statement') =>
    key === 'statement' ? serverErrors.statement : (localErrors[key] ?? serverErrors[key]);

  async function changeMode(mode: 'markdown' | 'pdf') {
    if (mode === 'pdf' && !editor.version.statement_pdf) {
      setPdfPicked(true);
      return;
    }
    setPdfPicked(false);
    if (mode === editor.version.statement_mode) return;
    setBusy(true);
    try {
      setEditor(await problemsApi.update(target, { statement_mode: mode }));
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not change the statement format', description: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    setBusy(true);
    try {
      await problemsApi.remove(target);
      toast({ tone: 'success', title: 'Draft deleted' });
      router.push(`/spaces/${space.slug}`);
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not delete the draft', description: errorMessage(caught) });
      setBusy(false);
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className={cn('text-small', autosave.state.kind === 'error' ? 'text-danger' : 'text-text-muted')}
        >
          {readOnly ? 'Read-only' : saveStateLabel(autosave.state, autosave.dirty)}
          {!readOnly && autosave.state.kind === 'error' && valid && (
            <>
              {' '}
              <Button size="sm" variant="link" onClick={() => void autosave.saveNow()}>
                Try again
              </Button>
            </>
          )}
        </p>
      </div>

      <DetailsFields
        draft={draft}
        constraints={constraints}
        readOnly={readOnly}
        error={error}
        onChange={set}
        slug={
          <TextField
            label="Slug"
            mono
            value={editor.slug}
            readOnly
            disabled
            hint="The address of this problem inside the Space. It was fixed when the draft was first saved and cannot be changed, because links and submissions point at it."
          />
        }
      />

      {shownMode === 'pdf' ? (
        <>
          <StatementFormat
            mode={shownMode}
            pdf={editor.version.statement_pdf}
            readOnly={readOnly}
            busy={busy}
            onMode={changeMode}
          />
          <PdfStatementPanel />
        </>
      ) : (
        <MarkdownStatementField
          format={
            <StatementFormat
              mode={shownMode}
              pdf={editor.version.statement_pdf}
              readOnly={readOnly}
              busy={busy}
              onMode={changeMode}
            />
          }
          statement={draft.statement}
          constraints={constraints}
          readOnly={readOnly}
          error={error('statement')}
          onChange={(value) => set('statement', value)}
          preview={<SolverPreview draft={draft} editor={editor} />}
          imageUpload={async (file) => {
            try {
              const uploaded = await problemsApi.uploadImage(target, file);
              const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '') || 'figure';
              toast({ tone: 'success', title: 'Image added', description: 'It is inserted in the statement.' });
              return `![${alt}](${uploaded.url})`;
            } catch (caught) {
              throw new Error(
                caught instanceof ApiError ? (caught.fieldError('file') ?? caught.message) : errorMessage(caught)
              );
            }
          }}
        />
      )}

      {editor.status === 'draft' && editor.editable && (
        <section aria-labelledby="danger-heading" className="border-border flex flex-col gap-3 border-t pt-6">
          <h2 id="danger-heading" className="text-h3">
            Delete this draft
          </h2>
          <p className="text-small text-text-muted">
            Removes the draft with its testcases and reference solutions. This cannot be undone. Once a problem is
            published it can only be archived.
          </p>
          <div>
            <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy}>
              Delete draft
            </Button>
          </div>
          <Dialog
            open={deleting}
            onClose={() => setDeleting(false)}
            title={`Delete “${editor.version.title}”?`}
            description="The draft, its testcases and its reference solutions are removed for good."
            footer={
              <>
                <Button onClick={() => setDeleting(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={deleteDraft} disabled={busy}>
                  {busy ? 'Deleting…' : 'Delete draft'}
                </Button>
              </>
            }
          />
        </section>
      )}
    </div>
  );
}

const SERVER_FIELD_BY_DRAFT: Record<keyof StatementDraft, string> = {
  title: 'title',
  statement: 'statement',
  timeLimitMs: 'timeLimitMs',
  memoryLimitMb: 'memoryLimitMb',
  languages: 'languages',
};

function omit(record: Record<string, string>, key: string) {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

/** The statement as a solver will read it, from what is in the form right now. The examples come from the sample tests. */
function SolverPreview({ draft, editor }: { draft: StatementDraft; editor: ProblemEditor }) {
  const { target } = useProblemWorkspace();
  const { space } = useSpace();
  const [samples, setSamples] = useState<Array<{ position: number; input: string; output: string }> | null>(null);
  const sampleCount = editor.tests.sample_count;

  useEffect(() => {
    let cancelled = false;
    problemsApi.get(target).then(
      (problem) => !cancelled && setSamples(problem.samples),
      () => !cancelled && setSamples([])
    );
    return () => {
      cancelled = true;
    };
    // Reload the examples when the number of sample tests changes.
  }, [target, sampleCount]);

  const time = Number(draft.timeLimitMs);
  const memory = Number(draft.memoryLimitMb);
  return (
    <ProblemReader
      title={draft.title}
      spaceName={space.name}
      author={editor.created_by.display_name}
      timeLimitMs={Number.isFinite(time) && time > 0 ? time : editor.version.time_limit_ms}
      memoryLimitKb={
        Number.isFinite(memory) && memory > 0 ? megabytesToKilobytes(memory) : editor.version.memory_limit_kb
      }
      statement={draft.statement}
      samples={samples ?? []}
      samplesNote={
        samples === null
          ? 'Loading examples…'
          : 'Mark a testcase as a sample on the Testcases tab to show an example here.'
      }
    />
  );
}
