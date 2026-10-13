import { describe, expect, it } from 'vitest';
import type { Submission } from './api/submissions.api';
import { displayVerdict, expandRuns, outcomeLine, progressCells, resultRows, sampleFeedback } from './verdicts';

const result = (
  position: number,
  verdict: Submission['results'][number]['verdict'],
  extra: Partial<Submission['results'][number]> = {}
) => ({
  position,
  is_sample: position === 1,
  verdict,
  time_ms: 10 * position,
  memory_kb: 1024,
  ...extra,
});

describe('displayVerdict', () => {
  it('is queued or running until judged, then the real verdict', () => {
    expect(displayVerdict({ status: 'queued', verdict: null })).toBe('QUEUED');
    expect(displayVerdict({ status: 'running', verdict: null })).toBe('RUNNING');
    expect(displayVerdict({ status: 'completed', verdict: 'TLE' })).toBe('TLE');
    expect(displayVerdict({ status: 'completed', verdict: 'ISE' })).toBe('ISE');
  });
});

describe('outcomeLine', () => {
  const base = { tests_passed: 0, tests_total: 3 };
  it('says what the submission is waiting for', () => {
    expect(outcomeLine({ ...base, status: 'queued', verdict: null, results: [] })).toBe('Waiting for a judge');
    expect(outcomeLine({ ...base, status: 'running', verdict: null, results: [] })).toBe('Running your solution');
  });
  it('names the first failing test', () => {
    expect(
      outcomeLine({
        ...base,
        status: 'completed',
        verdict: 'WA',
        results: [result(1, 'AC'), result(2, 'WA'), result(3, 'SKIPPED')],
      })
    ).toBe('Wrong answer on testcase 2');
    expect(
      outcomeLine({ ...base, status: 'completed', verdict: 'TLE', results: [result(1, 'AC'), result(2, 'TLE')] })
    ).toBe('Time limit exceeded on testcase 2');
  });
  it('keeps AC, CE and ISE plain', () => {
    expect(outcomeLine({ ...base, status: 'completed', verdict: 'AC', results: [result(1, 'AC')] })).toBe('Accepted');
    expect(outcomeLine({ ...base, status: 'completed', verdict: 'CE', results: [] })).toBe('Compilation error');
    expect(outcomeLine({ ...base, status: 'completed', verdict: 'ISE', results: [] })).toBe('Internal error');
  });
});

describe('progressCells', () => {
  it('shows the verdict of each test once judged', () => {
    expect(
      progressCells({
        status: 'completed',
        tests_total: 3,
        results: [result(1, 'AC'), result(2, 'WA'), result(3, 'SKIPPED')],
      })
    ).toEqual(['AC', 'WA', 'SKIPPED']);
  });
  it('shows pending cells before that, one per test', () => {
    expect(progressCells({ status: 'running', tests_total: 3, results: [] })).toEqual(['QUEUED', 'QUEUED', 'QUEUED']);
    expect(progressCells({ status: 'queued', tests_total: null, results: [] })).toEqual([]);
  });
  it('has no cells for a compilation or system error: no test ran', () => {
    expect(progressCells({ status: 'completed', tests_total: 3, results: [] })).toEqual([]);
  });
});

describe('resultRows', () => {
  it('keeps the sample/hidden mark and drops times of skipped tests', () => {
    expect(resultRows([result(1, 'AC'), result(2, 'SKIPPED', { time_ms: 0, memory_kb: 0 })])).toEqual([
      { verdict: 'AC', timeMs: 10, memoryKb: 1024, sample: true },
      { verdict: 'SKIPPED', timeMs: undefined, memoryKb: undefined, sample: false },
    ]);
  });
});

describe('sampleFeedback', () => {
  it('lists failing sample tests that have something to say, and never a hidden one', () => {
    const rows = [
      result(1, 'WA', { checker_message: 'line 2 differs', stdout_preview: '4\n' }),
      result(2, 'WA', { is_sample: false, checker_message: 'should never be here' }),
      result(3, 'AC', { is_sample: true, stdout_preview: '3\n' }),
      result(4, 'WA', { is_sample: true }),
    ];
    expect(sampleFeedback(rows).map((row) => row.position)).toEqual([1]);
  });
});

describe('test runs (GRD-112)', () => {
  it('turns runs into one verdict per test', () => {
    expect(
      expandRuns([
        { verdict: 'AC', count: 3 },
        { verdict: 'WA', count: 1 },
        { verdict: 'SKIPPED', count: 2 },
      ])
    ).toEqual(['AC', 'AC', 'AC', 'WA', 'SKIPPED', 'SKIPPED']);
    expect(expandRuns(undefined)).toEqual([]);
  });

  it('draws a judged summary from its runs when it has no results', () => {
    expect(
      progressCells({
        status: 'completed',
        results: [],
        tests_total: 2,
        test_runs: [{ verdict: 'AC', count: 2 }],
      })
    ).toEqual(['AC', 'AC']);
  });

  it('prefers the full results when it has them', () => {
    expect(
      progressCells({
        status: 'completed',
        results: [result(1, 'WA')],
        tests_total: 1,
        test_runs: [{ verdict: 'AC', count: 1 }],
      })
    ).toEqual(['WA']);
  });
});
