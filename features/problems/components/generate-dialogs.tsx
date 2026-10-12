'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmOverwriteDialog } from '@/components/ui/confirm-overwrite-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { errorMessage } from '@/lib/api';
import { formatBytes, formatTime, timeAgo } from '@/lib/format';
import { problemsApi, type ProblemTarget } from '../api/problems.api';
import { generatable, liveTests, unsavedForGenerate, type DraftTest } from '../test-drafts';
import { kilobytesToMegabytes, LANGUAGE_LABELS, type ReferenceSolution } from '../types';

export interface GenerateChoice {
  solutionId: string;
  solutionLabel: string;
  /** Saved testcases to run: the ticked ones and those without an output. */
  testIds: string[];
  /** The ones the person chose to keep. */
  kept: string[];
}

const solutionLabel = (solution: ReferenceSolution, index: number) =>
  `Solution ${index + 1} (${LANGUAGE_LABELS[solution.language]})`;

/**
 * Generate, steps 1 and 2: choose the saved solution, then (only when some testcases already have an output)
 * confirm which of them to overwrite. Testcases without an output are always generated.
 */
export function GenerateDialogs(props: GenerateDialogsProps) {
  // Mounted only while open, so every opening starts from the first step.
  return props.open ? <GenerateSteps {...props} /> : null;
}

interface GenerateDialogsProps {
  open: boolean;
  target: ProblemTarget;
  baseHref: string;
  tests: DraftTest[];
  limits: { timeLimitMs: number; memoryLimitKb: number };
  onClose: () => void;
  onChosen: (choice: GenerateChoice) => void;
}

function GenerateSteps({ target, baseHref, tests, limits, onClose, onChosen }: GenerateDialogsProps) {
  const [solutions, setSolutions] = useState<ReferenceSolution[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [chosenId, setChosenId] = useState<string>('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    problemsApi.solutions(target).then(
      (items) => {
        if (cancelled) return;
        setSolutions(items);
        setChosenId((items.find((item) => item.is_primary) ?? items[0])?.id ?? '');
      },
      (caught: unknown) => !cancelled && setFailure(errorMessage(caught))
    );
    return () => {
      cancelled = true;
    };
  }, [target]);

  const runnable = useMemo(() => generatable(tests), [tests]);
  const unsaved = unsavedForGenerate(tests);
  const withOutput = runnable.filter((test) => test.output !== null);
  const withoutOutput = runnable.filter((test) => test.output === null);
  const total = liveTests(tests).length;
  const index = solutions?.findIndex((item) => item.id === chosenId) ?? -1;
  const chosen = index >= 0 ? solutions![index]! : null;
  const positionOf = (test: DraftTest) => tests.indexOf(test) + 1;

  function begin(ticked: DraftTest[]) {
    if (!chosen) return;
    const keptKeys = withOutput.filter((test) => !ticked.includes(test)).map((test) => test.baseline!.id);
    onChosen({
      solutionId: chosen.id,
      solutionLabel: solutionLabel(chosen, index),
      testIds: [...ticked, ...withoutOutput].map((test) => test.baseline!.id),
      kept: keptKeys,
    });
  }

  return (
    <>
      <Dialog
        open={!confirming}
        onClose={onClose}
        size="lg"
        title="Generate expected output"
        description="Run a saved solution on each testcase's input and use what it prints as the expected output. Nothing changes for solvers until you save."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!chosen || runnable.length === 0}
              onClick={() => (withOutput.length > 0 ? setConfirming(true) : begin([]))}
            >
              Continue
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <dl className="tc-facts">
            <dt>Testcases</dt>
            <dd>
              {total} in total · {withOutput.length} already {withOutput.length === 1 ? 'has' : 'have'} an expected
              output · {withoutOutput.length} {withoutOutput.length === 1 ? 'has' : 'have'} none
            </dd>
            <dt>Limits</dt>
            <dd>
              Each run uses this problem&apos;s limits:{' '}
              <span className="tc-code">{formatTime(limits.timeLimitMs)}</span> and{' '}
              <span className="tc-code">{kilobytesToMegabytes(limits.memoryLimitKb)} MB</span>
            </dd>
          </dl>
          {unsaved.length > 0 && (
            <Banner tone="info">
              {unsaved.length} {unsaved.length === 1 ? 'testcase has' : 'testcases have'} changes that are not saved yet
              (added, or with a new input), so {unsaved.length === 1 ? 'it is' : 'they are'} skipped. Save first to
              generate {unsaved.length === 1 ? 'its' : 'their'} output.
            </Banner>
          )}
          {failure ? (
            <p role="alert" className="vd-hint vd-hint--error">
              Could not load the solutions. {failure}
            </p>
          ) : solutions === null ? (
            <p role="status" className="tc-sub">
              Loading the solutions…
            </p>
          ) : solutions.length === 0 ? (
            <p className="tc-sub">
              There is no saved solution yet.{' '}
              <Link href={`${baseHref}/solutions`} className={buttonVariants({ variant: 'link', size: 'sm' })}>
                Add one on the Solutions tab
              </Link>
              , then come back.
            </p>
          ) : (
            <Dropdown
              label="Solution"
              hint="Only solutions saved on the Solutions tab are listed."
              options={solutions.map((solution, at) => ({
                value: solution.id,
                label: solutionLabel(solution, at),
                description: `${solution.is_primary ? 'Primary · ' : ''}${formatBytes(solution.source_bytes)} · edited ${timeAgo(solution.updated_at)}`,
              }))}
              value={chosenId}
              onValueChange={setChosenId}
            />
          )}
          {runnable.length === 0 && solutions !== null && solutions.length > 0 && (
            <p className="tc-sub">There is no saved testcase to run. Save the new testcases first.</p>
          )}
        </div>
      </Dialog>
      <ConfirmOverwriteDialog
        open={confirming}
        title="Overwrite expected outputs?"
        description={`${withOutput.length} ${withOutput.length === 1 ? 'testcase already has' : 'testcases already have'} an expected output. Untick any you want to keep.${
          withoutOutput.length > 0
            ? ` ${withoutOutput.length} ${withoutOutput.length === 1 ? 'has' : 'have'} none, so ${withoutOutput.length === 1 ? 'it is' : 'they are'} generated either way.`
            : ''
        }`}
        items={withOutput.map((test) => ({
          id: test.key,
          label: `Testcase ${positionOf(test)}`,
          detail: `${positionOf(test)}.out · ${formatBytes(test.output!.size)}${test.isSample ? ' · visible to solvers' : ''}`,
        }))}
        confirmLabel="Overwrite"
        onClose={() => setConfirming(false)}
        onConfirm={(ids) => {
          setConfirming(false);
          begin(withOutput.filter((test) => ids.includes(test.key)));
        }}
      />
    </>
  );
}
