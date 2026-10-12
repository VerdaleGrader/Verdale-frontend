import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TESTCASE_EXAMPLES } from './examples';
import { pairTestFiles } from './test-files';

const publicFile = (href: string) => join(process.cwd(), 'public', href);

describe('example files for Upload files', () => {
  it('has every linked file in public/', () => {
    for (const example of TESTCASE_EXAMPLES) expect(existsSync(publicFile(example.href))).toBe(true);
  });

  it('are plain text the way Core stores it: UTF-8, LF, one final newline, no blank lines at the end', () => {
    for (const name of ['1.in', '1.out']) {
      const text = readFileSync(publicFile(`/examples/testcases/${name}`), 'utf8');
      expect(text.endsWith('\n')).toBe(true);
      expect(text.endsWith('\n\n')).toBe(false);
      expect(text).not.toContain('\r');
      expect(text).not.toContain('\0');
    }
  });

  it('are matched into a pair by the same rules the page uses', () => {
    const { pairs, unpaired } = pairTestFiles([
      { name: '1.in', size: 18 },
      { name: '1.out', size: 4 },
    ]);
    expect(pairs.map((pair) => pair.name)).toEqual(['1']);
    expect(unpaired).toEqual([]);
  });

  it('the folder example (in/1.txt with out/1.txt) pairs by folder name', () => {
    const picked = ['in', 'out'].flatMap((folder) =>
      [1, 2, 3].map((n) => ({ name: `${n}.txt`, path: `testcases/${folder}/${n}.txt`, size: 5 }))
    );
    const { pairs, unpaired } = pairTestFiles(picked);
    expect(pairs.map((pair) => pair.name)).toEqual(['1', '2', '3']);
    expect(unpaired).toEqual([]);
  });
});
