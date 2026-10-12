/**
 * Ready-made example files for the Upload files panel (GRD-90), one per way the page takes files. They sit in
 * `public/examples/testcases` and follow the naming `pairTestFiles` understands (test-files.ts).
 */
export const TESTCASE_EXAMPLES = [
  {
    href: '/examples/testcases/1.in',
    label: '1.in',
    detail: 'Input of one testcase, as a text file.',
  },
  {
    href: '/examples/testcases/1.out',
    label: '1.out',
    detail: 'Its expected output; choose both files together.',
  },
  {
    href: '/examples/testcases/testcases-pairs.zip',
    label: 'testcases-pairs.zip',
    detail: 'Three pairs (1.in, 1.out, 2.in, …) to unzip and choose at once.',
  },
  {
    href: '/examples/testcases/testcases-in-out-folders.zip',
    label: 'testcases-in-out-folders.zip',
    detail: 'The in/ and out/ folder layout (in/1.txt with out/1.txt); unzip, then use Choose a folder.',
  },
] as const;
