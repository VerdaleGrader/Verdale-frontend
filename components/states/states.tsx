import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

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
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
}) {
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
