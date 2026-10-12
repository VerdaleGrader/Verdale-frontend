'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowLeft, ArrowRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/field';
import {
  SaveStatus,
  SortableRow,
  dragAnnouncements,
  moveId,
  useOrderedSave,
  type SortableItem,
} from '@/components/ui/ordered-rows';
import { cn } from '@/lib/utils';

const SELECTED_ZONE = 'transfer-selected-zone';
const AVAILABLE_ZONE = 'transfer-available-zone';

export interface TransferListsProps<T extends SortableItem> {
  /** Items that are not in the set yet. */
  available: readonly T[];
  /** Items in the set, in their order. */
  selected: readonly T[];
  availableLabel: string;
  selectedLabel: string;
  renderItem: (item: T) => React.ReactNode;
  itemLabel: (item: T) => string;
  /** Matched against the filter box over the available list. */
  searchText?: (item: T) => string;
  /** Called with every id to add or remove at once; reject to keep things as they were. */
  onAdd: (ids: string[]) => Promise<unknown>;
  onRemove: (ids: string[]) => Promise<unknown>;
  onReorder: (orderedIds: string[]) => Promise<unknown>;
  disabled?: boolean;
  rowClassName?: (item: T) => string | undefined;
}

/**
 * Two lists for building an ordered set (GRD-83): what is not in it yet on the left, what is in it
 * on the right. Add many at once by ticking and pressing the button, or drag across; the right
 * list reorders like SortableList. Everything has a keyboard and a no-drag path.
 */
export function TransferLists<T extends SortableItem>({
  available,
  selected,
  availableLabel,
  selectedLabel,
  renderItem,
  itemLabel,
  searchText,
  onAdd,
  onRemove,
  onReorder,
  disabled = false,
  rowClassName,
}: TransferListsProps<T>) {
  const [filter, setFilter] = useState('');
  const [ticked, setTicked] = useState<{ left: Set<string>; right: Set<string> }>({
    left: new Set(),
    right: new Set(),
  });
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ item: T; from: 'left' | 'right' } | null>(null);
  const [overZone, setOverZone] = useState<'left' | 'right' | null>(null);
  const order = useOrderedSave(selected, onReorder);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const query = filter.trim().toLowerCase();
  const shown = useMemo(
    () =>
      query && searchText ? available.filter((item) => searchText(item).toLowerCase().includes(query)) : available,
    [available, query, searchText]
  );
  // Ticks for items that left the list do not count any more.
  const leftTicked = shown.filter((item) => ticked.left.has(item.id)).map((item) => item.id);
  const rightIds = order.ordered.map((item) => item.id);
  const rightTicked = rightIds.filter((id) => ticked.right.has(id));
  const locked = disabled || busy || order.saving;

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setMoveError(null);
    try {
      await work();
      return true;
    } catch (caught) {
      setMoveError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(ids: string[]) {
    if (ids.length === 0) return;
    if (await run(() => onAdd(ids))) setTicked((current) => ({ ...current, left: new Set() }));
  }
  async function remove(ids: string[]) {
    if (ids.length === 0) return;
    if (await run(() => onRemove(ids))) setTicked((current) => ({ ...current, right: new Set() }));
  }

  const toggle = (side: 'left' | 'right', id: string) =>
    setTicked((current) => {
      const next = new Set(current[side]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...current, [side]: next };
    });

  function onDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    const left = available.find((item) => item.id === id);
    const right = order.ordered.find((item) => item.id === id);
    if (left) setDragging({ item: left, from: 'left' });
    else if (right) setDragging({ item: right, from: 'right' });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const from = dragging?.from;
    setDragging(null);
    setOverZone(null);
    if (!over || !from) return;
    const id = String(active.id);
    const target = String(over.id);
    const overRight = target === SELECTED_ZONE || rightIds.includes(target);
    if (from === 'left' && overRight) {
      void add([id]);
    } else if (from === 'right' && target === AVAILABLE_ZONE) {
      void remove([id]);
    } else if (from === 'right' && overRight && target !== id && target !== SELECTED_ZONE) {
      void order.commit(arrayMove(rightIds, rightIds.indexOf(id), rightIds.indexOf(target)));
    }
  }

  const error = moveError ?? order.error;
  const announcements = dragAnnouncements([...available, ...order.ordered], itemLabel);

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={({ over }) => {
          const target = over ? String(over.id) : null;
          setOverZone(
            target === null
              ? null
              : target === AVAILABLE_ZONE || available.some((item) => item.id === target)
                ? 'left'
                : 'right'
          );
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
          setOverZone(null);
        }}
        accessibility={{ announcements }}
      >
        <div className="vd-transfer">
          <Zone id={AVAILABLE_ZONE} className={cn(overZone === 'left' && dragging?.from === 'right' && 'is-over')}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-h3">{availableLabel}</h3>
              <span className="text-small text-text-muted">{available.length}</span>
            </div>
            {searchText && (
              <TextField
                type="search"
                label={`Filter ${availableLabel.toLowerCase()}`}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            )}
            <div className="vd-transfer__scroll">
              {shown.length === 0 ? (
                <p className="text-small text-text-muted p-2">
                  {available.length === 0 ? 'Nothing left to add.' : 'Nothing matches.'}
                </p>
              ) : (
                <ul className="vd-ordered" aria-label={availableLabel}>
                  {shown.map((item) => (
                    <AvailableRow
                      key={item.id}
                      id={item.id}
                      ticked={ticked.left.has(item.id)}
                      label={itemLabel(item)}
                      disabled={locked}
                      className={rowClassName?.(item)}
                      onToggle={() => toggle('left', item.id)}
                    >
                      {renderItem(item)}
                    </AvailableRow>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Button disabled={locked || leftTicked.length === 0} onClick={() => void add(leftTicked)}>
                Add {leftTicked.length > 0 ? `${leftTicked.length} selected` : 'selected'}
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </Zone>

          <Zone id={SELECTED_ZONE} className={cn(overZone === 'right' && dragging?.from === 'left' && 'is-over')}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-h3">{selectedLabel}</h3>
              <span className="text-small text-text-muted">{order.ordered.length}</span>
            </div>
            <div className="vd-transfer__scroll">
              {order.ordered.length === 0 ? (
                <p className="text-small text-text-muted p-2">
                  Empty. Tick items on the left and add them, or drag them here.
                </p>
              ) : (
                <SortableContext items={rightIds} strategy={verticalListSortingStrategy}>
                  <ol className="vd-ordered" aria-label={selectedLabel} aria-busy={order.saving || undefined}>
                    {order.ordered.map((item, index) => (
                      <SortableRow
                        key={item.id}
                        id={item.id}
                        className={cn(ticked.right.has(item.id) && 'is-selected', rowClassName?.(item))}
                        controls={{
                          position: index + 1,
                          total: order.ordered.length,
                          saving: order.saving || busy,
                          disabled,
                          label: itemLabel(item),
                          onMove: (offset) => void order.commit(moveId(rightIds, item.id, offset)),
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="mt-1"
                            checked={ticked.right.has(item.id)}
                            disabled={locked}
                            aria-label={`Select ${itemLabel(item)}`}
                            onCheckedChange={() => toggle('right', item.id)}
                          />
                          <span className="min-w-0 flex-1">{renderItem(item)}</span>
                        </div>
                      </SortableRow>
                    ))}
                  </ol>
                </SortableContext>
              )}
            </div>
            <div>
              <Button disabled={locked || rightTicked.length === 0} onClick={() => void remove(rightTicked)}>
                <ArrowLeft aria-hidden />
                Remove {rightTicked.length > 0 ? `${rightTicked.length} selected` : 'selected'}
              </Button>
            </div>
          </Zone>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging ? <div className="vd-ordered__row is-dragging">{renderItem(dragging.item)}</div> : null}
        </DragOverlay>
      </DndContext>
      <SaveStatus saving={order.saving || busy} error={error} />
    </div>
  );
}

function Zone({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={cn('vd-transfer__col', className)}>
      {children}
    </section>
  );
}

function AvailableRow({
  id,
  ticked,
  label,
  disabled,
  className,
  onToggle,
  children,
}: {
  id: string;
  ticked: boolean;
  label: string;
  disabled: boolean;
  className?: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      className={cn('vd-ordered__row', ticked && 'is-selected', isDragging && 'opacity-40', className)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="vd-ordered__handle"
        aria-label={`Drag ${label} to add it`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
      <div className="vd-ordered__body flex items-start gap-2">
        <Checkbox
          className="mt-1"
          checked={ticked}
          disabled={disabled}
          aria-label={`Select ${label}`}
          onCheckedChange={onToggle}
        />
        <span className="min-w-0 flex-1">{children}</span>
      </div>
    </li>
  );
}
