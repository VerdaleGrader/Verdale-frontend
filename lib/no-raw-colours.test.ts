import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'features', 'lib'];
// Where hex is legitimate: the generated tokens, Monaco (which reads hex, guarded by its own test) and tests.
const ALLOWED = [/app\/tokens\.css$/, /lib\/monaco-themes\.ts$/, /lib\/contracts\//, /\.test\.tsx?$/];

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

describe('design tokens only', () => {
  it('no component, page or stylesheet writes a raw hex colour', () => {
    const offenders: string[] = [];
    for (const directory of SOURCE_DIRS) {
      for (const file of files(path.join(root, directory))) {
        if (!/\.(tsx?|css)$/.test(file) || ALLOWED.some((pattern) => pattern.test(file))) continue;
        const text = readFileSync(file, 'utf8');
        const hits = text.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (hits) offenders.push(`${path.relative(root, file)}: ${hits.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
