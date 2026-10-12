import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SortableListOf, SortableLists, moveItem } from './sortable-list';

interface Item {
  id: string;
  name: string;
}
const ITEMS: Item[] = ['a', 'b', 'c'].map((id) => ({ id, name: `Testcase ${id.toUpperCase()}` }));

function Single({ onReorder, readOnly }: { onReorder: (ids: string[]) => void | Promise<void>; readOnly?: boolean }) {
  const [items, setItems] = useState(ITEMS);
  return (
    <SortableListOf
      label="Testcases"
      items={items}
      readOnly={readOnly}
      getId={(item) => item.id}
      getLabel={(item) => item.name}
      onReorder={async (ids) => {
        await onReorder(ids);
        setItems(ids.map((id) => ITEMS.find((item) => item.id === id)!));
      }}
      renderItem={(item, context) => (
        <div>
          {context.handle}
          <span>{item.name}</span>
          {context.moveMenu}
        </div>
      )}
    />
  );
}

const names = () =>
  within(screen.getByRole('list', { name: 'Testcases' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

describe('moveItem', () => {
  it('moves within a list and between lists', () => {
    expect(moveItem({ x: ['a', 'b', 'c'] }, 'a', 'x', 2)).toEqual({ x: ['b', 'c', 'a'] });
    expect(moveItem({ x: ['a', 'b'], y: ['c'] }, 'a', 'y', 0)).toEqual({ x: ['b'], y: ['a', 'c'] });
    expect(moveItem({ x: ['a'] }, 'a', 'x', 9)).toEqual({ x: ['a'] });
  });
});

describe('SortableList', () => {
  it('moves an item with the menu and sends the whole new order in one call', async () => {
    const onReorder = vi.fn();
    render(<Single onReorder={onReorder} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move Testcase C, now 3 of 3' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move up' }));
    await waitFor(() => expect(onReorder).toHaveBeenCalledTimes(1));
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
    expect(screen.getByText('Testcase C moved to position 2 of 3.')).toBeTruthy();
    expect(names()[1]).toContain('Testcase C');
  });

  it('offers move to top and bottom, and disables what cannot happen', async () => {
    render(<Single onReorder={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Move Testcase A/ }));
    expect(await screen.findByRole('menuitem', { name: 'Move up' })).toHaveProperty('dataset.disabled', '');
    expect(screen.getByRole('menuitem', { name: 'Move to bottom' })).toBeTruthy();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move to bottom' }));
    await waitFor(() => expect(names()[2]).toContain('Testcase A'));
  });

  it('shows the new order at once and puts it back when saving fails', async () => {
    let fail: (reason: Error) => void = () => undefined;
    const onReorder = vi.fn(() => new Promise<void>((_, reject) => (fail = reject)));
    render(<Single onReorder={onReorder} />);
    await userEvent.click(screen.getByRole('button', { name: /Move Testcase A/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move down' }));
    expect(names()[0]).toContain('Testcase B');
    expect(screen.getByText('Saving order…')).toBeTruthy();
    act(() => fail(new Error('offline')));
    expect(await screen.findByText('Could not save the new order')).toBeTruthy();
    expect(names()[0]).toContain('Testcase A');
    expect(screen.getByText(/Testcase A is back where it was/)).toBeTruthy();
  });

  it('has a keyboard-focusable handle with instructions', () => {
    render(<Single onReorder={() => undefined} />);
    const handle = screen.getByRole('button', { name: 'Drag to reorder Testcase B' });
    expect(handle.getAttribute('aria-roledescription')).toBe('sortable');
    expect(handle.hasAttribute('aria-describedby')).toBe(true);
    handle.focus();
    expect(document.activeElement).toBe(handle);
  });

  it('read only: the order is shown, with no handle and no menu', () => {
    render(<Single onReorder={() => undefined} readOnly />);
    expect(names()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Drag to reorder/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move Testcase/ })).toBeNull();
  });
});

describe('SortableLists (two lists)', () => {
  it('moves an item to the other list from the menu', async () => {
    const onReorder = vi.fn();
    render(
      <SortableLists
        lists={[
          { id: 'one', label: 'Track A', items: ITEMS.slice(0, 2) },
          { id: 'two', label: 'Track B', items: ITEMS.slice(2) },
        ]}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        onReorder={onReorder}
        renderItem={(item, context) => (
          <div>
            {item.name}
            {context.moveMenu}
          </div>
        )}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Move Testcase A/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to Track B' }));
    await waitFor(() => expect(onReorder).toHaveBeenCalled());
    expect(onReorder).toHaveBeenCalledWith({ one: ['b'], two: ['c', 'a'] }, { id: 'a', from: 'one', to: 'two' });
    expect(screen.getByText('Testcase A moved to position 2 of 2 in Track B.')).toBeTruthy();
  });

  it('puts a heading above each list and can lay the lists out in columns', () => {
    render(
      <SortableLists
        columns
        lists={[
          { id: 'one', label: 'Track A', items: ITEMS.slice(0, 2) },
          { id: 'two', label: 'Track B', items: ITEMS.slice(2) },
        ]}
        listHeader={(list, count) => <h3>{`${list.label} · ${count}`}</h3>}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        onReorder={() => undefined}
        renderItem={(item) => item.name}
      />
    );
    expect(screen.getByRole('heading', { name: 'Track A · 2' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Track B · 1' })).toBeTruthy();
    expect(document.querySelector('.vd-sortable--columns')).toBeTruthy();
  });

  it('shows an empty list', () => {
    render(
      <SortableLists
        lists={[{ id: 'one', label: 'Track A', items: [] as Item[] }]}
        emptyLabel="Drop a problem here"
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        onReorder={() => undefined}
        renderItem={(item) => item.name}
      />
    );
    expect(screen.getByText('Drop a problem here')).toBeTruthy();
  });
});
