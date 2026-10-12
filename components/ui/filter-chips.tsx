'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FilterChip {
  /** Stable key, e.g. "verdict". */
  key: string;
  /** What the chip says: "Verdict: Memory limit exceeded". */
  label: string;
}

/**
 * The filters that are on, each removable on its own, and Clear filters for all of them.
 * Renders nothing when no filter is on. The chips mirror the URL query (see useUrlQuery).
 */
export function FilterChips({
  filters,
  onRemove,
  onClear,
}: {
  filters: FilterChip[];
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  if (filters.length === 0) return null;
  return (
    <div className="vd-chips" role="group" aria-label="Active filters">
      <span className="text-small text-text-muted">Filters</span>
      {filters.map((filter) => (
        <span key={filter.key} className="vd-badge vd-badge--brand vd-chip">
          {filter.label}
          <button
            type="button"
            className="vd-chip__remove"
            aria-label={`Remove filter ${filter.label}`}
            onClick={() => onRemove(filter.key)}
          >
            <X className="size-3" strokeWidth={2} aria-hidden />
          </button>
        </span>
      ))}
      <Button size="sm" variant="ghost" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

export type { FilterChip };
