import { describe, expect, it, vi } from 'vitest';
import { AI_MAX_COUNT, countProblem, draftsFromAi, failureHint, usableItems } from './ai-tests';
import type { AiTestItem, AiTestJob } from './types';

const item = (position: number, overrides: Partial<AiTestItem> = {}): AiTestItem => ({
  id: `item-${position}`,
  position,
  status: 'ok',
  input: { sha256: `i${position}`.padEnd(64, '0'), size_bytes: 4 },
  input_text: `${position} ${position}\n`,
  output: { sha256: `o${position}`.padEnd(64, '0'), size_bytes: 2 },
  output_preview: `${position * 2}\n`,
  skip_reason: null,
  ...overrides,
});

describe('countProblem', () => {
  it('accepts whole numbers from 1 to the maximum', () => {
    expect(countProblem('1')).toBeNull();
    expect(countProblem(' 7 ')).toBeNull();
    expect(countProblem(String(AI_MAX_COUNT))).toBeNull();
  });

  it('says what to fix otherwise', () => {
    expect(countProblem('')).toMatch(/whole number/);
    expect(countProblem('2.5')).toMatch(/whole number/);
    expect(countProblem('-3')).toMatch(/whole number/);
    expect(countProblem('0')).toMatch(/from 1 to 20/);
    expect(countProblem(String(AI_MAX_COUNT + 1))).toMatch(/from 1 to 20/);
  });
});

describe('failureHint', () => {
  it('suggests the next step for the errors the person can fix', () => {
    expect(failureHint('AI_KEY_INVALID')).toMatch(/save it again/);
    expect(failureHint('AI_QUOTA_EXCEEDED')).toMatch(/billing/);
    expect(failureHint('COMPILE_ERROR')).toMatch(/Solutions tab/);
    expect(failureHint('TIMED_OUT')).toBeNull();
  });
});

describe('usableItems', () => {
  it('keeps only the items that have an output', () => {
    const job = { items: [item(0), item(1, { status: 'skipped' }), item(2, { status: 'pending' })] } as AiTestJob;
    expect(usableItems(job).map((entry) => entry.id)).toEqual(['item-0']);
  });
});

describe('draftsFromAi', () => {
  const keys = () => {
    let next = 0;
    return () => `new-${next++}`;
  };
  const stage = vi.fn();

  it('makes unsaved, hidden testcases with the input and the generated output', async () => {
    const drafts = await draftsFromAi([item(0), item(1)], {}, keys(), stage);
    expect(stage).not.toHaveBeenCalled();
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      key: 'new-0',
      baseline: null,
      isSample: false,
      removed: false,
      input: { sha256: item(0).input!.sha256, size: 4, origin: 'paste', local: '0 0\n' },
      output: { sha256: item(0).output!.sha256, size: 2, origin: 'generated' },
    });
  });

  it('stages an edited input and drops its output, which belonged to the old input', async () => {
    stage.mockResolvedValue({ sha256: 'e'.repeat(64), size_bytes: 6, total_lines: 1 });
    const drafts = await draftsFromAi([item(0), item(1)], { 'item-1': '9 9 9\n' }, keys(), stage);
    expect(stage).toHaveBeenCalledTimes(1);
    expect(stage).toHaveBeenCalledWith('9 9 9\n');
    expect(drafts[0]!.output).not.toBeNull();
    expect(drafts[1]).toMatchObject({
      input: { sha256: 'e'.repeat(64), size: 6, local: '9 9 9\n' },
      output: null,
    });
  });

  it('treats an edit that restores the original text as no edit', async () => {
    stage.mockClear();
    const drafts = await draftsFromAi([item(0)], { 'item-0': '0 0\n' }, keys(), stage);
    expect(stage).not.toHaveBeenCalled();
    expect(drafts[0]!.output).not.toBeNull();
  });
});
