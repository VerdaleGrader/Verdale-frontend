import { describe, expect, it } from 'vitest';
import {
  describeOutputBeforeStop,
  parseCompilerMessages,
  signalName,
  sourceFileName,
  summariseRuntimeError,
} from './diagnostics';

describe('parseCompilerMessages', () => {
  it('lists the errors and warnings of a GCC message with line and column', () => {
    const output = `main.cpp: In function 'int main()':
main.cpp:15:23: error: 'need' was not declared in this scope
   15 |         if (seen.count(need)) {
main.cpp:14:13: warning: unused variable 'needed' [-Wunused-variable]`;
    expect(parseCompilerMessages(output)).toEqual([
      { level: 'error', line: 15, column: 23, text: "'need' was not declared in this scope" },
      { level: 'warning', line: 14, column: 13, text: "unused variable 'needed' [-Wunused-variable]" },
    ]);
  });

  it('counts a fatal error as an error and copes with a missing column', () => {
    expect(parseCompilerMessages('a.c:3: fatal error: stdio.h: No such file')).toEqual([
      { level: 'error', line: 3, column: undefined, text: 'stdio.h: No such file' },
    ]);
  });

  it('finds nothing in text it does not know', () => {
    expect(parseCompilerMessages('SyntaxError: invalid syntax')).toEqual([]);
  });
});

describe('summariseRuntimeError', () => {
  it('names the uncaught C++ exception and its reason', () => {
    const stderr = "terminate called after throwing an instance of 'std::out_of_range'\n  what():  vector::at\nAborted";
    expect(summariseRuntimeError(stderr, 134, 6)).toEqual({
      headline: 'The program stopped on an uncaught exception: std::out_of_range',
      cause: 'vector::at',
      status: 'SIGABRT (6) · exit code 134',
    });
  });

  it('reads the last line of a Python traceback', () => {
    const stderr = 'Traceback (most recent call last):\n  File "m.py", line 2\nIndexError: list index out of range\n';
    const summary = summariseRuntimeError(stderr, 1, null);
    expect(summary.headline).toBe('The program stopped on an uncaught exception: IndexError');
    expect(summary.cause).toBe('list index out of range');
    expect(summary.status).toBe('exit code 1');
  });

  it('explains a signal with no stderr, and a plain non-zero exit', () => {
    expect(summariseRuntimeError('', null, 11).headline).toBe(
      'The program stopped after a segmentation fault (invalid memory access).'
    );
    expect(summariseRuntimeError('boom', 3, null).headline).toBe('The program ended with a non-zero exit code (3).');
    expect(signalName(99)).toBe('signal 99');
  });
});

describe('describeOutputBeforeStop', () => {
  it('says how much was printed and whether it matches', () => {
    expect(describeOutputBeforeStop(['2', '0 6', '1 5', '3 4'], ['2', '0 6'])).toBe(
      '2 of 4 expected lines were printed. All of them match.'
    );
    expect(describeOutputBeforeStop(['2', '0 6'], ['2', '9'])).toBe(
      '2 of 2 expected lines were printed. 1 of them differs.'
    );
    expect(describeOutputBeforeStop(['1'], [])).toBe('Nothing was printed. 1 line was expected.');
  });
});

describe('sourceFileName', () => {
  it('follows the language', () => {
    expect([sourceFileName('c'), sourceFileName('cpp'), sourceFileName('python')]).toEqual([
      'main.c',
      'main.cpp',
      'main.py',
    ]);
  });
});
