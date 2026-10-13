import { cn } from '@/lib/utils';

/** A landing section: wide gutter container, with an optional tinted band. */
export function Section({
  id,
  titleId,
  band,
  children,
  className,
}: {
  id?: string;
  titleId: string;
  /** Surface-coloured band with borders above and below. */
  band?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={titleId} className={cn(band && 'bg-surface border-border border-y')}>
      <div className={cn('mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-6 py-16 md:px-8 md:py-24', className)}>
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  titleId,
  children,
}: {
  eyebrow: string;
  title: string;
  titleId: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <p className="text-mono-label text-text-muted">{eyebrow}</p>
      <h2 id={titleId} className="text-display md:text-display-lg">
        {title}
      </h2>
      {children && <p className="text-prose text-text-muted">{children}</p>}
    </div>
  );
}
