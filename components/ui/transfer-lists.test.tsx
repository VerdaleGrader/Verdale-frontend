import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { moveId } from './ordered-rows';
import { TransferLists } from './transfer-lists';

const ITEMS = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

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
    expect(screen.getByRole('checkbox', { name: 'Select Xray' }).getAttribute('aria-checked')).toBe('true');
  });
});
