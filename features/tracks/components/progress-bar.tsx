import { progressPercent, progressText, type Progress } from '../types';

/** Solved out of total as a bar with the numbers beside it. */
export function ProgressBar({ progress, label }: { progress: Progress; label: string }) {
  const percent = progressPercent(progress);
  return (
    <div className="flex flex-col gap-1">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.solved}
        aria-valuetext={progressText(progress)}
        className="vd-bar"
      >
        <span className="vd-bar__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-small text-text-muted">{progressText(progress)}</span>
    </div>
  );
}
