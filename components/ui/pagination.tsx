import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * "Showing 21–40 of 87", Previous / next and "Page 2 of 5". Tables people compare across are never infinite-scrolled.
 * Hidden when everything fits on one page.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const current = Math.min(page, pages);
  const first = (current - 1) * pageSize + 1;
  const last = Math.min(total, current * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-small text-text-muted" aria-live="polite">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={current <= 1} onClick={() => onPage(current - 1)}>
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <span className="text-small text-text-muted">
          Page {current} of {pages}
        </span>
        <Button size="sm" disabled={current >= pages} onClick={() => onPage(current + 1)}>
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
