import {
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  Code,
  Ellipsis,
  Layers,
  LoaderCircle,
  Minus,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Final verdicts plus the in-flight states of a test or submission. */
export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'OLE' | 'ISE' | 'QUEUED' | 'RUNNING' | 'SKIPPED';

interface VerdictMeta {
  label: string;
  /** Short code shown next to the icon (empty for in-flight states). Never colour alone: icon + code + label. */
  code: string;
  icon: LucideIcon;
  /** vd-verdict--<tone> and vd-cell--<cell> suffixes. */
  tone: 'ac' | 'wa' | 'tle' | 'mle' | 're' | 'ce' | 'ole' | 'ise' | 'pending';
  cell: 'ac' | 'wa' | 'tle' | 'mle' | 're' | 'ce' | 'ole' | 'ise' | 'queued' | 'running' | 'skipped';
}

// Labels are fixed by the design system (Voice and copy); icons are Lucide, as listed in Iconography.
export const VERDICTS: Record<Verdict, VerdictMeta> = {
  AC: { label: 'Accepted', code: 'AC', icon: CircleCheck, tone: 'ac', cell: 'ac' },
  WA: { label: 'Wrong answer', code: 'WA', icon: CircleX, tone: 'wa', cell: 'wa' },
  TLE: { label: 'Time limit exceeded', code: 'TLE', icon: Clock, tone: 'tle', cell: 'tle' },
  MLE: { label: 'Memory limit exceeded', code: 'MLE', icon: Layers, tone: 'mle', cell: 'mle' },
  RE: { label: 'Runtime error', code: 'RE', icon: Zap, tone: 're', cell: 're' },
  CE: { label: 'Compilation error', code: 'CE', icon: Code, tone: 'ce', cell: 'ce' },
  // Output limit has its own teal. An internal error is the judge's fault, not the solver's result:
  // it has its own rose and a dashed outline so it never reads as a normal verdict.
  OLE: { label: 'Output limit exceeded', code: 'OLE', icon: Ban, tone: 'ole', cell: 'ole' },
  ISE: { label: 'Internal error', code: 'ISE', icon: Wrench, tone: 'ise', cell: 'ise' },
  QUEUED: { label: 'Queued', code: '', icon: Ellipsis, tone: 'pending', cell: 'queued' },
  RUNNING: { label: 'Running', code: '', icon: LoaderCircle, tone: 'pending', cell: 'running' },
  SKIPPED: { label: 'Skipped', code: '', icon: Minus, tone: 'pending', cell: 'skipped' },
};

export const FINAL_VERDICTS: Verdict[] = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'OLE', 'ISE'];

/** What each verdict means and what to do next, in plain words (GRD-49). */
export const VERDICT_EXPLANATIONS: Record<Verdict, string> = {
  AC: 'Your program printed the expected output for every test within the time and memory limits.',
  WA: 'Your program ran, but its output differs from the expected output on at least one test. Check the sample results below, then think about edge cases such as the smallest and largest inputs.',
  TLE: 'Your program took longer than the time limit on at least one test. Look for a faster approach or for a loop that never ends.',
  MLE: 'Your program used more memory than the limit allows. Use smaller data structures or avoid storing everything at once.',
  RE: 'Your program crashed while running: for example an out-of-range index, a division by zero, or a non-zero exit code.',
  CE: 'Your code did not compile, so no test was run. The compiler message is shown below.',
  OLE: 'Your program wrote more output than allowed. Check for a loop that prints forever or leftover debug output.',
  ISE: 'Something went wrong on our side while judging. This is not caused by your code and it does not count against you. You can check it again.',
  QUEUED: 'Your solution is waiting for a free judge.',
  RUNNING: 'Your solution is being run against the tests.',
  SKIPPED: 'This test was not run because an earlier test did not pass.',
};

/** One line per verdict for the info popover (VerdictInfo); the longer text above is for a submission's own page. */
export const VERDICT_SUMMARIES: Record<Verdict, string> = {
  AC: 'Every testcase gave the expected output within the limits.',
  WA: 'The output differs from the expected output on at least one testcase.',
  TLE: 'The program ran longer than the time limit.',
  MLE: 'The program used more memory than the limit.',
  RE: 'The program crashed or exited with a non-zero code.',
  CE: 'The code did not compile, so no testcase was run.',
  OLE: 'The program printed more output than allowed.',
  ISE: 'The judge failed while running it. Not the solver’s fault.',
  QUEUED: 'Waiting for a free judge.',
  RUNNING: 'Being run against the testcases.',
  SKIPPED: 'Not run, because an earlier testcase did not pass.',
};
