import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { SortableList, moveId } from './sortable-list';
import { TransferLists } from './transfer-lists';

const ITEMS = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

function renderList(onReorder = vi.fn().mockResolvedValue(undefined), items = ITEMS) {
  const view = render(
    <SortableList
      items={items}
      label="Problems"
      itemLabel={(item) => item.name}
      renderItem={(item) => <span>{item.name}</span>}
      onReorder={onReorder}
    />
  );
  return { ...view, onReorder };
}

const namesInOrder = () =>
  within(screen.getByRole('list', { name: 'Problems' }))
    .getAllByRole('listitem')
    .map((row) => row.textContent);

describe('moveId', () => {
  it('moves one id by an offset and leaves the rest in order', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });
  it('does nothing at the ends or for an unknown id', () => {
    expect(moveId(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveId(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
    expect(moveId(['a', 'b'], 'zzz', 1)).toEqual(['a', 'b']);
  });
});

describe('SortableList', () => {
  it('shows the items in order with a drag handle and move buttons for each, named after the item', () => {
    renderList();
    expect(namesInOrder().map((text) => text?.replace(/\d/g, ''))).toEqual(['Alpha', 'Beta', 'Gamma']);
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      expect((screen.getByRole('button', { name: `Drag to reorder ${name}` }) as HTMLButtonElement).disabled).toBe(
        false
      );
      expect(screen.getByRole('button', { name: `Move ${name} up` })).toBeTruthy();
    }
  });

  it('cannot move the first item up or the last item down', () => {
    renderList();
    expect((screen.getByRole('button', { name: 'Move Alpha up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move Gamma down' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move Beta up' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sends the whole new order in one call and shows it at once', async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList();
    await user.click(screen.getByRole('button', { name: 'Move Gamma up' }));
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
    await waitFor(() =>
      expect(namesInOrder().map((text) => text?.replace(/\d/g, ''))).toEqual(['Alpha', 'Gamma', 'Beta'])
    );
  });

  it('shows that it is saving and locks the controls until the save ends', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    renderList(vi.fn().mockReturnValue(pending));
    await user.click(screen.getByRole('button', { name: 'Move Beta down' }));
    expect(screen.getByText('Saving the new order…')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Problems' }).getAttribute('aria-busy')).toBe('true');
    expect((screen.getByRole('button', { name: 'Move Alpha down' }) as HTMLButtonElement).disabled).toBe(true);
    finish();
    await waitFor(() => expect(screen.queryByText('Saving the new order…')).toBeNull());
    expect((screen.getByRole('button', { name: 'Move Alpha down' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('puts the old order back and says why when saving fails', async () => {
    const user = userEvent.setup();
    const { onReorder } = renderList(vi.fn().mockRejectedValue(new Error('Send every problem exactly once.')));
    await user.click(screen.getByRole('button', { name: 'Move Beta up' }));
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Send every problem exactly once. The order was put back.'
    );
    expect(namesInOrder().map((text) => text?.replace(/\d/g, ''))).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('follows the server when the items change', () => {
    const { rerender, onReorder } = renderList();
    rerender(
      <SortableList
        items={[ITEMS[2]!, ITEMS[0]!]}
        label="Problems"
        itemLabel={(item) => item.name}
        renderItem={(item) => <span>{item.name}</span>}
        onReorder={onReorder}
      />
    );
    expect(namesInOrder().map((text) => text?.replace(/\d/g, ''))).toEqual(['Gamma', 'Alpha']);
  });

  it('is locked when disabled', () => {
    render(
      <SortableList
        items={ITEMS}
        label="Problems"
        itemLabel={(item) => item.name}
        renderItem={(item) => <span>{item.name}</span>}
        onReorder={vi.fn()}
        disabled
      />
    );
    expect((screen.getByRole('button', { name: 'Move Beta up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Drag to reorder Beta' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('TransferLists', () => {
  const AVAILABLE = [
    { id: 'x', name: 'Xray' },
    { id: 'y', name: 'Yankee' },
    { id: 'z', name: 'Zulu' },
  ];
  type Handler = (ids: string[]) => Promise<unknown>;
  function renderTransfer(handlers: Partial<Record<'onAdd' | 'onRemove' | 'onReorder', Mock<Handler>>> = {}) {
    const props = {
      onAdd: vi.fn<Handler>().mockResolvedValue(undefined),
      onRemove: vi.fn<Handler>().mockResolvedValue(undefined),
      onReorder: vi.fn<Handler>().mockResolvedValue(undefined),
      ...handlers,
    };
    render(
      <TransferLists
        available={AVAILABLE}
        selected={ITEMS}
        availableLabel="Not in this Collection"
        selectedLabel="In this Collection"
        renderItem={(item) => <span>{item.name}</span>}
        itemLabel={(item) => item.name}
        searchText={(item) => item.name}
        {...props}
      />
    );
    return props;
  }

  it('adds several items in one request', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderTransfer();
    await user.click(screen.getByRole('checkbox', { name: 'Select Zulu' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Xray' }));
    await user.click(screen.getByRole('button', { name: /Add 2 selected/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(['x', 'z']);
  });

  it('removes several items in one request', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderTransfer();
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Gamma' }));
    await user.click(screen.getByRole('button', { name: /Remove 2 selected/ }));
    expect(onRemove).toHaveBeenCalledWith(['a', 'c']);
  });

  it('keeps the buttons off until something is ticked', () => {
    renderTransfer();
    expect((screen.getByRole('button', { name: 'Add selected' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Remove selected' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('filters the list on the left', async () => {
    const user = userEvent.setup();
    renderTransfer();
    await user.type(screen.getByRole('searchbox', { name: /Filter/ }), 'yan');
    expect(screen.getByRole('checkbox', { name: 'Select Yankee' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Select Xray' })).toBeNull();
    await user.clear(screen.getByRole('searchbox', { name: /Filter/ }));
    await user.type(screen.getByRole('searchbox', { name: /Filter/ }), 'nothing');
    expect(screen.getByText('Nothing matches.')).toBeTruthy();
  });

  it('reorders the right list with the move buttons', async () => {
    const user = userEvent.setup();
    const { onReorder } = renderTransfer();
    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }));
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('keeps the ticks and says why when adding fails', async () => {
    const user = userEvent.setup();
    renderTransfer({
      onAdd: vi.fn<Handler>().mockRejectedValue(new Error('A Collection can hold at most 200 problems.')),
    });
    await user.click(screen.getByRole('checkbox', { name: 'Select Xray' }));
    await user.click(screen.getByRole('button', { name: /Add 1 selected/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('A Collection can hold at most 200 problems.');
    expect((screen.getByRole('checkbox', { name: 'Select Xray' }) as HTMLInputElement).checked).toBe(true);
  });
});
