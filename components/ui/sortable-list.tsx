'use client';

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, ArrowUpToLine, ArrowDownToLine, Ellipsis, MoveRight } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { DragHandle } from '@/components/ui/drag-handle';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';

/*
 * Reorderable lists on dnd-kit (@dnd-kit/core + @dnd-kit/sortable 6.x/10.x, the stable packages; the
 * rewrite @dnd-kit/react is still 0.x). Dragging is never the only way: every item also gets a ⋯ menu
 * (Move up, Move down, to top, to bottom, and to the other list), the handle works with the keyboard
 * (Space to pick up, arrows, Space to drop, Escape to cancel) and moves are announced to screen readers.
 * The new order of the whole list goes out in one call; it is shown at once and rolled back if the call fails.
 */

export interface SortableGroup<T> {
  id: string;
  /** Names the list for screen readers and the "Move to …" menu entry. */
  label: string;
  items: T[];
}

export interface SortableItemContext {
  listId: string;
  /** 0-based. */
  index: number;
  count: number;
  /** The grip to drag by, or null in a read-only list. Put it in the first cell of the row. */
  handle: React.ReactNode;
  /** The ⋯ button with the keyboard-friendly alternative, or null in a read-only list. */
  moveMenu: React.ReactNode;
  moveUp: () => void;
  moveDown: () => void;
  dragging: boolean;
}

type Order = Record<string, string[]>;

/** Take `id` out of wherever it is and put it in `toList` at `toIndex`. */
export function moveItem(order: Order, id: string, toList: string, toIndex: number): Order {
  const next: Order = {};
  for (const [list, ids] of Object.entries(order)) next[list] = ids.filter((existing) => existing !== id);
  const target = next[toList] ?? [];
  const at = Math.max(0, Math.min(toIndex, target.length));
  next[toList] = [...target.slice(0, at), id, ...target.slice(at)];
  return next;
}

function locate(order: Order, id: string): { list: string; index: number } | null {
  for (const [list, ids] of Object.entries(order)) {
    const index = ids.indexOf(id);
    if (index >= 0) return { list, index };
  }
  return null;
}

const INSTRUCTIONS =
  'To pick up an item, press Space or Enter on its handle. Use the arrow keys to move it, Space or Enter to drop it, Escape to cancel. The more actions menu moves it without dragging.';

interface SortableListsProps<T> {
  lists: SortableGroup<T>[];
  getId: (item: T) => string;
  /** A short name for an item, for announcements and the handle: "Testcase 3". */
  getLabel: (item: T) => string;
  renderItem: (item: T, context: SortableItemContext) => React.ReactNode;
  /** Called with the new order of every list and what moved. Throw (reject) to roll the change back. */
  onReorder: (order: Order, change: { id: string; from: string; to: string }) => void | Promise<void>;
  /** A view-only person sees the order but gets no handle and no menu. */
  readOnly?: boolean;
  /** Shown inside an empty list. */
  emptyLabel?: string;
  className?: string;
}

/**
 * One or more lists whose items can be reordered, and moved between the lists. For a single list use SortableListOf.
 */
export function SortableLists<T>({
  lists,
  getId,
  getLabel,
  renderItem,
  onReorder,
  readOnly,
  emptyLabel = 'Nothing here',
  className,
}: SortableListsProps<T>) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  // dnd-kit numbers its contexts with a global counter, which differs between server and browser.
  const contextId = React.useId();
  const byId = React.useMemo(() => {
    const map = new Map<string, T>();
    for (const list of lists) for (const item of list.items) map.set(getId(item), item);
    return map;
  }, [lists, getId]);
  const incoming = React.useMemo<Order>(
    () => Object.fromEntries(lists.map((list) => [list.id, list.items.map(getId)])),
    [lists, getId]
  );
  const signature = JSON.stringify(incoming);

  // `order` is what is on screen (it may run ahead of the props while a save is pending).
  const [order, setOrder] = React.useState<Order>(incoming);
  const [seen, setSeen] = React.useState(signature);
  if (signature !== seen) {
    setSeen(signature);
    setOrder(incoming);
  }
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const dragStartOrder = React.useRef<Order>(order);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const nameOf = (id: string) => {
    const item = byId.get(id);
    return item === undefined ? id : getLabel(item);
  };
  const listName = (id: string) => lists.find((list) => list.id === id)?.label ?? id;
  const where = (current: Order, id: string) => {
    const at = locate(current, id);
    if (!at) return '';
    const sameList = lists.length > 1 ? ` in ${listName(at.list)}` : '';
    return `position ${at.index + 1} of ${current[at.list]!.length}${sameList}`;
  };

  async function commit(next: Order, change: { id: string; from: string; to: string }, before: Order) {
    setOrder(next);
    setFailed(false);
    setSaving(true);
    try {
      await onReorder(next, change);
    } catch {
      setOrder(before);
      setFailed(true);
      setMessage(`Could not save the new order. ${nameOf(change.id)} is back where it was.`);
    } finally {
      setSaving(false);
    }
  }

  function moveBy(id: string, to: (current: { list: string; index: number }, count: number) => number) {
    const at = locate(order, id);
    if (!at || saving) return;
    const count = order[at.list]!.length;
    const index = Math.max(0, Math.min(to(at, count), count - 1));
    if (index === at.index) return;
    const next = moveItem(order, id, at.list, index);
    setMessage(`${nameOf(id)} moved to ${where(next, id)}.`);
    void commit(next, { id, from: at.list, to: at.list }, order);
  }

  function moveToList(id: string, listId: string) {
    const at = locate(order, id);
    if (!at || at.list === listId || saving) return;
    const next = moveItem(order, id, listId, order[listId]!.length);
    setMessage(`${nameOf(id)} moved to ${where(next, id)}.`);
    void commit(next, { id, from: at.list, to: listId }, order);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(String(active.id))}, ${where(order, String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(String(active.id))} is over ${where(order, String(active.id))}.` : undefined,
    onDragEnd: ({ active }) => `Dropped ${nameOf(String(active.id))} at ${where(order, String(active.id))}.`,
    onDragCancel: ({ active }) => `Cancelled. ${nameOf(String(active.id))} is back where it was.`,
  };

  const containerOf = (id: string) => (id in order ? id : (locate(order, id)?.list ?? null));

  function onDragStart(event: DragStartEvent) {
    dragStartOrder.current = order;
    setActiveId(String(event.active.id));
  }

  // Dragging over another list moves the item there right away, so the list makes room for it.
  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const id = String(active.id);
    const from = containerOf(id);
    const to = containerOf(String(over.id));
    if (!from || !to || from === to) return;
    setOrder((current) => {
      const overIndex = current[to]!.indexOf(String(over.id));
      return moveItem(current, id, to, overIndex >= 0 ? overIndex : current[to]!.length);
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const id = String(active.id);
    const before = dragStartOrder.current;
    setActiveId(null);
    const to = over ? containerOf(String(over.id)) : null;
    const from = locate(before, id)?.list;
    if (!over || !to || !from) {
      setOrder(before);
      return;
    }
    let next = order;
    const now = locate(order, id);
    const overIndex = order[to]!.indexOf(String(over.id));
    if (now && now.list === to && overIndex >= 0 && overIndex !== now.index) {
      next = { ...order, [to]: arrayMove(order[to]!, now.index, overIndex) };
    }
    if (JSON.stringify(next) === JSON.stringify(before)) {
      setOrder(before);
      return;
    }
    void commit(next, { id, from, to }, before);
  }

  return (
    <div className={cn('vd-sortable', className)} aria-busy={saving || undefined}>
      <DndContext
        id={contextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOrder(dragStartOrder.current);
        }}
      >
        {lists.map((list) => (
          <SortableListBody
            key={list.id}
            list={list}
            ids={order[list.id] ?? []}
            byId={byId}
            lists={lists}
            readOnly={readOnly}
            reduced={reduced}
            activeId={activeId}
            emptyLabel={emptyLabel}
            getLabel={getLabel}
            renderItem={renderItem}
            moveBy={moveBy}
            moveToList={moveToList}
            multiple={lists.length > 1}
          />
        ))}
        <DragOverlay>{null}</DragOverlay>
      </DndContext>
      <p role="status" className="vd-sr">
        {message}
      </p>
      {saving && (
        <p className="vd-sortable__saving" aria-hidden>
          Saving order…
        </p>
      )}
      {failed && (
        <Banner tone="danger" title="Could not save the new order">
          The list is back in its previous order. Try again.
        </Banner>
      )}
    </div>
  );
}

function SortableListBody<T>({
  list,
  ids,
  byId,
  lists,
  readOnly,
  reduced,
  activeId,
  emptyLabel,
  getLabel,
  renderItem,
  moveBy,
  moveToList,
  multiple,
}: {
  list: SortableGroup<T>;
  ids: string[];
  byId: Map<string, T>;
  lists: SortableGroup<T>[];
  readOnly?: boolean;
  reduced: boolean;
  activeId: string | null;
  emptyLabel: string;
  getLabel: (item: T) => string;
  renderItem: SortableListsProps<T>['renderItem'];
  moveBy: (id: string, to: (current: { list: string; index: number }, count: number) => number) => void;
  moveToList: (id: string, listId: string) => void;
  multiple: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: list.id });
  return (
    <SortableContext id={list.id} items={ids} strategy={verticalListSortingStrategy} disabled={readOnly}>
      <ol ref={setNodeRef} className="vd-sortable__list" aria-label={list.label}>
        {ids.map((id, index) => {
          const item = byId.get(id);
          if (item === undefined) return null;
          return (
            <SortableRow
              key={id}
              id={id}
              label={getLabel(item)}
              listId={list.id}
              index={index}
              count={ids.length}
              readOnly={readOnly}
              reduced={reduced}
              dragging={activeId === id}
              otherLists={multiple ? lists.filter((other) => other.id !== list.id) : []}
              moveBy={moveBy}
              moveToList={moveToList}
              render={(context) => renderItem(item, context)}
            />
          );
        })}
        {ids.length === 0 && <li className="vd-sortable__empty">{emptyLabel}</li>}
      </ol>
    </SortableContext>
  );
}

function SortableRow({
  id,
  label,
  listId,
  index,
  count,
  readOnly,
  reduced,
  dragging,
  otherLists,
  moveBy,
  moveToList,
  render,
}: {
  id: string;
  label: string;
  listId: string;
  index: number;
  count: number;
  readOnly?: boolean;
  reduced: boolean;
  dragging: boolean;
  otherLists: Array<{ id: string; label: string }>;
  moveBy: (id: string, to: (current: { list: string; index: number }, count: number) => number) => void;
  moveToList: (id: string, listId: string) => void;
  render: (context: SortableItemContext) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id,
    disabled: readOnly,
    // Reduced motion: items jump to their place instead of sliding.
    transition: reduced ? null : { duration: 180, easing: 'ease-out' },
  });
  const moveUp = () => moveBy(id, (at) => at.index - 1);
  const moveDown = () => moveBy(id, (at) => at.index + 1);
  const handle = readOnly ? null : (
    <DragHandle ref={setActivatorNodeRef} label={label} {...attributes} {...listeners} />
  );
  const moveMenu = readOnly ? null : (
    <Menu
      trigger={
        <button type="button" className="vd-iconbtn" aria-label={`Move ${label}, now ${index + 1} of ${count}`}>
          <Ellipsis className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      }
    >
      <MenuLabel>
        Move {label} · now {index + 1} of {count}
      </MenuLabel>
      <MenuItem icon={ArrowUp} disabled={index === 0} onSelect={moveUp}>
        Move up
      </MenuItem>
      <MenuItem icon={ArrowDown} disabled={index === count - 1} onSelect={moveDown}>
        Move down
      </MenuItem>
      <MenuItem icon={ArrowUpToLine} disabled={index === 0} onSelect={() => moveBy(id, () => 0)}>
        Move to top
      </MenuItem>
      <MenuItem icon={ArrowDownToLine} disabled={index === count - 1} onSelect={() => moveBy(id, (_, n) => n - 1)}>
        Move to bottom
      </MenuItem>
      {otherLists.length > 0 && <MenuSeparator />}
      {otherLists.map((other) => (
        <MenuItem key={other.id} icon={MoveRight} onSelect={() => moveToList(id, other.id)}>
          Move to {other.label}
        </MenuItem>
      ))}
    </Menu>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('vd-sortable__item', dragging && 'is-dragging')}
    >
      {render({ listId, index, count, handle, moveMenu, moveUp, moveDown, dragging })}
    </li>
  );
}

/** A single reorderable list: `onReorder` gets the ids in their new order. */
export function SortableListOf<T>({
  items,
  label,
  onReorder,
  ...rest
}: Omit<SortableListsProps<T>, 'lists' | 'onReorder'> & {
  items: T[];
  label: string;
  onReorder: (ids: string[]) => void | Promise<void>;
}) {
  const lists = React.useMemo(() => [{ id: 'list', label, items }], [label, items]);
  return <SortableLists {...rest} lists={lists} onReorder={(order) => onReorder(order.list ?? [])} />;
}
