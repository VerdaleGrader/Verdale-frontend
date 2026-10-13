'use client';

import { GitCommitVertical, GitFork } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/field';
import { UnsavedBar } from '@/components/ui/unsaved-bar';
import { useSpace } from '@/features/spaces/components/space-shell';
import { useUpdateProblem, type ReloadNotice } from '../hooks/use-update-problem';
import { fieldLabels, type UpdatePrediction } from '../versioning';
import { DetailsFields, MarkdownStatementField } from './statement-fields';
import { SolverPreview } from './statement-editor';
import { useProblemWorkspace } from './problem-workspace';

/**
 * The Statement tab of a published problem (GRD-118, GRD-75). Same structure as Create Problem: Details, then the
 * statement with its preview. Changes wait for Save; the chip says what Core will probably make of them.
 */
export function UpdateProblemForm() {
  const { target, editor, setEditor, refresh } = useProblemWorkspace();
  const { abilities } = useSpace();
  const form = useUpdateProblem({ target, editor, setEditor, refresh });
  const readOnly = !abilities.canEditProblems;
  const pdf = editor.version.statement_mode === 'pdf';
  const major = form.prediction.kind === 'major';

  return (
    <div className="flex flex-col gap-6">
      <Banner tone="info" title={`Solvers use ${editor.version.label} now.`}>
        {readOnly
          ? 'You can read this as an observer; only owners, administrators and editors can change it.'
          : 'Your changes wait for Save. Core decides whether the update is Minor (effective at once) or Major (a draft that has to be verified).'}
      </Banner>

      {form.conflict && (
        <Banner
          tone="danger"
          title={
            form.conflict.label
              ? `Someone changed this problem. It is now ${form.conflict.label}.`
              : 'Someone changed this problem while you were editing.'
          }
          action={
            <Button size="sm" onClick={() => void form.reload()} disabled={form.reloading}>
              {form.reloading ? 'Reloading…' : 'Reload'}
            </Button>
          }
        >
          Nothing was saved. Reload shows their version and keeps what you typed.
        </Banner>
      )}
      {form.notice && <ReloadedNotice notice={form.notice} onDismiss={form.dismissNotice} />}

      {!readOnly && (
        <UpdateTypePanel
          prediction={form.prediction}
          force={form.force}
          onForce={form.setForce}
          disabled={form.saving}
          hasChanges={form.changed.length > 0}
        />
      )}

      <DetailsFields
        draft={form.draft}
        constraints={editor.constraints}
        readOnly={readOnly}
        error={form.error}
        onChange={form.set}
        slug={
          <TextField
            label="Slug"
            mono
            value={editor.slug}
            readOnly
            disabled
            hint="The address of this problem inside the Space. It cannot be changed, because links and submissions point at it."
          />
        }
      />

      {pdf ? (
        <Banner tone="info" title="This problem uses a PDF statement">
          Replace the PDF in a Major draft (Testcases or Solutions tab, Start a Major draft). Title, limits and
          languages can still be changed here.
        </Banner>
      ) : (
        <MarkdownStatementField
          statement={form.draft.statement}
          constraints={editor.constraints}
          readOnly={readOnly}
          error={form.error('statement')}
          onChange={(value) => form.set('statement', value)}
          preview={<SolverPreview draft={form.draft} editor={editor} />}
          imageDisabledReason="Pictures can be added in a Major draft."
        />
      )}

      {!readOnly && (
        <UnsavedBar
          floating
          count={form.dirty ? Math.max(form.count, 1) : 0}
          saving={form.saving}
          error={form.saveError}
          saveLabel={major ? 'Save as Major draft' : 'Save as Minor update'}
          onSave={() => void form.save()}
          onDiscard={form.discard}
        />
      )}
    </div>
  );
}

/** The expected type (Minor or Major, "expected" because Core decides), what makes it Major, and Force major update. */
export function UpdateTypePanel({
  prediction,
  force,
  onForce,
  disabled,
  hasChanges,
}: {
  prediction: UpdatePrediction;
  force: boolean;
  onForce: (next: boolean) => void;
  disabled?: boolean;
  hasChanges: boolean;
}) {
  const alreadyMajor = prediction.majorFields.length > 0;
  return (
    <section
      aria-labelledby="update-type-heading"
      className="border-border bg-surface flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="update-type-heading" className="text-body-strong">
          This save will be
        </h2>
        {prediction.kind === 'none' ? (
          <Badge>No changes yet</Badge>
        ) : prediction.kind === 'major' ? (
          <Badge tone="warning" icon={GitFork}>
            Major update (expected)
          </Badge>
        ) : (
          <Badge tone="info" icon={GitCommitVertical}>
            Minor update (expected)
          </Badge>
        )}
      </div>
      {alreadyMajor && (
        <p className="text-small">
          Makes it Major: <strong>{fieldLabels(prediction.majorFields)}</strong>. A Major update becomes a draft that
          has to pass verification before solvers get it.
        </p>
      )}
      {prediction.kind === 'minor' && (
        <p className="text-small text-text-muted">
          Only {fieldLabels(prediction.minorFields)} changed, so it applies at once with no verification.
        </p>
      )}
      <Checkbox
        label="Force major update"
        description={
          alreadyMajor
            ? `Already a Major update because of: ${fieldLabels(prediction.majorFields)}.`
            : 'Make this a Major update even though only Minor fields changed. It creates a draft of the next Major that has to be verified; use it when solvers should be told their old results no longer apply.'
        }
        checked={alreadyMajor || force}
        disabled={disabled || alreadyMajor}
        onCheckedChange={(next) => onForce(next === true)}
      />
      {!hasChanges && !force && (
        <p className="text-small text-text-muted">Change a field below, or tick the box, and Save appears.</p>
      )}
    </section>
  );
}

function ReloadedNotice({ notice, onDismiss }: { notice: ReloadNotice; onDismiss: () => void }) {
  return (
    <Banner
      tone="info"
      title={`Reloaded: the open version is now ${notice.label}. Your edits are kept.`}
      action={
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      }
    >
      {notice.changed.length > 0
        ? `Changed by someone else meanwhile: ${fieldLabels(notice.changed)}.`
        : 'No field you can edit here changed.'}
      {notice.overlap.length > 0 &&
        ` You also edited ${fieldLabels(notice.overlap)}; your text replaces theirs when you save.`}
    </Banner>
  );
}
