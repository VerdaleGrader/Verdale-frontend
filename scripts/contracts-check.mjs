// Fails when lib/contracts/core-public.gen.ts is not a fresh generation of
// the pinned contracts/core-public.openapi.yaml.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const fresh = path.join(mkdtempSync(path.join(tmpdir(), 'verdale-contracts-')), 'core-public.gen.ts');
execFileSync('npx', ['openapi-typescript', path.join(root, 'contracts/core-public.openapi.yaml'), '-o', fresh], {
  stdio: 'ignore',
});
execFileSync('npx', ['prettier', '--config', path.join(root, '.prettierrc'), '--write', fresh], {
  stdio: 'ignore',
  cwd: root,
});
if (readFileSync(fresh, 'utf8') !== readFileSync(path.join(root, 'lib/contracts/core-public.gen.ts'), 'utf8')) {
  console.error('lib/contracts/core-public.gen.ts is out of date: run npm run contracts:generate');
  process.exit(1);
}
console.log('Generated contract types are up to date');
