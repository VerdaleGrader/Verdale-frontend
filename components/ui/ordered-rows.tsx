'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';

/**
 * The pieces TransferLists (GRD-83) builds its ordered right-hand list from: a sortable row with
 * handle and move buttons, the optimistic save-and-roll-back state, and drag announcements.
 * Single ordered lists elsewhere use SortableListOf from sortable-list.tsx.
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
      className={cn('vd-ordered__row', isDragging && 'is-dragging', className)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="vd-ordered__handle"
        aria-label={`Drag to reorder ${controls.label}`}
        disabled={locked}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
      <span className="vd-ordered__position" aria-hidden>
        {controls.position}
      </span>
      <div className="vd-ordered__body">{children}</div>
      <span className="vd-ordered__moves">
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
