import { cn } from '@/lib/utils';
import type { Progress } from '../types';

/** "3 of 10 solved" with a bar. Nothing for a visitor (null), a plain note when there is nothing to solve yet. */
export function ProgressMeter({
  progress,
  label,
  className,
}: {
  progress: Progress | null;
  /** Names the bar for screen readers: "Progress in Warm-up". */
  label: string;
  className?: string;
}) {
  if (!progress) return null;
  const { solved, total } = progress;
  if (total === 0) return <p className={cn('text-small text-text-muted', className)}>No problems to solve yet</p>;
  const text = `${solved} of ${total} solved`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-small text-text-muted vd-mono">{text}</span>
      <div
        className="vd-meter"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={solved}
        aria-valuetext={text}
      >
        <span style={{ width: `${Math.round((solved / total) * 100)}%` }} />
      </div>
    </div>
  );
}
