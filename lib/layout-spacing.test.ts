import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(__dirname, '../app/components.css'), 'utf8');

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('table rows have room (GRD-70)', () => {
  it('cells have vertical padding on the shared table, so every table gets it', () => {
    const cell = rule('.vd-table td');
    expect(cell).toMatch(/padding:\s*var\(--space-2\)\s+var\(--space-3\)/);
    expect(cell).toMatch(/height:\s*var\(--row-compact\)/); // still the compact row height as the minimum
  });

  it('a second line in a cell is spaced from the first', () => {
    expect(rule('.vd-cell-sub')).toMatch(/margin-top:\s*var\(--space-1\)/);
  });

  it('uses the shared table in the problem, member and submission tables', () => {
    const root = path.resolve(__dirname, '..');
    for (const file of [
      'features/problems/components/problem-list.tsx',
      'features/spaces/components/members-panel.tsx',
      'components/grader/submission-table.tsx',
    ]) {
      expect(readFileSync(path.join(root, file), 'utf8'), file).toContain('vd-table');
    }
  });
});
