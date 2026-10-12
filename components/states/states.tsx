import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Nothing here yet: say what it is for and offer the next step. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <Inbox className="text-text-muted size-6" strokeWidth={1.75} aria-hidden />
      <div className="flex max-w-prose flex-col gap-1">
        <h2 className="text-h3">{title}</h2>
        {description && <p className="text-small text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Something failed: what happened and what to do next, with a retry when it can help. */
export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  reference,
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  /** Request id to quote to the Space owner. Defaults to the id Core sent with the error. */
  reference?: string;
}) {
  const requestId = reference ?? (error instanceof ApiError ? error.requestId : undefined);
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : 'An unexpected error occurred. Try again.';
  return (
    <div role="alert" className="border-border bg-danger-soft flex flex-col items-start gap-3 rounded-lg border p-4">
      <div className="text-danger flex items-center gap-2">
        <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <h2 className="text-body-strong">{title}</h2>
      </div>
      <p className="text-small text-text">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
      {requestId && <span className="vd-mono text-text-muted">Reference: {requestId}</span>}
    </div>
  );
}

/** Spinner with words, for a section that is loading (static under reduced motion via the global rule). */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="text-text-muted text-small flex items-center gap-2 py-8">
      <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />
      {label}…
    </div>
  );
}

/** A grey bar standing in for text that is still loading. Still under reduced motion (it does not animate). */
export function Skeleton({
  width = 96,
  height = 12,
  className,
}: {
  width?: number | string;
  height?: number;
  className?: string;
}) {
  return <span aria-hidden className={cn('vd-skeleton', className)} style={{ width, height }} />;
}

/**
 * A table's rows while they load: the same columns and row height as the loaded table, so the page does
 * not jump. Pass the column headers; filters and paging stay usable around it.
 */
export function TableSkeleton({
  columns,
  rows = 4,
  label = 'Loading',
}: {
  columns: Array<{ header: string; numeric?: boolean; width?: number }>;
  rows?: number;
  label?: string;
}) {
  return (
    <div className="vd-tablewrap" aria-busy="true">
      <table className="vd-table">
        <caption className="vd-sr">{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={cn(column.numeric && 'is-num')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {columns.map((column, index) => (
                <td key={column.header} className={cn(column.numeric && 'is-num')}>
                  <Skeleton
                    width={(column.width ?? 72) - ((row + index) % 3) * 8}
                    className={column.numeric ? 'ml-auto' : undefined}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
