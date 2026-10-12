import { cn } from '@/lib/utils';

interface Stat {
  label: string;
  value: React.ReactNode;
  /** `brand` for the number that means success, e.g. Solved. */
  tone?: 'default' | 'brand';
}

/** Numbers in a header (member, track, problem, submission) as a description list: a small label over a mono figure. */
export function StatSummary({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl className={cn('vd-stats', className)}>
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd className={cn(stat.tone === 'brand' && 'is-brand')}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type { Stat };
