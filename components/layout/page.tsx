import { cn } from '@/lib/utils';

/** Page gutter space-6 on mobile and space-8 from md up; max width for working pages. */
export function PageContainer({
  children,
  className,
  narrow,
  tight,
}: {
  children: React.ReactNode;
  className?: string;
  /** Reading width (72ch) instead of the full working width. */
  narrow?: boolean;
  /** Smaller side margins for pages that need room (problem page, problem editor). */
  tight?: boolean;
}) {
  return (
    <main
      id="main"
      className={cn(
        'mx-auto flex w-full flex-col gap-6 py-8',
        tight ? 'px-3 md:px-4' : 'px-6 md:px-8',
        narrow ? 'max-w-[var(--measure)]' : 'max-w-5xl',
        className
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-h1 break-words">{title}</h1>
        {description && <p className="text-prose text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
