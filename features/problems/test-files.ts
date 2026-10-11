/**
 * Turning a pile of chosen files into input/output pairs (GRD-29).
 *
 * Conventions understood, case-insensitively:
 *   1.in + 1.out          1.in + 1.ans          01.input + 01.output
 *   input1.txt + output1.txt     in_a.txt + out_a.txt
 *   in/1.txt + out/1.txt  (the folder says which is which)
 */
export interface PickedFile {
  name: string;
  /** Folder path when a whole folder was chosen or dropped. */
  path?: string;
  size: number;
}

export type Side = 'input' | 'output';

export interface Classified {
  side: Side;
  /** What the two halves of a pair have in common. */
  stem: string;
}

const INPUT_EXTENSIONS = new Set(['in', 'inp', 'input']);
const OUTPUT_EXTENSIONS = new Set(['out', 'ans', 'answer', 'output', 'sol', 'res']);
const INPUT_FOLDERS = new Set(['in', 'input', 'inputs']);
const OUTPUT_FOLDERS = new Set(['out', 'output', 'outputs', 'ans', 'answers']);
// "input1", "in_a" and "out-3", but not "index" or "outline": a separator or a digit must follow the prefix.
const INPUT_PREFIX = /^(?:input|inp|in)(?:[ _.-]+(.+)|(\d.*))$/;
const OUTPUT_PREFIX = /^(?:output|out|answer|ans)(?:[ _.-]+(.+)|(\d.*))$/;

export function classify(file: PickedFile): Classified | null {
  const base = file.name.toLowerCase();
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot + 1) : '';

  if (INPUT_EXTENSIONS.has(extension)) return { side: 'input', stem };
  if (OUTPUT_EXTENSIONS.has(extension)) return { side: 'output', stem };

  const folders = (file.path ?? '').toLowerCase().split('/').slice(0, -1);
  const parent = folders[folders.length - 1];
  if (parent && INPUT_FOLDERS.has(parent)) return { side: 'input', stem };
  if (parent && OUTPUT_FOLDERS.has(parent)) return { side: 'output', stem };

  const inputMatch = INPUT_PREFIX.exec(stem);
  const inputStem = inputMatch?.[1] ?? inputMatch?.[2];
  if (inputStem && /^\w/.test(inputStem)) return { side: 'input', stem: inputStem };
  const outputMatch = OUTPUT_PREFIX.exec(stem);
  const outputStem = outputMatch?.[1] ?? outputMatch?.[2];
  if (outputStem && /^\w/.test(outputStem)) return { side: 'output', stem: outputStem };
  return null;
}

/** 2 before 10, "a2" before "a10". */
export function naturalCompare(left: string, right: string): number {
  return left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' });
}

export interface Pair<T extends PickedFile> {
  name: string;
  input: T;
  output: T;
}

export interface Pairing<T extends PickedFile> {
  pairs: Array<Pair<T>>;
  /** Files that have no partner or whose role could not be told. */
  unpaired: Array<{ file: T; reason: string }>;
}

export function pairTestFiles<T extends PickedFile>(files: T[]): Pairing<T> {
  const inputs = new Map<string, T[]>();
  const outputs = new Map<string, T[]>();
  const unpaired: Pairing<T>['unpaired'] = [];

  for (const file of files) {
    const kind = classify(file);
    if (!kind) {
      unpaired.push({ file, reason: 'Cannot tell whether this is an input or an output. Name it like 1.in / 1.out.' });
      continue;
    }
    const bucket = kind.side === 'input' ? inputs : outputs;
    bucket.set(kind.stem, [...(bucket.get(kind.stem) ?? []), file]);
  }

  const pairs: Array<Pair<T>> = [];
  const stems = new Set([...inputs.keys(), ...outputs.keys()]);
  for (const stem of [...stems].sort(naturalCompare)) {
    const input = inputs.get(stem) ?? [];
    const output = outputs.get(stem) ?? [];
    if (input.length === 1 && output.length === 1) {
      pairs.push({ name: stem, input: input[0]!, output: output[0]! });
      continue;
    }
    for (const file of input) {
      unpaired.push({
        file,
        reason: output.length === 0 ? 'No matching output file.' : 'More than one file matches this name.',
      });
    }
    for (const file of output) {
      unpaired.push({
        file,
        reason: input.length === 0 ? 'No matching input file.' : 'More than one file matches this name.',
      });
    }
  }
  return { pairs, unpaired };
}
