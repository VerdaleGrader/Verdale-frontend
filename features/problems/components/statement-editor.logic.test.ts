import { describe, expect, it } from 'vitest';
import type { ProblemConstraints, ProblemEditor } from '../types';
import { draftOf, patchOf, validateDraft, type StatementDraft } from './statement-editor';

export const constraints: ProblemConstraints = {
  title_max_length: 200,
  statement_max_length: 100000,
  time_limit_ms: { min: 100, max: 10000, default: 1000 },
  memory_limit_kb: { min: 16384, max: 1048576, default: 262144 },
  languages: ['c', 'cpp', 'python'],
  tests: {
    max_count: 100,
    max_total_bytes: 134217728,
    max_file_bytes: 8388608,
    max_sample_bytes: 65536,
    max_samples: 10,
  },
  images: { max_bytes: 2097152, content_types: ['image/png', 'image/jpeg', 'image/webp'] },
  solutions: { max_count: 5 },
  source_max_bytes: 65536,
};

const base: StatementDraft = {
  title: 'Sum',
  statement: '# Hi',
  timeLimitMs: '1000',
  memoryLimitMb: '256',
  languages: ['c', 'cpp'],
};

describe('validateDraft', () => {
  it('has no complaint about a good draft', () => {
    expect(validateDraft(base, constraints)).toEqual({});
  });

  it('accepts the edges of the ranges', () => {
    expect(validateDraft({ ...base, timeLimitMs: '100', memoryLimitMb: '16' }, constraints)).toEqual({});
    expect(validateDraft({ ...base, timeLimitMs: '10000', memoryLimitMb: '1024' }, constraints)).toEqual({});
  });

  it.each([
    [{ title: '   ' }, 'title', 'Enter a title.'],
    [{ title: 'x'.repeat(201) }, 'title', 'Use at most 200 characters.'],
    [{ timeLimitMs: '99' }, 'timeLimitMs', 'Use between 100 and 10000 ms.'],
    [{ timeLimitMs: '10001' }, 'timeLimitMs', 'Use between 100 and 10000 ms.'],
    [{ timeLimitMs: '' }, 'timeLimitMs', 'Use a whole number of milliseconds.'],
    [{ timeLimitMs: '1.5' }, 'timeLimitMs', 'Use a whole number of milliseconds.'],
    [{ timeLimitMs: 'fast' }, 'timeLimitMs', 'Use a whole number of milliseconds.'],
    [{ memoryLimitMb: '15' }, 'memoryLimitMb', 'Use between 16 and 1024 MB.'],
    [{ memoryLimitMb: '1025' }, 'memoryLimitMb', 'Use between 16 and 1024 MB.'],
    [{ memoryLimitMb: 'lots' }, 'memoryLimitMb', 'Use a whole number of megabytes.'],
    [{ languages: [] }, 'languages', 'Allow at least one language.'],
  ] as Array<[Partial<StatementDraft>, string, string]>)('flags %j on %s', (change, field, message) => {
    expect(validateDraft({ ...base, ...change }, constraints)).toEqual({ [field]: message });
  });

  it('reports every problem at once', () => {
    const errors = validateDraft({ ...base, title: '', timeLimitMs: '1', languages: [] }, constraints);
    expect(Object.keys(errors).sort()).toEqual(['languages', 'timeLimitMs', 'title']);
  });
});

describe('patchOf', () => {
  it('sends nothing when nothing changed', () => {
    expect(patchOf(base, base)).toEqual({});
  });

  it('sends only what changed, in the API’s units', () => {
    expect(patchOf({ ...base, timeLimitMs: '2500', memoryLimitMb: '128' }, base)).toEqual({
      time_limit_ms: 2500,
      memory_limit_kb: 131072,
    });
    expect(patchOf({ ...base, title: '  New title ', statement: 'x' }, base)).toEqual({
      title: 'New title',
      statement: 'x',
    });
    expect(patchOf({ ...base, languages: ['python'] }, base)).toEqual({ allowed_languages: ['python'] });
  });
});

describe('draftOf', () => {
  it('turns the editor view into form values (memory in MB, languages in a fixed order)', () => {
    const editor = {
      version: {
        title: 'T',
        statement: 'S',
        time_limit_ms: 1500,
        memory_limit_kb: 65536,
        allowed_languages: ['python', 'c'],
      },
    } as unknown as ProblemEditor;
    expect(draftOf(editor)).toEqual({
      title: 'T',
      statement: 'S',
      timeLimitMs: '1500',
      memoryLimitMb: '64',
      languages: ['c', 'python'],
    });
  });
});
