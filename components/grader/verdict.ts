import {
  CircleCheck,
  CircleX,
  Clock,
  Code,
  Ellipsis,
  FileWarning,
  Layers,
  LoaderCircle,
  Minus,
  TriangleAlert,
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
  tone: 'ac' | 'wa' | 'tle' | 'mle' | 're' | 'ce' | 'pending';
  cell: 'ac' | 'wa' | 'tle' | 'mle' | 're' | 'ce' | 'queued' | 'running' | 'skipped';
}

// Labels are fixed by the design system (Voice and copy); icons are Lucide, as listed in Iconography.
export const VERDICTS: Record<Verdict, VerdictMeta> = {
  AC: { label: 'Accepted', code: 'AC', icon: CircleCheck, tone: 'ac', cell: 'ac' },
  WA: { label: 'Wrong answer', code: 'WA', icon: CircleX, tone: 'wa', cell: 'wa' },
  TLE: { label: 'Time limit exceeded', code: 'TLE', icon: Clock, tone: 'tle', cell: 'tle' },
  MLE: { label: 'Memory limit exceeded', code: 'MLE', icon: Layers, tone: 'mle', cell: 'mle' },
  RE: { label: 'Runtime error', code: 'RE', icon: Zap, tone: 're', cell: 're' },
  CE: { label: 'Compilation error', code: 'CE', icon: Code, tone: 'ce', cell: 'ce' },
  // Output limit shares the resource-limit colours; a system error is neutral because it is not the solver's result.
  OLE: { label: 'Output limit exceeded', code: 'OLE', icon: FileWarning, tone: 'mle', cell: 'mle' },
  ISE: { label: 'System error', code: 'ISE', icon: TriangleAlert, tone: 'pending', cell: 'queued' },
  QUEUED: { label: 'Queued', code: '', icon: Ellipsis, tone: 'pending', cell: 'queued' },
  RUNNING: { label: 'Running', code: '', icon: LoaderCircle, tone: 'pending', cell: 'running' },
  SKIPPED: { label: 'Skipped', code: '', icon: Minus, tone: 'pending', cell: 'skipped' },
};

export const FINAL_VERDICTS: Verdict[] = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'OLE', 'ISE'];

/** What each verdict means and what to do next, in plain words (GRD-49). */
export const VERDICT_EXPLANATIONS: Record<Verdict, string> = {
  AC: 'Your program printed the expected output for every testcase within the time and memory limits.',
  WA: 'Your program ran, but its output differs from the expected output on at least one testcase. Check the sample results below, then think about edge cases such as the smallest and largest inputs.',
  TLE: 'Your program took longer than the time limit on at least one testcase. Look for a faster approach or for a loop that never ends.',
  MLE: 'Your program used more memory than the limit allows. Use smaller data structures or avoid storing everything at once.',
  RE: 'Your program crashed while running: for example an out-of-range index, a division by zero, or a non-zero exit code.',
  CE: 'Your code did not compile, so no testcase was run. The compiler message is shown below.',
  OLE: 'Your program wrote more output than allowed. Check for a loop that prints forever or leftover debug output.',
  ISE: 'Something went wrong on our side while judging. This is not caused by your code and it does not count against you. You can check it again.',
  QUEUED: 'Your solution is waiting for a free judge.',
  RUNNING: 'Your solution is being run against the testcases.',
  SKIPPED: 'This testcase was not run because an earlier testcase did not pass.',
};
