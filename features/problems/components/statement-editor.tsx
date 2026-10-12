'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { RadioGroup } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { problemsApi } from '../api/problems.api';
import { saveStateLabel, useAutosave } from '../hooks/use-autosave';
import {
  LANGUAGE_OPTIONS,
  kilobytesToMegabytes,
  megabytesToKilobytes,
  type Language,
  type ProblemConstraints,
  type ProblemEditor,
} from '../types';
import { ProblemReader } from './problem-reader';
import { StatementPdfPanel } from './statement-pdf-panel';
import { useProblemWorkspace } from './problem-workspace';

/** What the form holds. Numbers stay text while they are being typed. */
export interface StatementDraft {
  title: string;
  statement: string;
  mode: 'markdown' | 'pdf';
  timeLimitMs: string;
  memoryLimitMb: string;
  languages: Language[];
}

export function draftOf(editor: ProblemEditor): StatementDraft {
  const { version } = editor;
  return {
    title: version.title,
    statement: version.statement,
    mode: version.statement_mode,
    timeLimitMs: String(version.time_limit_ms),
    memoryLimitMb: String(kilobytesToMegabytes(version.memory_limit_kb)),
    languages: [...version.allowed_languages].sort(),
  };
}

export type DraftErrors = Partial<Record<'title' | 'timeLimitMs' | 'memoryLimitMb' | 'languages', string>>;

/** Mistakes we can see without asking Core, so they never leave the browser. */
export function validateDraft(draft: StatementDraft, constraints: ProblemConstraints): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.title.trim()) errors.title = 'Enter a title.';
  else if (draft.title.trim().length > constraints.title_max_length) {
    errors.title = `Use at most ${constraints.title_max_length} characters.`;
  }
  const time = Number(draft.timeLimitMs);
  const { min: timeMin, max: timeMax } = constraints.time_limit_ms;
  if (draft.timeLimitMs.trim() === '' || !Number.isInteger(time))
    errors.timeLimitMs = 'Use a whole number of milliseconds.';
  else if (time < timeMin || time > timeMax) errors.timeLimitMs = `Use between ${timeMin} and ${timeMax} ms.`;
  const memory = Number(draft.memoryLimitMb);
  const memoryMin = Math.ceil(constraints.memory_limit_kb.min / 1024);
  const memoryMax = Math.floor(constraints.memory_limit_kb.max / 1024);
  if (draft.memoryLimitMb.trim() === '' || !Number.isInteger(memory))
    errors.memoryLimitMb = 'Use a whole number of megabytes.';
  else if (memory < memoryMin || memory > memoryMax)
    errors.memoryLimitMb = `Use between ${memoryMin} and ${memoryMax} MB.`;
  if (draft.languages.length === 0) errors.languages = 'Allow at least one language.';
  return errors;
}

/** Only what changed, in the shape Core expects. */
export function patchOf(draft: StatementDraft, saved: StatementDraft) {
  return {
    ...(draft.title.trim() !== saved.title ? { title: draft.title.trim() } : {}),
    ...(draft.statement !== saved.statement ? { statement: draft.statement } : {}),
    ...(draft.mode !== saved.mode ? { statement_mode: draft.mode } : {}),
    ...(draft.timeLimitMs !== saved.timeLimitMs ? { time_limit_ms: Number(draft.timeLimitMs) } : {}),
    ...(draft.memoryLimitMb !== saved.memoryLimitMb
      ? { memory_limit_kb: megabytesToKilobytes(Number(draft.memoryLimitMb)) }
      : {}),
    ...(draft.languages.join() !== saved.languages.join() ? { allowed_languages: draft.languages } : {}),
  };
}

const SERVER_FIELDS: Record<string, keyof DraftErrors | 'statement'> = {
  title: 'title',
  statement: 'statement',
  statement_mode: 'statement',
  time_limit_ms: 'timeLimitMs',
  memory_limit_kb: 'memoryLimitMb',
  allowed_languages: 'languages',
};

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
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const constraints = editor.constraints;
  const readOnly = !editor.editable;

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

  function toggleLanguage(language: Language) {
    const has = draft.languages.includes(language);
    set(
      'languages',
      (has ? draft.languages.filter((item) => item !== language) : [...draft.languages, language]).sort()
    );
  }

  async function insertImage(file: File) {
    setImageError(null);
    try {
      const uploaded = await problemsApi.uploadImage(target, file);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '') || 'figure';
      const markdown = `![${alt}](${uploaded.url})`;
      const area = textarea.current;
      const start = area?.selectionStart ?? draft.statement.length;
      const end = area?.selectionEnd ?? draft.statement.length;
      const before = draft.statement.slice(0, start);
      const needsBreak = before.length > 0 && !before.endsWith('\n') ? '\n\n' : '';
      const next = `${before}${needsBreak}${markdown}\n${draft.statement.slice(end)}`;
      set('statement', next);
      toast({ tone: 'success', title: 'Image added', description: 'It is inserted in the statement.' });
    } catch (caught) {
      setImageError(caught instanceof ApiError ? (caught.fieldError('file') ?? caught.message) : errorMessage(caught));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
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

      <section aria-labelledby="details-heading" className="flex flex-col gap-4">
        <h2 id="details-heading" className="text-h2">
          Details
        </h2>
        <TextField
          label="Title"
          value={draft.title}
          maxLength={constraints.title_max_length}
          disabled={readOnly}
          error={error('title')}
          onChange={(event) => set('title', event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Time limit (ms)"
            mono
            inputMode="numeric"
            value={draft.timeLimitMs}
            disabled={readOnly}
            hint={`Per testcase, ${constraints.time_limit_ms.min} to ${constraints.time_limit_ms.max} ms.`}
            error={error('timeLimitMs')}
            onChange={(event) => set('timeLimitMs', event.target.value)}
          />
          <TextField
            label="Memory limit (MB)"
            mono
            inputMode="numeric"
            value={draft.memoryLimitMb}
            disabled={readOnly}
            hint={`Per testcase, ${Math.ceil(constraints.memory_limit_kb.min / 1024)} to ${Math.floor(constraints.memory_limit_kb.max / 1024)} MB.`}
            error={error('memoryLimitMb')}
            onChange={(event) => set('memoryLimitMb', event.target.value)}
          />
        </div>
        <fieldset className="flex flex-col gap-2" disabled={readOnly}>
          <legend className="vd-label">Allowed languages</legend>
          <div className="flex flex-wrap gap-4">
            {LANGUAGE_OPTIONS.filter((option) => constraints.languages.includes(option.value)).map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={draft.languages.includes(option.value)}
                onCheckedChange={() => toggleLanguage(option.value)}
              />
            ))}
          </div>
          {error('languages') && (
            <p className="vd-hint vd-hint--error" role="alert">
              {error('languages')}
            </p>
          )}
        </fieldset>
      </section>

      <section aria-labelledby="statement-heading" className="flex flex-col gap-3">
        <h2 id="statement-heading" className="text-h2">
          Statement
        </h2>
        <RadioGroup
          aria-label="Statement format"
          value={draft.mode}
          disabled={readOnly}
          onValueChange={(value) => set('mode', value === 'pdf' ? 'pdf' : 'markdown')}
          options={[
            { value: 'markdown', label: 'Markdown', description: 'Write the statement here, with maths and images.' },
            { value: 'pdf', label: 'PDF', description: 'Upload a PDF. Solvers read it on the problem page.' },
          ]}
        />
        {error('statement') && draft.mode === 'pdf' && (
          <p className="vd-hint vd-hint--error" role="alert">
            {error('statement')}
          </p>
        )}
        {draft.mode === 'pdf' ? (
          <>
            <StatementPdfPanel readOnly={readOnly} onChanged={() => setEdits((current) => omitKey(current, 'mode'))} />
            <p className="text-small text-text-muted">
              Examples come from the sample testcases and are shown below the PDF. Mark testcases as samples on the
              Testcases tab.
            </p>
            <div
              className="border-border bg-surface min-w-0 rounded-md border p-4"
              aria-label="Preview as a solver sees it"
            >
              <SolverPreview draft={draft} editor={editor} />
            </div>
          </>
        ) : (
          <>
            {editor.version.statement_pdf && (
              <p className="text-small text-text-muted">
                A PDF is still attached to this draft. Choose PDF to use it again.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              <Button size="sm" disabled={readOnly} onClick={() => fileInput.current?.click()}>
                <ImagePlus aria-hidden />
                Insert image
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept={constraints.images.content_types.join(',')}
                className="vd-sr"
                tabIndex={-1}
                aria-label="Choose an image to insert"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void insertImage(file);
                }}
              />
            </div>
            {imageError && (
              <p role="alert" className="vd-hint vd-hint--error">
                {imageError}
              </p>
            )}
            <p className="text-small text-text-muted">
              Markdown with maths: write <code className="vd-mono">$a + b$</code> inline or{' '}
              <code className="vd-mono">$$ … $$</code> on its own lines. Images come from “Insert image” (PNG, JPEG or
              WebP, up to {Math.round(constraints.images.max_bytes / (1024 * 1024))} MB).
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={cn(view === 'write' ? 'block' : 'hidden', 'min-w-0 lg:block')}>
                <TextField
                  label="Statement (Markdown)"
                  multiline
                  rows={22}
                  mono
                  value={draft.statement}
                  disabled={readOnly}
                  error={error('statement')}
                  onChange={(event) => set('statement', event.target.value)}
                  textareaRef={textarea}
                />
              </div>
              <div
                className={cn(
                  view === 'preview' ? 'block' : 'hidden',
                  'border-border bg-surface min-w-0 rounded-md border p-4 lg:block'
                )}
                aria-label="Preview as a solver sees it"
              >
                <SolverPreview draft={draft} editor={editor} />
              </div>
            </div>
          </>
        )}
      </section>

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
  mode: 'statement',
  timeLimitMs: 'timeLimitMs',
  memoryLimitMb: 'memoryLimitMb',
  languages: 'languages',
};

function omitKey<T extends object>(value: T, key: keyof T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as Partial<T>;
}

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
      authorAvatarUrl={editor.created_by.avatar_url}
      timeLimitMs={Number.isFinite(time) && time > 0 ? time : editor.version.time_limit_ms}
      memoryLimitKb={
        Number.isFinite(memory) && memory > 0 ? megabytesToKilobytes(memory) : editor.version.memory_limit_kb
      }
      statement={draft.statement}
      statementMode={draft.mode}
      pdf={
        editor.version.statement_pdf
          ? {
              target,
              draft: true,
              version: editor.version.statement_pdf.sha256,
              sizeBytes: editor.version.statement_pdf.size_bytes,
            }
          : null
      }
      samples={samples ?? []}
      samplesNote={
        samples === null
          ? 'Loading examples…'
          : 'Mark a testcase as a sample on the Testcases tab to show an example here.'
      }
    />
  );
}
