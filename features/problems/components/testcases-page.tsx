'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileUp,
  Info,
  LoaderCircle,
  Play,
  Sparkles,
  Plus,
  Trash2,
  Undo2,
  Upload,
  ClipboardPaste,
} from 'lucide-react';
import { VerdictBadge } from '@/components/grader/verdict-badge';
import { VERDICTS } from '@/components/grader/verdict';
import { EmptyState, ErrorState, Loading } from '@/components/states/states';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ChangeBadge } from '@/components/ui/change-badge';
import { Menu, MenuItem } from '@/components/ui/menu';
import { SortableLists } from '@/components/ui/sortable-list';
import { Toggle } from '@/components/ui/toggle';
import { useToast } from '@/components/ui/toast';
import { UnsavedBar } from '@/components/ui/unsaved-bar';
import { useSpace } from '@/features/spaces/components/space-shell';
import { ApiError, errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { useApiQuery } from '@/lib/use-api-query';
import { problemsApi } from '../api/problems.api';
import { useGenerate, type GenerateRunState } from '../hooks/use-generate';
import {
  applyRuns,
  countChanges,
  discardGenerated,
  draftFrom,
  keepSavedOutput,
  limitProblem,
  liveTests,
  missingOutputs,
  rebase,
  rowChanges,
  toSaveRequest,
  visibleCount,
  type DraftTest,
} from '../test-drafts';
import { sourceOf } from '../test-file-source';
import type { TestCaseList } from '../types';
import { uploadFailureMessage } from '../upload-message';
import { AiTestcaseDialog } from './ai-testcase-dialog';
import { GenerateDialogs, type GenerateChoice } from './generate-dialogs';
import { failureVerdict, GenerateOutcome, GenerateProgress } from './generate-status';
import { PastePanel, ReplaceDialog, UploadPanel } from './testcase-add';
import { FileDetail, ViewAllDialog, type ViewAllTarget } from './testcase-files';
import { useProblemWorkspace } from './problem-workspace';

export { uploadFailureMessage };

/** The Testcases tab: loads the list, then hands it to the editor. */
export function TestcasesPage() {
  const { target } = useProblemWorkspace();
  const loaded = useApiQuery(() => problemsApi.tests(target), `tests-${target.slug}-${target.problemSlug}`);
  if (loaded.status === 'loading') return <Loading label="Loading testcases" />;
  if (loaded.status === 'error') return <ErrorState error={loaded.error} onRetry={loaded.reload} />;
  return <TestcasesEditor initial={loaded.data} />;
}

type Panel = 'paste' | 'upload' | null;

/**
 * Testcases in judging order, edited as a draft: visibility, order, files, new and removed testcases and generated
 * outputs only reach Core when the person presses Save, which sends the whole list at once.
 */
export function TestcasesEditor({ initial }: { initial: TestCaseList }) {
  const { target, editor, refresh } = useProblemWorkspace();
  const { space, abilities } = useSpace();
  const toast = useToast();
  const baseHref = `/spaces/${space.slug}/problems/${editor.slug}/edit`;

  const [base, setBase] = useState(initial);
  const [tests, setTests] = useState<DraftTest[]>(() => draftFrom(initial));
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ViewAllTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<TestCaseList | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const keys = useRef(0);

  const writer = abilities.canEditProblems;
  const canEdit = writer && base.editable;
  const generate = useGenerate(target, (run) => {
    setTests((current) => applyRuns(current, run.job, new Set(run.kept)));
    setReviewed(false);
  });
  const running = generate.run?.job.status === 'running';
  const locked = running || saving;

  const changes = countChanges(tests, moved);
  const dirty = changes > 0;
  const live = liveTests(tests);
  const makeKey = useCallback(() => `new-${keys.current++}`, []);

  // Leaving with unsaved changes loses them.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const adopt = (list: TestCaseList) => {
    setBase(list);
    setTests(draftFrom(list));
    setMoved(new Set());
    setPanel(null);
    setConflict(null);
    setSaveError(null);
    generate.clear();
  };

  const change = (key: string, patch: Partial<DraftTest>) =>
    setTests((current) => current.map((test) => (test.key === key ? { ...test, ...patch } : test)));

  async function save() {
    const problem = limitProblem(tests, base.limits);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      adopt(await problemsApi.saveTests(target, toSaveRequest(tests, base.revision)));
      toast({ tone: 'success', title: 'Testcases saved' });
      await refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.errorCode === 'TESTS_CHANGED') {
        try {
          setConflict(await problemsApi.tests(target));
        } catch (reloadFailure) {
          setSaveError(
            `The testcases changed while you were editing, and the new list could not be loaded. ${errorMessage(reloadFailure)}`
          );
        }
      } else {
        setSaveError(uploadFailureMessage(caught));
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    adopt(base);
  }

  function keepMine(latest: TestCaseList) {
    const result = rebase(tests, moved, latest);
    setBase(latest);
    setTests(result.tests);
    setMoved(result.moved);
    setConflict(null);
    setSaveError(null);
    toast({
      tone: 'success',
      title: 'Your changes are on top of the new list',
      description:
        result.dropped > 0
          ? `${result.dropped} testcases someone deleted were dropped. Review, then save.`
          : 'Review, then save.',
    });
  }

  async function startGenerate(choice: GenerateChoice) {
    setChoosing(false);
    setReviewed(false);
    try {
      await generate.start(choice.solutionId, choice.solutionLabel, choice.testIds, choice.kept);
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not start generating', description: errorMessage(caught) });
    }
  }

  async function stopGenerate() {
    try {
      await generate.stop();
    } catch (caught) {
      toast({ tone: 'danger', title: 'Could not stop generating', description: errorMessage(caught) });
    }
  }

  const lists = useMemo(() => [{ id: 'tests', label: 'Testcases in judging order', items: tests }], [tests]);
  const positionOf = (test: DraftTest) => tests.indexOf(test) + 1;
  const room = base.limits.max_count - live.length;
  const missing = missingOutputs(tests);

  function viewAll(test: DraftTest, side: 'input' | 'output') {
    const n = positionOf(test);
    setViewing({
      label: `Testcase ${n}`,
      start: side,
      sides: [
        { side: 'input', name: `${n}.in`, title: 'Input', source: sourceOf(target, test, 'input') },
        ...(test.output
          ? [
              {
                side: 'output' as const,
                name: `${n}.out`,
                title: 'Expected output',
                source: sourceOf(target, test, 'output'),
              },
            ]
          : []),
      ],
    });
  }

  const toggleOpen = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const replacingTest = tests.find((test) => test.key === replacing);

  return (
    <section aria-labelledby="tc-title" className="flex flex-col">
      {!writer && (
        <div className="mb-4">
          <Banner tone="info" title="View only">
            As {space.my_role === 'observer' ? 'an Observer' : 'a member of this Space'} you can open every testcase and
            its expected output, but you can&apos;t change them.
          </Banner>
        </div>
      )}
      {writer && !base.editable && (
        <div className="mb-4">
          <Banner tone="info" title="The testcases are read-only">
            This version is published (or archived), so its testcases can no longer change. Solvers always get the
            testcases of the version they submitted to.
          </Banner>
        </div>
      )}

      <div className="tc-sechead">
        <div>
          <h2 className="tc-h2" id="tc-title">
            Testcases
          </h2>
          <p className="tc-sub">
            {live.length} {live.length === 1 ? 'testcase' : 'testcases'}
            {dirty ? ' after you save' : ''}, judged from top to bottom · {visibleCount(tests)} visible to solvers as
            samples
          </p>
        </div>
        {canEdit && (
          <div className="tc-actions">
            <Button size="sm" disabled={locked} onClick={() => setChoosing(true)}>
              <Play aria-hidden />
              Generate expected output
            </Button>
            <Menu
              trigger={
                <Button size="sm" variant="primary" disabled={locked}>
                  <Plus aria-hidden />
                  Add testcases
                  <ChevronDown aria-hidden />
                </Button>
              }
            >
              <MenuItem icon={Upload} onSelect={() => setPanel('upload')}>
                Upload files
              </MenuItem>
              <MenuItem icon={ClipboardPaste} onSelect={() => setPanel('paste')}>
                Paste text
              </MenuItem>
              <MenuItem icon={Sparkles} onSelect={() => setAiOpen(true)}>
                Generate with AI
              </MenuItem>
            </Menu>
          </div>
        )}
      </div>
      <div className="tc-hint">
        <Info className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <div className="tc-hint__text">
          <p className="m-0">
            Visible testcases are shown to solvers as samples.{' '}
            {canEdit
              ? 'Order, visibility and file changes take effect when you save.'
              : 'Only the people who run this Space can see the others.'}
          </p>
          <p className="m-0">
            Limits: {base.limits.max_count} testcases, {formatBytes(base.limits.max_total_bytes)} in total, each file up
            to {formatBytes(base.limits.max_file_bytes)}; up to {base.limits.max_samples} visible, each file up to{' '}
            {formatBytes(base.limits.max_sample_bytes)}.
          </p>
        </div>
        {canEdit && (
          <p className="tc-saved" role="status">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}
          </p>
        )}
      </div>

      <div className="tc-stack">
        {conflict && (
          <Banner
            tone="warning"
            title="Someone saved these testcases while you were editing"
            action={
              <>
                <Button size="sm" variant="ghost" onClick={() => adopt(conflict)}>
                  Load the new list
                </Button>
                <Button size="sm" onClick={() => keepMine(conflict)}>
                  Keep my changes on top
                </Button>
              </>
            }
          >
            Nothing of yours was saved. Load the new list and drop your changes, or keep them on top of the new list;
            you can review it before saving again.
          </Banner>
        )}

        {generate.run && running && (
          <GenerateProgress
            state={generate.run}
            testCount={base.items.length}
            onStop={stopGenerate}
            lostContact={generate.lostContact}
            onPollAgain={generate.pollAgain}
          />
        )}
        {generate.run && !running && (
          <GenerateOutcome
            state={generate.run}
            baseHref={baseHref}
            reviewed={reviewed}
            onReview={() => setReviewed(true)}
            onRetry={(ids) => {
              const run = generate.run!;
              void startGenerate({
                solutionId: run.solutionId,
                solutionLabel: run.solutionLabel,
                testIds: ids,
                kept: [],
              });
            }}
            onChooseAnother={() => setChoosing(true)}
            onDiscard={() => {
              setTests((current) => discardGenerated(current));
              generate.clear();
            }}
            onDismiss={generate.clear}
          />
        )}

        {canEdit && !running && missing.length > 0 && (
          <Banner
            tone="warning"
            title={`${missing.length} ${missing.length === 1 ? 'testcase has' : 'testcases have'} no expected output`}
            action={
              <Button size="sm" onClick={() => setChoosing(true)}>
                <Play aria-hidden />
                Generate expected output
              </Button>
            }
          >
            {missing.length === 1 ? 'It' : 'They'} cannot be judged yet, and the problem cannot be published until{' '}
            {missing.length === 1 ? 'it has' : 'each has'} one. Upload the output (Replace files in the row menu) or
            generate it from a solution.
          </Banner>
        )}

        {canEdit && panel === 'paste' && (
          <PastePanel
            target={target}
            room={room}
            baseCount={tests.length}
            makeKey={makeKey}
            onClose={() => setPanel(null)}
            onAdd={(added) => {
              setTests((current) => [...current, ...added]);
              setPanel(null);
            }}
          />
        )}
        {canEdit && panel === 'upload' && (
          <UploadPanel
            target={target}
            limits={base.limits}
            room={room}
            makeKey={makeKey}
            onClose={() => setPanel(null)}
            onAdd={(added) => {
              setTests((current) => [...current, ...added]);
              setPanel(null);
            }}
          />
        )}

        {tests.length === 0 ? (
          <EmptyState
            title="No testcases yet"
            description={
              canEdit
                ? 'Add at least one visible testcase (shown to solvers as a sample) and the hidden ones that decide the verdict.'
                : 'This version has no testcases.'
            }
          />
        ) : (
          <div className="tc-box">
            <div className={canEdit ? 'tc-grid tc-thead' : 'tc-grid is-view tc-thead'} aria-hidden>
              <span />
              {canEdit && <span />}
              <span style={{ textAlign: 'right', paddingRight: 8 }}>#</span>
              <span>Input</span>
              <span>Expected output</span>
              <span>{running ? 'Generation' : canEdit ? 'Changes' : ''}</span>
              <span>Visible to solvers</span>
              {canEdit && <span />}
            </div>
            <SortableLists
              lists={lists}
              getId={(test) => test.key}
              getLabel={(test) => `Testcase ${positionOf(test)}`}
              readOnly={!canEdit}
              locked={locked}
              onReorder={(order, change) => {
                const ids = order.tests ?? [];
                setTests((current) => ids.map((id) => current.find((test) => test.key === id)!));
                setMoved((current) => new Set(current).add(change.id));
              }}
              itemActions={(test) => (
                <>
                  {!test.removed && (
                    <MenuItem icon={FileUp} onSelect={() => setReplacing(test.key)}>
                      Replace files…
                    </MenuItem>
                  )}
                  {test.removed ? (
                    <MenuItem icon={Undo2} onSelect={() => change(test.key, { removed: false })}>
                      Undo remove
                    </MenuItem>
                  ) : (
                    <MenuItem
                      icon={Trash2}
                      danger
                      onSelect={() =>
                        test.baseline
                          ? change(test.key, { removed: true })
                          : setTests((current) => current.filter((other) => other.key !== test.key))
                      }
                    >
                      Remove
                    </MenuItem>
                  )}
                </>
              )}
              renderItem={(test, context) => {
                const n = context.index + 1;
                const isOpen = open.has(test.key);
                const detailId = `tc-detail-${test.key}`;
                const labelLower = `testcase ${n}`;
                const changesOfRow = rowChanges(test, context.index, moved);
                const runInfo = running
                  ? generate.run!.job.runs.find((entry) => entry.test_id === test.baseline?.id)
                  : undefined;
                const keptNow = running && generate.run!.kept.includes(test.key);
                const kind = changesOfRow.find((entry) => entry.kind === 'new')
                  ? 'is-new'
                  : test.removed
                    ? 'is-removed'
                    : runInfo?.status === 'running'
                      ? 'is-running'
                      : isOpen
                        ? 'is-open'
                        : '';
                return (
                  <>
                    <div
                      className={`${canEdit ? 'tc-grid' : 'tc-grid is-view'} tc-row ${kind}`}
                      onClick={(event) => {
                        // Controls inside the row (chevron, drag handle, toggle, menu, undo) keep their own behaviour.
                        if ((event.target as HTMLElement).closest('button, a, input, [role="switch"], [role="menu"]'))
                          return;
                        toggleOpen(test.key);
                      }}
                    >
                      <button
                        type="button"
                        className="vd-iconbtn"
                        aria-expanded={isOpen}
                        aria-controls={detailId}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} files of ${labelLower}`}
                        onClick={() => toggleOpen(test.key)}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
                        ) : (
                          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
                        )}
                      </button>
                      {canEdit && <span>{context.handle}</span>}
                      <span className="tc-num">{n}</span>
                      <span className="tc-file">
                        <b>{n}.in</b>
                        <span>{formatBytes(test.input.size)}</span>
                      </span>
                      {test.output ? (
                        <span className="tc-file">
                          <b>{n}.out</b>
                          <span>{formatBytes(test.output.size)}</span>
                        </span>
                      ) : (
                        <span className="tc-missing">
                          <CircleAlert className="size-3.5" strokeWidth={1.75} aria-hidden />
                          No output yet
                        </span>
                      )}
                      <span className="tc-status">
                        {runInfo || keptNow ? (
                          <RunStatus run={runInfo} kept={keptNow} />
                        ) : (
                          <>
                            {canEdit &&
                              changesOfRow.map((entry) => (
                                <ChangeBadge
                                  key={entry.kind}
                                  kind={entry.kind}
                                  from={entry.from}
                                  onUndo={() => change(test.key, { removed: false })}
                                />
                              ))}
                            {test.note?.kind === 'failed' && (
                              <VerdictBadge
                                verdict={failureVerdict({ verdict: test.note.verdict })}
                                detail={`${VERDICTS[failureVerdict({ verdict: test.note.verdict })].label} · ${test.output ? 'old output kept' : 'still no output'}`}
                              />
                            )}
                          </>
                        )}
                      </span>
                      <Toggle
                        checked={test.isSample}
                        disabled={!canEdit || test.removed || locked}
                        aria-label={`Visible to solvers, ${labelLower}`}
                        onCheckedChange={(checked) => change(test.key, { isSample: checked })}
                      />
                      {canEdit && <div className="tc-cellend">{context.moveMenu}</div>}
                    </div>
                    {isOpen && (
                      <div className={canEdit ? 'tc-detail' : 'tc-detail is-view'} id={detailId}>
                        <div>
                          <p className="tc-detail__label">Input</p>
                          <FileDetail
                            source={sourceOf(target, test, 'input')}
                            name={`${n}.in`}
                            size={test.input.size}
                            onViewAll={() => viewAll(test, 'input')}
                          />
                        </div>
                        <div>
                          <p className="tc-detail__label">Expected output</p>
                          {test.output ? (
                            <FileDetail
                              source={sourceOf(target, test, 'output')}
                              name={`${n}.out`}
                              size={test.output.size}
                              onViewAll={() => viewAll(test, 'output')}
                            />
                          ) : (
                            <p className="tc-sub" style={{ margin: 0 }}>
                              This testcase has no expected output yet.
                            </p>
                          )}
                          {canEdit && test.output?.origin === 'generated' && (
                            <div className="mt-2">
                              <Badge tone="brand">Generated, {formatBytes(test.output.size)}</Badge>{' '}
                              {test.baseline?.output_sha256 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setTests((current) =>
                                      current.map((other) => (other.key === test.key ? keepSavedOutput(other) : other))
                                    )
                                  }
                                >
                                  <Undo2 aria-hidden />
                                  Keep the saved output
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        {test.note?.kind === 'failed' && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <p className="tc-detail__label">
                              {VERDICTS[failureVerdict({ verdict: test.note.verdict })].label}. The solution printed to
                              stderr
                            </p>
                            <pre
                              className="vd-filepreview__text bg-surface border-border rounded-md border"
                              tabIndex={0}
                            >
                              {test.note.stderr?.trim() ? test.note.stderr : '(nothing)'}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              }}
            />
          </div>
        )}
      </div>

      {canEdit && (
        <div className="tc-bottom">
          <UnsavedBar
            count={changes}
            floating
            saving={saving}
            error={saveError ?? undefined}
            onSave={() => void save()}
            onDiscard={discard}
          />
        </div>
      )}

      <GenerateDialogs
        open={choosing}
        target={target}
        baseHref={baseHref}
        tests={tests}
        limits={{ timeLimitMs: editor.version.time_limit_ms, memoryLimitKb: editor.version.memory_limit_kb }}
        onClose={() => setChoosing(false)}
        onChosen={(choice) => void startGenerate(choice)}
      />
      {canEdit && (
        <AiTestcaseDialog
          open={aiOpen}
          target={target}
          baseHref={baseHref}
          room={room}
          makeKey={makeKey}
          onClose={() => setAiOpen(false)}
          onAdd={(added) => setTests((current) => [...current, ...added])}
        />
      )}
      <ReplaceDialog
        target={target}
        limits={base.limits}
        label={replacingTest ? `testcase ${positionOf(replacingTest)}` : null}
        onClose={() => setReplacing(null)}
        onReplace={(files) => {
          if (replacing) {
            change(replacing, {
              ...(files.input ? { input: files.input } : {}),
              ...(files.output ? { output: files.output, note: undefined } : {}),
            });
          }
          setReplacing(null);
        }}
      />
      <ViewAllDialog target={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}

function RunStatus({ run, kept }: { run?: GenerateRunState['job']['runs'][number]; kept: boolean }) {
  if (kept || !run) return <Badge>Kept</Badge>;
  if (run.status === 'queued') return <span className="vd-muted text-small">Queued</span>;
  if (run.status === 'running') {
    return (
      <span className="vd-inline">
        <LoaderCircle className="vd-icon vd-spin size-4" strokeWidth={1.75} aria-hidden />
        Running
      </span>
    );
  }
  if (run.status === 'done') return <Badge tone="info">Generated</Badge>;
  return <VerdictBadge verdict={failureVerdict(run)} />;
}
