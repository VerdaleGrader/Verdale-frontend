'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';

/**
 * Reorderable lists (GRD-86): the base of every ordering screen (problems in a
 * Collection, Collections in a Track, Tracks in a Space).
 *
 * Library: @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0, the stable line. The newer
 * @dnd-kit/react is still 0.x (see docs/decisions.md, 2026-10-12).
 *
 * How it works for everyone:
 *  - Mouse and touch: drag the handle. A finger on the handle drags instead of scrolling.
 *  - Keyboard: Tab to the handle, Space picks the row up, arrow keys move it, Space drops it,
 *    Escape cancels. dnd-kit announces each step to screen readers.
 *  - No dragging at all: the "Move up" and "Move down" buttons on every row (WCAG 2.2 SC 2.5.7).
 *
 * The whole new order goes to `onReorder` in one call. The list shows the new order at once,
 * disables itself while saving, and puts the old order back (with the error) if saving fails.
 */

export interface SortableItem {
  id: string;
}

/** The order after moving one item; ids that are not found leave the order untouched. */
export function moveId(ids: readonly string[], id: string, offset: number): string[] {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  return arrayMove([...ids], from, to);
}

/**
 * Keeps the order a person sees: the optimistic order while saving, the rolled-back order
 * when saving fails, and the server's order whenever it changes.
 */
export function useOrderedSave<T extends SortableItem>(
  items: readonly T[],
  save: (orderedIds: string[]) => Promise<unknown>
) {
  const serverIds = items.map((item) => item.id).join('|');
  const [order, setOrder] = useState<string[]>(() => items.map((item) => item.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // Follow the server unless a save is in flight (its answer will bring the new order).
  const [followed, setFollowed] = useState(serverIds);
  if (followed !== serverIds && !saving) {
    setFollowed(serverIds);
    setOrder(items.map((item) => item.id));
  }

  const commit = useCallback(
    async (next: string[]) => {
      if (saving || next.join('|') === order.join('|')) return;
      const previous = order;
      setOrder(next);
      setSaving(true);
      setError(null);
      try {
        await saveRef.current(next);
      } catch (caught) {
        setOrder(previous);
        setError(caught instanceof Error ? caught.message : 'Could not save the new order.');
      } finally {
        setSaving(false);
      }
    },
    [order, saving]
  );

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  // An item the server added meanwhile still shows (at the end) until the next sync.
  for (const item of items) if (!order.includes(item.id)) ordered.push(item);
  return { ordered, saving, error, commit, clearError: () => setError(null) };
}

interface RowControls {
  position: number;
  total: number;
  saving: boolean;
  disabled: boolean;
  label: string;
  onMove: (offset: number) => void;
}

/** One row with its handle and move buttons. Used inside a SortableContext. */
export function SortableRow({
  id,
  controls,
  className,
  children,
}: {
  id: string;
  controls: RowControls;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: controls.disabled || controls.saving,
  });
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const locked = controls.disabled || controls.saving;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: reduceMotion ? undefined : transition }}
      className={cn('vd-sortable__row', isDragging && 'is-dragging', className)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="vd-sortable__handle"
        aria-label={`Drag to reorder ${controls.label}`}
        disabled={locked}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
      <span className="vd-sortable__position" aria-hidden>
        {controls.position}
      </span>
      <div className="vd-sortable__body">{children}</div>
      <span className="vd-sortable__moves">
        <button
          type="button"
          className="vd-iconbtn"
          aria-label={`Move ${controls.label} up`}
          disabled={locked || controls.position <= 1}
          onClick={() => controls.onMove(-1)}
        >
          <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          className="vd-iconbtn"
          aria-label={`Move ${controls.label} down`}
          disabled={locked || controls.position >= controls.total}
          onClick={() => controls.onMove(1)}
        >
          <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </span>
    </li>
  );
}

export function useDragSensors() {
  return useSensors(
    // A small movement starts a drag, so a click on a link inside a row is still a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

export function SaveStatus({ saving, error }: { saving: boolean; error: string | null }) {
  return (
    <>
      <p role="status" aria-live="polite" className="text-small text-text-muted">
        {saving ? 'Saving the new order…' : ''}
      </p>
      {error && (
        <p role="alert" className="vd-hint vd-hint--error">
          {error} The order was put back.
        </p>
      )}
    </>
  );
}

export function dragAnnouncements<T extends SortableItem>(items: readonly T[], labelOf: (item: T) => string) {
  const name = (id: UniqueIdentifier) => {
    const item = items.find((candidate) => candidate.id === String(id));
    return item ? labelOf(item) : String(id);
  };
  const where = (id: UniqueIdentifier | undefined) =>
    id === undefined
      ? 'its place'
      : `position ${items.findIndex((item) => item.id === String(id)) + 1} of ${items.length}`;
  return {
    onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) =>
      `Picked up ${name(active.id)}. Use the arrow keys to move it, Space to drop it.`,
    onDragOver: ({ active, over }: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) =>
      over ? `${name(active.id)} is over ${where(over.id)}.` : `${name(active.id)} is not over a place.`,
    onDragEnd: ({ active, over }: { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null }) =>
      over ? `Dropped ${name(active.id)} at ${where(over.id)}.` : `Dropped ${name(active.id)}.`,
    onDragCancel: ({ active }: { active: { id: UniqueIdentifier } }) => `Moving ${name(active.id)} was cancelled.`,
  };
}

export interface SortableListProps<T extends SortableItem> {
  items: readonly T[];
  /** Names the list for assistive technology. */
  label: string;
  /** What a row shows. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Names one item in button labels and announcements. */
  itemLabel: (item: T) => string;
  /** Called with every id in the new order. Throw (or reject) to put the old order back. */
  onReorder: (orderedIds: string[]) => Promise<unknown>;
  disabled?: boolean;
  /** Extra classes for each row, e.g. to mark drafts. */
  rowClassName?: (item: T) => string | undefined;
}

export function SortableList<T extends SortableItem>({
  items,
  label,
  renderItem,
  itemLabel,
  onReorder,
  disabled = false,
  rowClassName,
}: SortableListProps<T>) {
  const { ordered, saving, error, commit } = useOrderedSave(items, onReorder);
  const sensors = useDragSensors();
  const ids = ordered.map((item) => item.id);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void commit(arrayMove(ids, from, to));
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements: dragAnnouncements(ordered, itemLabel) }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="vd-sortable" aria-label={label} aria-busy={saving || undefined}>
            {ordered.map((item, index) => (
              <SortableRow
                key={item.id}
                id={item.id}
                className={rowClassName?.(item)}
                controls={{
                  position: index + 1,
                  total: ordered.length,
                  saving,
                  disabled,
                  label: itemLabel(item),
                  onMove: (offset) => void commit(moveId(ids, item.id, offset)),
                }}
              >
                {renderItem(item, index)}
              </SortableRow>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <SaveStatus saving={saving} error={error} />
    </div>
  );
}
