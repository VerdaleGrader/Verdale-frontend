'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { ApiError, errorMessage } from '@/lib/api';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import {
  SERVER_FIELDS,
  draftOf,
  patchOf,
  validateDraft,
  type DraftErrors,
  type StatementDraft,
} from '../components/statement-draft';
import type { ProblemEditor, UpdateOutcome } from '../types';
import { conflictLabel, fieldLabel, predictUpdate, versionErrorMessage } from '../versioning';

/** What a reload after an edit conflict found: kept work, and what moved under it. */
export interface ReloadNotice {
  label: string;
  /** Fields (request names) the other person changed. */
  changed: string[];
  /** The ones among them that you also edited: your text wins on Save. */
  overlap: string[];
}

const DRAFT_FIELD: Record<keyof StatementDraft, string> = {
  title: 'title',
  statement: 'statement',
  timeLimitMs: 'time_limit_ms',
  memoryLimitMb: 'memory_limit_kb',
  languages: 'allowed_languages',
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The update form of a published problem: edits wait for Save, the expected type (Minor or Major) is predicted from
 * `constraints.version_fields`, Save sends `updatePublishedProblem` with `expected_version`, and an edit conflict
 * can be reloaded without losing what was typed. Core's outcome always wins over the prediction.
 */
export function useUpdateProblem({
  target,
  editor,
  setEditor,
  refresh,
}: {
  target: ProblemTarget;
  editor: ProblemEditor;
  setEditor: (next: ProblemEditor) => void;
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const saved = useMemo(() => draftOf(editor), [editor]);
  const [rawEdits, setEdits] = useState<Partial<StatementDraft>>({});
  const [force, setForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | undefined>();
  const [conflict, setConflict] = useState<{ label?: string; startedFrom: StatementDraft } | null>(null);
  const [notice, setNotice] = useState<ReloadNotice | null>(null);
  const [reloading, setReloading] = useState(false);

  // An edit that now equals the saved value is no edit (after a reload someone else may have made the same change).
  const edits = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(rawEdits).filter(([key, value]) => !same(value, saved[key as keyof StatementDraft]))
      ) as Partial<StatementDraft>,
    [rawEdits, saved]
  );
  const draft = useMemo<StatementDraft>(() => ({ ...saved, ...edits }), [saved, edits]);
  const localErrors = validateDraft(draft, editor.constraints);
  const valid = Object.keys(localErrors).length === 0;
  const patch = patchOf(draft, saved);
  const changed = Object.keys(patch);
  const prediction = predictUpdate(editor.constraints.version_fields, changed, force);
  const count = changed.length + (force ? 1 : 0);
  const dirty = count > 0;

  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  function set<K extends keyof StatementDraft>(key: K, value: StatementDraft[K]) {
    setEdits((current) => ({ ...current, [key]: value }));
    setServerErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key)));
    setSaveError(undefined);
  }

  function discard() {
    setEdits({});
    setForce(false);
    setServerErrors({});
    setSaveError(undefined);
    setNotice(null);
  }

  const error = (key: keyof DraftErrors | 'statement') =>
    key === 'statement' ? serverErrors.statement : (localErrors[key] ?? serverErrors[key]);

  async function save(): Promise<UpdateOutcome | undefined> {
    if (!dirty || !valid || saving) return undefined;
    setSaving(true);
    setSaveError(undefined);
    try {
      const outcome = await problemsApi.updatePublished(target, {
        expected_version: { major: editor.version.major, minor: editor.version.minor },
        force_major: force,
        ...patch,
      });
      setEdits({});
      setForce(false);
      setServerErrors({});
      setNotice(null);
      setConflict(null);
      setEditor(outcome.editor);
      if (outcome.kind === 'minor') {
        toast({
          tone: 'success',
          title: `Minor update, now ${outcome.label}`,
          description: 'It is effective at once. Solvers see it without a new verification.',
        });
      } else {
        toast({
          tone: 'info',
          title: `Major draft ${outcome.label} created`,
          description: outcome.forced
            ? 'Major because Force major update was ticked. Verify and publish it when ready; solvers keep using the open version.'
            : `Major because of: ${outcome.major_fields.map(fieldLabel).join(', ')}. Verify and publish it when ready; solvers keep using the open version.`,
        });
      }
      return outcome;
    } catch (caught) {
      if (caught instanceof ApiError && caught.errorCode === 'VERSION_CONFLICT') {
        setConflict({ label: conflictLabel(caught), startedFrom: saved });
      } else if (caught instanceof ApiError && caught.status === 400) {
        const fields: Record<string, string> = {};
        for (const detail of caught.details ?? []) {
          const key = SERVER_FIELDS[detail.field.split('.')[0] ?? ''];
          if (key) fields[key] = detail.message;
        }
        setServerErrors(fields);
        setSaveError('Check the highlighted fields.');
      } else if (caught instanceof ApiError && caught.errorCode === 'DRAFT_EXISTS') {
        setSaveError(versionErrorMessage(caught));
        await refresh();
      } else {
        setSaveError(errorMessage(caught instanceof ApiError ? new Error(versionErrorMessage(caught)) : caught));
      }
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  /** Load the open version again and keep every edit; say which fields moved under them. */
  async function reload() {
    if (!conflict) return;
    setReloading(true);
    try {
      const next = await problemsApi.editor(target);
      const fresh = draftOf(next);
      const moved = (Object.keys(fresh) as Array<keyof StatementDraft>).filter(
        (key) => !same(fresh[key], conflict.startedFrom[key])
      );
      setEditor(next);
      setNotice({
        label: next.version.label,
        changed: moved.map((key) => DRAFT_FIELD[key]),
        overlap: moved.filter((key) => key in rawEdits).map((key) => DRAFT_FIELD[key]),
      });
      setConflict(null);
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not reload', description: errorMessage(caught) });
    } finally {
      setReloading(false);
    }
  }

  return {
    draft,
    count,
    dirty,
    valid,
    changed,
    prediction,
    force,
    setForce,
    set,
    error,
    discard,
    save,
    saving,
    saveError,
    conflict,
    notice,
    dismissNotice: () => setNotice(null),
    reload,
    reloading,
  };
}
