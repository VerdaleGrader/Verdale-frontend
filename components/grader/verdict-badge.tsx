import { cn } from '@/lib/utils';
import { VERDICTS, type Verdict } from './verdict';

/**
 * - `full`: icon and the full name ("Wrong answer"). The default.
 * - `short`: the code ("WA") where space runs out; Queued, Running and Skipped have no code and keep their icon.
 * - `auto`: full, switching to short on narrow screens. For table cells.
 */
export type VerdictFormat = 'full' | 'short' | 'auto';

/**
 * Result of a submission or one testcase. The code is never shown beside the name; both forms carry
 * words or letters, so colour is never the only signal. Put a VerdictInfo next to it so people can look the codes up.
 */
export function VerdictBadge({
  verdict,
  detail,
  format = 'full',
  compact,
  className,
}: {
  verdict: Verdict;
  /** Replaces the full name, e.g. "Wrong answer on testcase 4". The short form keeps the code and carries this in its title. */
  detail?: string;
  format?: VerdictFormat;
  /** @deprecated Use `format="short"`. */
  compact?: boolean;
  className?: string;
}) {
  const meta = VERDICTS[verdict];
  const Icon = meta.icon;
  const label = detail ?? meta.label;
  const shape = compact ? 'short' : format;
  const showIcon = shape !== 'short' || !meta.code;
  return (
    <span
      className={cn(
        'vd-verdict',
        `vd-verdict--${meta.tone}`,
        shape === 'short' && 'vd-verdict--short',
        shape === 'auto' && 'vd-verdict--auto',
        className
      )}
      title={shape === 'full' ? undefined : label}
    >
      {showIcon && (
        <Icon
          className={cn('vd-icon vd-verdict__icon size-3.5', verdict === 'RUNNING' && 'vd-spin')}
          data-coded={meta.code ? '' : undefined}
          strokeWidth={1.75}
          aria-hidden
        />
      )}
      {meta.code && shape !== 'full' && (
        <span className="vd-verdict__code" aria-hidden>
          {meta.code}
        </span>
      )}
      {shape === 'short' ? <span className="vd-sr">{label}</span> : <span className="vd-verdict__label">{label}</span>}
    </span>
  );
}
