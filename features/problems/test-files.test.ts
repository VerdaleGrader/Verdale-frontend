import { describe, expect, it } from 'vitest';
import { classify, naturalCompare, pairTestFiles, type PickedFile } from './test-files';

const file = (name: string, path?: string): PickedFile => ({ name, path: path ?? name, size: 10 });

describe('classify', () => {
  it.each([
    ['1.in', 'input', '1'],
    ['1.out', 'output', '1'],
    ['01.ans', 'output', '01'],
    ['case.input', 'input', 'case'],
    ['case.OUTPUT', 'output', 'case'],
    ['A.IN', 'input', 'a'],
    ['sample.sol', 'output', 'sample'],
    ['input1.txt', 'input', '1'],
    ['output1.txt', 'output', '1'],
    ['in_a.txt', 'input', 'a'],
    ['out-a.txt', 'output', 'a'],
    ['answer7.txt', 'output', '7'],
  ])('%s is the %s side of %s', (name, side, stem) => {
    expect(classify(file(name))).toEqual({ side, stem });
  });

  it('reads the folder when the name does not say', () => {
    expect(classify(file('1.txt', 'tests/in/1.txt'))).toEqual({ side: 'input', stem: '1' });
    expect(classify(file('1.txt', 'tests/Output/1.txt'))).toEqual({ side: 'output', stem: '1' });
  });

  it.each(['notes.txt', 'README.md', 'data.csv', 'index.html', 'main.cpp', 'outline.md', 'inside.txt'])(
    'cannot tell what %s is',
    (name) => {
      expect(classify(file(name))).toBeNull();
    }
  );
});

describe('naturalCompare', () => {
  it('puts 2 before 10 and a2 before a10', () => {
    expect(['10', '2', '1'].sort(naturalCompare)).toEqual(['1', '2', '10']);
    expect(['a10', 'a2', 'a1'].sort(naturalCompare)).toEqual(['a1', 'a2', 'a10']);
  });
});

describe('pairTestFiles', () => {
  it('pairs by name, in natural order, whatever order the files were picked in', () => {
    const { pairs, unpaired } = pairTestFiles([
      file('10.out'),
      file('2.in'),
      file('10.in'),
      file('1.out'),
      file('2.out'),
      file('1.in'),
    ]);
    expect(pairs.map((pair) => [pair.name, pair.input.name, pair.output.name])).toEqual([
      ['1', '1.in', '1.out'],
      ['2', '2.in', '2.out'],
      ['10', '10.in', '10.out'],
    ]);
    expect(unpaired).toEqual([]);
  });

  it('accepts .ans and .out as the output side, and mixed conventions in one drop', () => {
    const { pairs } = pairTestFiles([file('a.in'), file('a.ans'), file('input2.txt'), file('output2.txt')]);
    expect(pairs.map((pair) => pair.name)).toEqual(['2', 'a']);
  });

  it('says which files have no partner, and why', () => {
    const { pairs, unpaired } = pairTestFiles([
      file('1.in'),
      file('1.out'),
      file('2.in'),
      file('3.out'),
      file('readme.txt'),
    ]);
    expect(pairs.map((pair) => pair.name)).toEqual(['1']);
    const byName = Object.fromEntries(unpaired.map((item) => [item.file.name, item.reason]));
    expect(byName['2.in']).toBe('No matching output file.');
    expect(byName['3.out']).toBe('No matching input file.');
    expect(byName['readme.txt']).toMatch(/Cannot tell whether this is an input or an output/);
  });

  it('does not guess when two files claim the same name', () => {
    const { pairs, unpaired } = pairTestFiles([file('1.in'), file('1.input'), file('1.out')]);
    expect(pairs).toEqual([]);
    expect(unpaired).toHaveLength(3);
    expect(unpaired.every((item) => /More than one file matches/.test(item.reason))).toBe(true);
  });

  it('pairs a folder of in/ and out/ files', () => {
    const { pairs } = pairTestFiles([
      file('1.txt', 'tests/in/1.txt'),
      file('1.txt', 'tests/out/1.txt'),
      file('2.txt', 'tests/in/2.txt'),
      file('2.txt', 'tests/out/2.txt'),
    ]);
    expect(pairs.map((pair) => pair.name)).toEqual(['1', '2']);
  });

  it('is empty for no files', () => {
    expect(pairTestFiles([])).toEqual({ pairs: [], unpaired: [] });
  });
});
