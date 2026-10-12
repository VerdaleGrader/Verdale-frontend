import { cn } from '@/lib/utils';
import { VERDICTS, type Verdict } from './verdict';

/** Result of a submission or one test: icon, code and label on the verdict's soft background. */
export function VerdictBadge({
  verdict,
  detail,
  compact,
  className,
}: {
  verdict: Verdict;
  /** Replaces the label, e.g. "Wrong answer on testcase 4". */
  detail?: string;
  /** Icon and code only; the label stays for screen readers and in a title. */
  compact?: boolean;
  className?: string;
}) {
  const meta = VERDICTS[verdict];
  const Icon = meta.icon;
  const label = detail ?? meta.label;
  return (
    <span
      className={cn('vd-verdict', `vd-verdict--${meta.tone}`, compact && 'vd-verdict--compact', className)}
      title={compact ? label : undefined}
    >
      <Icon className={cn('vd-icon size-3.5', verdict === 'RUNNING' && 'vd-spin')} strokeWidth={1.75} aria-hidden />
      {meta.code && (
        <span className="vd-verdict__code" aria-hidden={!compact ? true : undefined}>
          {meta.code}
        </span>
      )}
      {compact ? <span className="vd-sr">{label}</span> : <span className="vd-verdict__label">{label}</span>}
    </span>
  );
}
