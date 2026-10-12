import { describe, expect, it } from 'vitest';
import type { LoadedPart } from '../../hooks/use-test-windows';
import { comparison } from './testcase-panel';

const part = (lines: string[], over: Partial<LoadedPart> = {}): LoadedPart => ({
  lines,
  totalLines: lines.length,
  sizeBytes: 0,
  cut: false,
  unavailable: false,
  lineTruncated: false,
  complete: true,
  ...over,
});

describe('comparison of what is loaded', () => {
  it('compares everything when both files are complete', () => {
    const result = comparison(part(['1', '2']), part(['1']));
    expect(result).toMatchObject({ expected: '1\n2', actual: '1', compared: null, more: [] });
  });

  it('compares only what both sides have loaded, so an unloaded line is never reported as missing', () => {
    const result = comparison(
      part(['1', '2'], { complete: false, totalLines: 9 }),
      part(['1', '2', '3'], { complete: false, totalLines: 9 })
    );
    expect(result.expected).toBe('1\n2');
    expect(result.actual).toBe('1\n2');
    expect(result.compared).toBe(2);
    expect(result.more).toEqual(['expected', 'output']);
  });

  it('keeps a complete expected output whole so extra output lines show as extra', () => {
    const result = comparison(part(['1']), part(['1', '9', '9'], { complete: false, totalLines: 50 }));
    expect(result.expected).toBe('1');
    expect(result.actual).toBe('1\n9\n9');
    expect(result.more).toEqual(['output']);
  });

  it('drops the last, possibly half, line of an output Judge cut and what is expected after it', () => {
    const result = comparison(part(['1', '2', '3', '4']), part(['1', '2', '3 half'], { cut: true }));
    expect(result.stored).toBe(true);
    expect(result.actual).toBe('1\n2');
    expect(result.expected).toBe('1\n2');
  });
});
