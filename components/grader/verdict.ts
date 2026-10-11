import {
  CircleCheck,
  CircleX,
  Clock,
  Code,
  Ellipsis,
  Layers,
  LoaderCircle,
  Minus,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Final verdicts plus the in-flight states of a test or submission. */
export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'QUEUED' | 'RUNNING' | 'SKIPPED';

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
  QUEUED: { label: 'Queued', code: '', icon: Ellipsis, tone: 'pending', cell: 'queued' },
  RUNNING: { label: 'Running', code: '', icon: LoaderCircle, tone: 'pending', cell: 'running' },
  SKIPPED: { label: 'Skipped', code: '', icon: Minus, tone: 'pending', cell: 'skipped' },
};

export const FINAL_VERDICTS: Verdict[] = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE'];
