import { describe, expect, it } from 'vitest';
import {
  applyRuns,
  countChanges,
  discardGenerated,
  draftFrom,
  generatable,
  keepSavedOutput,
  limitProblem,
  newTest,
  rebase,
  rowChanges,
  savedFile,
  toSaveRequest,
  unsavedForGenerate,
} from './test-drafts';
import type { GenerateJob, GenerateRun, TestCase, TestCaseList } from './types';

const LIMITS = { max_count: 5, max_total_bytes: 1000, max_file_bytes: 500, max_sample_bytes: 100, max_samples: 2 };
const test = (position: number, overrides: Partial<TestCase> = {}): TestCase => ({
  id: `t${position}`,
  position,
  is_sample: false,
  input_sha256: `in${position}`,
  output_sha256: `out${position}`,
  input_size_bytes: 10,
  output_size_bytes: 5,
  created_at: '2026-10-12T00:00:00Z',
  ...overrides,
});
const listOf = (items: TestCase[], revision = 'r1'): TestCaseList => ({
  items,
  summary: { count: items.length, sample_count: 0, missing_output_count: 0, total_bytes: 0 },
  limits: LIMITS,
  editable: true,
  revision,
});
const list3 = () => listOf([test(1, { is_sample: true }), test(2), test(3)]);
const none = new Set<string>();
const file = (sha: string, size = 4) => ({ sha256: sha, size, origin: 'upload' as const });

describe('the draft of the testcases page', () => {
  it('starts equal to the saved list: no badges, nothing to save', () => {
    const tests = draftFrom(list3());
    expect(countChanges(tests, none)).toBe(0);
    tests.forEach((row, index) => expect(rowChanges(row, index, none)).toEqual([]));
  });

  it('describes visibility, a moved row, a replaced input and a removed row', () => {
    const tests = draftFrom(list3());
    tests[0] = { ...tests[0]!, isSample: false };
    tests[1] = { ...tests[1]!, input: file('new-in') };
    tests[2] = { ...tests[2]!, removed: true };
    expect(rowChanges(tests[0]!, 0, none)).toEqual([{ kind: 'now-hidden' }]);
    expect(rowChanges(tests[1]!, 1, none)).toEqual([{ kind: 'input-replaced' }]);
    expect(rowChanges(tests[2]!, 2, none)).toEqual([{ kind: 'removed' }]);
    expect(countChanges(tests, none)).toBe(3);

    const reordered = [tests[2]!, tests[0]!, tests[1]!].map((row) => ({ ...row, removed: false }));
    expect(rowChanges(reordered[0]!, 0, new Set(['t3']))).toEqual([{ kind: 'moved', from: 3 }]);
    // Nothing explains a changed order without a moved key, but it still counts as one change.
    expect(countChanges(reordered, new Set(['t3']))).toBeGreaterThanOrEqual(1);
  });

  it('counts an order change once even when no badge names the row', () => {
    const tests = draftFrom(list3());
    const swapped = [tests[1]!, tests[0]!, tests[2]!];
    expect(countChanges(swapped, none)).toBe(1);
  });

  it('marks new testcases and new or changed outputs', () => {
    const tests = draftFrom(listOf([test(1), test(2, { output_sha256: null, output_size_bytes: null })]));
    tests[1] = { ...tests[1]!, output: { ...file('gen', 7), origin: 'generated' } };
    tests[0] = { ...tests[0]!, output: { ...file('gen2', 7), origin: 'generated' } };
    tests.push(newTest('new-0', file('x'), null, true));
    expect(rowChanges(tests[0]!, 0, none)).toEqual([{ kind: 'output-changed' }]);
    expect(rowChanges(tests[1]!, 1, none)).toEqual([{ kind: 'new-output' }]);
    expect(rowChanges(tests[2]!, 2, none)).toEqual([{ kind: 'new' }]);
  });

  it('sends only what changed: ids for saved testcases, hashes for new or different files', () => {
    const tests = draftFrom(list3());
    tests[1] = { ...tests[1]!, isSample: true, output: file('fresh-out') };
    tests[2] = { ...tests[2]!, removed: true };
    tests.push(newTest('new-0', file('pasted'), null, false));
    expect(toSaveRequest(tests, 'r1')).toEqual({
      revision: 'r1',
      tests: [
        { id: 't1', is_sample: true },
        { id: 't2', is_sample: true, output: { sha256: 'fresh-out' } },
        { is_sample: false, input: { sha256: 'pasted' } },
      ],
    });
  });

  it('sends the order of the draft', () => {
    const tests = draftFrom(list3());
    const request = toSaveRequest([tests[2]!, tests[0]!, tests[1]!], 'r9');
    expect(request.tests.map((entry) => entry.id)).toEqual(['t3', 't1', 't2']);
  });
});

describe('limits', () => {
  it('passes a list within the limits', () => {
    expect(limitProblem(draftFrom(list3()), LIMITS)).toBeNull();
  });

  it('refuses too many testcases, too many samples, big samples and too many bytes', () => {
    const many = draftFrom(listOf([1, 2, 3, 4, 5].map((n) => test(n))));
    many.push(newTest('new-0', file('a'), null, false));
    expect(limitProblem(many, LIMITS)).toMatch(/at most 5 testcases/);

    const samples = draftFrom(listOf([1, 2, 3].map((n) => test(n, { is_sample: true }))));
    expect(limitProblem(samples, LIMITS)).toMatch(/At most 2 testcases can be visible/);

    const big = draftFrom(listOf([test(1, { is_sample: true, input_size_bytes: 200 })]));
    expect(limitProblem(big, LIMITS)).toMatch(/Testcase 1 is visible to solvers.*64 bytes|Testcase 1 is visible/);

    const heavy = draftFrom(listOf([test(1, { input_size_bytes: 600 }), test(2, { input_size_bytes: 600 })]));
    expect(limitProblem(heavy, LIMITS)).toMatch(/add up to/);
  });

  it('does not count removed testcases', () => {
    const tests = draftFrom(listOf([1, 2, 3, 4, 5].map((n) => test(n))));
    tests.push({ ...newTest('new-0', file('a'), null, false), removed: true });
    expect(limitProblem(tests, LIMITS)).toBeNull();
  });
});

describe('rebase on a newer list', () => {
  it('keeps the changed fields, takes the rest from the new list and appends testcases that arrived', () => {
    const draft = draftFrom(list3());
    draft[0] = { ...draft[0]!, isSample: false };
    draft[1] = { ...draft[1]!, removed: true };
    draft.push(newTest('new-0', file('mine'), null, false));
    const latest = listOf(
      [test(1, { is_sample: true }), test(2, { input_sha256: 'theirs' }), test(3, { is_sample: true }), test(4)],
      'r2'
    );
    const result = rebase(draft, none, latest);
    expect(result.dropped).toBe(0);
    expect(result.tests.map((row) => row.key)).toEqual(['t1', 't2', 't3', 't4', 'new-0']);
    expect(result.tests[0]!.isSample).toBe(false);
    expect(result.tests[1]!.removed).toBe(true);
    expect(result.tests[1]!.input.sha256).toBe('theirs');
    expect(result.tests[2]!.isSample).toBe(true);
    expect(result.tests[2]!.baseline).toBe(latest.items[2]);
  });

  it('drops testcases that were deleted meanwhile and keeps the person’s order when they moved something', () => {
    const draft = draftFrom(list3());
    const reordered = [draft[2]!, draft[0]!, draft[1]!];
    const latest = listOf([test(1), test(3)], 'r2');
    const result = rebase(reordered, new Set(['t3']), latest);
    expect(result.dropped).toBe(1);
    expect(result.tests.map((row) => row.key)).toEqual(['t3', 't1']);
    expect([...result.moved]).toEqual(['t3']);
  });
});

function job(
  runs: Array<Partial<GenerateRun> & { test_id: string }>,
  status: GenerateJob['status'] = 'completed'
): GenerateJob {
  return {
    id: 'j1',
    status,
    error: null,
    created_at: '2026-10-12T00:00:00Z',
    deadline_at: '2026-10-12T00:10:00Z',
    finished_at: null,
    progress: { total: runs.length, done: 0, failed: 0 },
    runs: runs.map((run, index) => ({
      position: index + 1,
      status: 'done',
      verdict: null,
      error_code: null,
      time_ms: 1,
      memory_kb: 1,
      stderr: null,
      output: { sha256: 'g', size_bytes: 3 },
      same_as_current: false,
      ...run,
    })),
  };
}

describe('Generate in the draft', () => {
  const base = () =>
    draftFrom(listOf([test(1), test(2), test(3), test(4, { output_sha256: null, output_size_bytes: null })]));

  it('takes new outputs into the draft, notes the same ones, keeps failed ones and marks the kept ones', () => {
    const result = applyRuns(
      base(),
      job([
        { test_id: 't1', output: { sha256: 'g1', size_bytes: 8 }, same_as_current: false },
        { test_id: 't2', output: { sha256: 'out2', size_bytes: 5 }, same_as_current: true },
        { test_id: 't3', status: 'failed', verdict: 'TLE', output: null, same_as_current: null, stderr: 'slow' },
        { test_id: 't4', output: { sha256: 'g4', size_bytes: 2 }, same_as_current: null },
      ]),
      new Set()
    );
    expect(result[0]!.output).toMatchObject({ sha256: 'g1', origin: 'generated' });
    expect(rowChanges(result[0]!, 0, none)).toEqual([{ kind: 'output-changed' }]);
    expect(result[1]!.note).toEqual({ kind: 'same' });
    expect(rowChanges(result[1]!, 1, none)).toEqual([{ kind: 'same' }]);
    expect(result[2]!.output!.sha256).toBe('out3');
    expect(result[2]!.note).toMatchObject({ kind: 'failed', verdict: 'TLE', stderr: 'slow' });
    expect(rowChanges(result[3]!, 3, none)).toEqual([{ kind: 'new-output' }]);
    // "Same" and "Kept" report, they are not changes to save: only the two outputs count.
    expect(countChanges(result, none)).toBe(2);
  });

  it('marks testcases the person chose not to regenerate', () => {
    const result = applyRuns(base(), job([{ test_id: 't2' }]), new Set(['t1']));
    expect(result[0]!.note).toEqual({ kind: 'kept' });
    expect(rowChanges(result[0]!, 0, none)).toEqual([{ kind: 'kept' }]);
  });

  it('does not blame a testcase for a compile error or an unreachable judge', () => {
    const result = applyRuns(
      base(),
      job([
        { test_id: 't1', status: 'failed', output: null, error_code: 'COMPILE_ERROR', same_as_current: null },
        {
          test_id: 't2',
          status: 'failed',
          verdict: 'ISE',
          output: null,
          error_code: 'JUDGE_UNAVAILABLE',
          same_as_current: null,
        },
      ]),
      new Set()
    );
    expect(result[0]!.note).toBeUndefined();
    expect(result[1]!.note).toBeUndefined();
  });

  it('leaves unfinished runs alone and can take everything back', () => {
    const generated = applyRuns(
      base(),
      job([
        { test_id: 't1', output: { sha256: 'g1', size_bytes: 8 } },
        { test_id: 't2', status: 'queued', output: null, same_as_current: null },
        { test_id: 't4', output: { sha256: 'g4', size_bytes: 2 }, same_as_current: null },
      ]),
      new Set()
    );
    expect(generated[1]!.output!.sha256).toBe('out2');
    const back = discardGenerated(generated);
    expect(back[0]!.output).toEqual(savedFile('out1', 5));
    expect(back[3]!.output).toBeNull();
    expect(keepSavedOutput(generated[0]!).output).toEqual(savedFile('out1', 5));
  });

  it('runs only saved testcases with the input Core has', () => {
    const tests = base();
    tests[0] = { ...tests[0]!, input: file('replaced') };
    tests[1] = { ...tests[1]!, removed: true };
    tests.push(newTest('new-0', file('x'), null, false));
    expect(generatable(tests).map((row) => row.key)).toEqual(['t3', 't4']);
    expect(unsavedForGenerate(tests).map((row) => row.key)).toEqual(['t1', 'new-0']);
  });
});
