import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'info' | 'warning' | 'danger';

/** A short static label: visibility, role, "Sample". Not for verdicts (use VerdictBadge). */
export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('vd-badge', `vd-badge--${tone}`, className)}>
      {Icon && <Icon className="vd-icon size-3.5" strokeWidth={1.75} aria-hidden />}
      {children}
    </span>
  );
}
