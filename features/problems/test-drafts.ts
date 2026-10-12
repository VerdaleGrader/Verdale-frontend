import type { ChangeKind } from '@/components/ui/change-badge';
import { formatBytes } from '@/lib/format';
import type { GenerateJob, SaveTestCasesRequest, TestCase, TestCaseList, TestLimits } from './types';

/*
 * The testcases page edits a draft: the list as Core has it plus everything the person changed (visibility,
 * order, files, new and removed testcases, generated outputs). Nothing reaches Core until Save, which sends
 * the whole list in one call. This file is the pure part: building the draft, describing what changed per row,
 * checking the limits, making the save request and re-applying a draft on top of a newer list.
 */

export type Side = 'input' | 'output';
export type FileOrigin = 'saved' | 'upload' | 'paste' | 'generated';

export interface DraftFile {
  sha256: string;
  size: number;
  origin: FileOrigin;
  /** A file chosen or pasted on this page: kept so it can be previewed without asking Core. */
  local?: File | string;
  totalLines?: number;
}

/** What the last Generate said about a row, shown in the Changes column. */
export type RowNote =
  | { kind: 'same' | 'kept' }
  | { kind: 'failed'; verdict: string | null; errorCode: string | null; stderr: string | null };

export interface DraftTest {
  /** The testcase id, or `new-<n>` for a testcase added on this page. */
  key: string;
  /** The testcase as saved; null for one added on this page. */
  baseline: TestCase | null;
  isSample: boolean;
  input: DraftFile;
  output: DraftFile | null;
  removed: boolean;
  note?: RowNote;
}

export const savedFile = (sha256: string, size: number): DraftFile => ({ sha256, size, origin: 'saved' });

export function draftFrom(list: TestCaseList): DraftTest[] {
  return list.items.map((test) => ({
    key: test.id,
    baseline: test,
    isSample: test.is_sample,
    input: savedFile(test.input_sha256, test.input_size_bytes),
    output: test.output_sha256 === null ? null : savedFile(test.output_sha256, test.output_size_bytes ?? 0),
    removed: false,
  }));
}

export function newTest(key: string, input: DraftFile, output: DraftFile | null, isSample: boolean): DraftTest {
  return { key, baseline: null, isSample, input, output, removed: false };
}

const inputChanged = (test: DraftTest) => test.baseline !== null && test.input.sha256 !== test.baseline.input_sha256;
const outputSha = (test: DraftTest) => test.output?.sha256 ?? null;
const outputChanged = (test: DraftTest) => test.baseline !== null && outputSha(test) !== test.baseline.output_sha256;

export interface RowChange {
  kind: ChangeKind;
  from?: number;
}

/** The badges of one row, from the most to the least important. `index` is the row's place in the draft (0-based). */
export function rowChanges(test: DraftTest, index: number, moved: ReadonlySet<string>): RowChange[] {
  if (test.removed) return [{ kind: 'removed' }];
  if (test.baseline === null) return [{ kind: 'new' }];
  const changes: RowChange[] = [];
  if (moved.has(test.key) && test.baseline.position - 1 !== index) {
    changes.push({ kind: 'moved', from: test.baseline.position });
  }
  if (test.isSample !== test.baseline.is_sample) changes.push({ kind: test.isSample ? 'now-visible' : 'now-hidden' });
  if (inputChanged(test)) changes.push({ kind: 'input-replaced' });
  if (outputChanged(test))
    changes.push({ kind: test.baseline.output_sha256 === null ? 'new-output' : 'output-changed' });
  if (test.note?.kind === 'same' || test.note?.kind === 'kept') changes.push({ kind: test.note.kind });
  return changes;
}

/** "Same as before" and "Kept" only report; they are not changes to save. */
const isRealChange = (change: RowChange) => change.kind !== 'same' && change.kind !== 'kept';

/** Is the order different from the saved one (removed rows keep their place, so they count)? */
function orderChanged(tests: DraftTest[]): boolean {
  const saved = tests.filter((test) => test.baseline !== null);
  return saved.some((test, index) => index > 0 && test.baseline!.position < saved[index - 1]!.baseline!.position);
}

/** How many unsaved changes the UnsavedBar reports: one per badge, and one for an order change no badge explains. */
export function countChanges(tests: DraftTest[], moved: ReadonlySet<string>): number {
  let count = 0;
  let explained = false;
  tests.forEach((test, index) => {
    for (const change of rowChanges(test, index, moved)) {
      if (!isRealChange(change)) continue;
      count++;
      if (change.kind === 'moved') explained = true;
    }
  });
  if (!explained && orderChanged(tests.filter((test) => !test.removed))) count++;
  return count;
}

export const visibleCount = (tests: DraftTest[]) => tests.filter((test) => !test.removed && test.isSample).length;
export const liveTests = (tests: DraftTest[]) => tests.filter((test) => !test.removed);
export const missingOutputs = (tests: DraftTest[]) => liveTests(tests).filter((test) => test.output === null);

/** The body of the save call: files are listed only where they are new or different, a left-out file stays. */
export function toSaveRequest(tests: DraftTest[], revision: string): SaveTestCasesRequest {
  return {
    revision,
    tests: liveTests(tests).map((test) => ({
      ...(test.baseline ? { id: test.baseline.id } : {}),
      is_sample: test.isSample,
      ...(test.baseline === null || inputChanged(test) ? { input: { sha256: test.input.sha256 } } : {}),
      ...(test.output !== null && (test.baseline === null || outputChanged(test))
        ? { output: { sha256: test.output.sha256 } }
        : {}),
    })),
  };
}

/** What Core would refuse, found before asking so the person sees it at once. Null when all is within the limits. */
export function limitProblem(tests: DraftTest[], limits: TestLimits): string | null {
  const live = liveTests(tests);
  if (live.length > limits.max_count) {
    return `A problem can have at most ${limits.max_count} testcases and this list has ${live.length}. Remove some or undo adding them.`;
  }
  const samples = live.filter((test) => test.isSample);
  if (samples.length > limits.max_samples) {
    return `At most ${limits.max_samples} testcases can be visible to solvers and ${samples.length} are. Turn some off.`;
  }
  for (const test of samples) {
    const position = tests.indexOf(test) + 1;
    if (Math.max(test.input.size, test.output?.size ?? 0) > limits.max_sample_bytes) {
      return `Testcase ${position} is visible to solvers, so each of its files can be at most ${formatBytes(limits.max_sample_bytes)}. Turn its visibility off or replace the file.`;
    }
  }
  const total = live.reduce((sum, test) => sum + test.input.size + (test.output?.size ?? 0), 0);
  if (total > limits.max_total_bytes) {
    return `The testcases add up to ${formatBytes(total)} and the limit is ${formatBytes(limits.max_total_bytes)}.`;
  }
  return null;
}

/**
 * Put the draft on top of a newer list (somebody saved while this page was open). A field the person changed keeps
 * their value; every other field takes what is saved now. Testcases deleted meanwhile are dropped, testcases
 * added meanwhile come in at the end. If nothing was moved the saved order wins.
 */
export function rebase(
  draft: DraftTest[],
  moved: ReadonlySet<string>,
  latest: TestCaseList
): { tests: DraftTest[]; dropped: number; moved: Set<string> } {
  const byId = new Map(latest.items.map((item) => [item.id, item]));
  let dropped = 0;
  const rebased: DraftTest[] = [];
  for (const test of draft) {
    if (test.baseline === null) {
      rebased.push(test);
      continue;
    }
    const now = byId.get(test.baseline.id);
    if (!now) {
      dropped++;
      continue;
    }
    const before = test.baseline;
    const fresh = draftFrom({ ...latest, items: [now] })[0]!;
    rebased.push({
      ...test,
      baseline: now,
      isSample: test.isSample !== before.is_sample ? test.isSample : now.is_sample,
      input: test.input.sha256 !== before.input_sha256 ? test.input : fresh.input,
      output: outputSha(test) !== before.output_sha256 ? test.output : fresh.output,
    });
  }
  const kept = new Set(rebased.filter((test) => test.baseline).map((test) => test.key));
  const arrived = draftFrom({ ...latest, items: latest.items.filter((item) => !kept.has(item.id)) });
  const added = rebased.filter((test) => test.baseline === null);
  const existing = rebased.filter((test) => test.baseline !== null);
  let tests: DraftTest[];
  if (moved.size > 0) {
    // Their order for what they had, then what arrived, then what they added.
    tests = [...existing, ...arrived, ...added];
  } else {
    const order = new Map(latest.items.map((item, index) => [item.id, index]));
    tests = [...[...existing, ...arrived].sort((a, b) => order.get(a.key)! - order.get(b.key)!), ...added];
  }
  return { tests, dropped, moved: new Set([...moved].filter((key) => kept.has(key))) };
}

/** Testcases Generate can run: saved, still in the list, and with the input Core has. */
export const generatable = (tests: DraftTest[]) =>
  tests.filter((test) => test.baseline !== null && !test.removed && !inputChanged(test));

/** Everything Generate cannot run yet because it is not saved. */
export const unsavedForGenerate = (tests: DraftTest[]) =>
  tests.filter((test) => !test.removed && (test.baseline === null || inputChanged(test)));

/** Put what a Generate job produced into the draft; `kept` are the testcases the person chose not to regenerate. */
export function applyRuns(tests: DraftTest[], job: GenerateJob, kept: ReadonlySet<string>): DraftTest[] {
  const runs = new Map(job.runs.map((run) => [run.test_id, run]));
  return tests.map((test) => {
    const run = test.baseline ? runs.get(test.baseline.id) : undefined;
    if (!run) return kept.has(test.key) ? { ...test, note: { kind: 'kept' } } : test;
    if (run.status === 'done' && run.output) {
      const unchanged = run.same_as_current === true && outputSha(test) === test.baseline!.output_sha256;
      if (unchanged) return { ...test, note: { kind: 'same' } };
      return {
        ...test,
        output: { sha256: run.output.sha256, size: run.output.size_bytes, origin: 'generated' },
        note: undefined,
      };
    }
    // A compile error or an unreachable judge says nothing about this testcase; the banner reports it.
    const jobWide = run.error_code === 'COMPILE_ERROR' || run.error_code === 'JUDGE_UNAVAILABLE';
    if (run.status === 'failed' && !jobWide) {
      return { ...test, note: { kind: 'failed', verdict: run.verdict, errorCode: run.error_code, stderr: run.stderr } };
    }
    return test;
  });
}

/** Take back every generated output (the person chose Discard generated outputs). */
export function discardGenerated(tests: DraftTest[]): DraftTest[] {
  return tests.map((test) => {
    const generated = test.output?.origin === 'generated';
    const output = !generated
      ? test.output
      : test.baseline?.output_sha256
        ? savedFile(test.baseline.output_sha256, test.baseline.output_size_bytes ?? 0)
        : null;
    return { ...test, output, note: undefined };
  });
}

/** Back to the saved output of one testcase ("Keep the saved output"). */
export function keepSavedOutput(test: DraftTest): DraftTest {
  return discardGenerated([test])[0]!;
}
