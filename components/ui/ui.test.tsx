import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Banner } from './banner';
import { Breadcrumb } from './breadcrumb';
import { ChangeBadge } from './change-badge';
import { Checkbox } from './checkbox';
import { ClickableRow, RowText, isRowActivation } from './clickable-row';
import { ConfirmOverwriteDialog } from './confirm-overwrite-dialog';
import { Dropdown } from './dropdown';
import { FilePreview } from './file-preview';
import { FileUploader } from './file-uploader';
import { FilterChips } from './filter-chips';
import { Menu, MenuItem } from './menu';
import { Pagination } from './pagination';
import { RadioGroup } from './radio-group';
import { SortHeader } from './sort-header';
import { StatSummary } from './stat-summary';
import { Toggle } from './toggle';
import { UnsavedBar } from './unsaved-bar';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

describe('Checkbox', () => {
  it('toggles with a click on the label and with Space, and reports the value', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Latest only" onCheckedChange={onChange} />);
    await userEvent.click(screen.getByText('Latest only'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    screen.getByRole('checkbox', { name: 'Latest only' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('has a mixed state, a description and a disabled state', () => {
    render(
      <>
        <Checkbox label="Some" checked="indeterminate" description="2 of 5" />
        <Checkbox label="Off" disabled />
      </>
    );
    expect(screen.getByRole('checkbox', { name: /Some/ }).getAttribute('aria-checked')).toBe('mixed');
    expect(screen.getByText('2 of 5')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Off' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('RadioGroup', () => {
  it('selects one option by click or Space', async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        aria-label="Mode"
        defaultValue="a"
        onValueChange={onChange}
        options={[
          { value: 'a', label: 'Alpha', description: 'First one' },
          { value: 'b', label: 'Beta' },
          { value: 'c', label: 'Gamma', disabled: true },
        ]}
      />
    );
    expect(screen.getByRole('radio', { name: /Alpha/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('First one')).toBeTruthy();
    screen.getByRole('radio', { name: 'Beta' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('b');
    await userEvent.click(screen.getByText('Alpha'));
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(screen.getByRole('radio', { name: 'Gamma' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('Dropdown', () => {
  const options = [
    { value: 'owner', label: 'Owner', description: 'Everything', locked: true },
    { value: 'editor', label: 'Editor', description: 'Writes problems' },
    { value: 'solver', label: 'Solver' },
  ];

  it('shows only the label when closed, descriptions in the list, and picks with the keyboard', async () => {
    const onChange = vi.fn();
    render(<Dropdown label="Role" value="editor" options={options} onValueChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger.textContent).toBe('Editor');
    await userEvent.click(trigger);
    expect(await screen.findByText('Writes problems')).toBeTruthy();
    await userEvent.click(screen.getByRole('option', { name: 'Solver' }));
    expect(onChange).toHaveBeenCalledWith('solver');
  });

  it('keeps a locked option in the list, disabled, so it cannot be chosen', async () => {
    const onChange = vi.fn();
    render(<Dropdown aria-label="Role" value="editor" options={options} onValueChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    const locked = await screen.findByRole('option', { name: /Owner/ });
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(locked);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens from the keyboard and closes with Escape', async () => {
    render(
      <Dropdown
        label="Language"
        defaultValue="c"
        options={[
          { value: 'c', label: 'C' },
          { value: 'py', label: 'Python' },
        ]}
      />
    );
    screen.getByRole('combobox', { name: 'Language' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('listbox')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('describes an error', () => {
    render(<Dropdown label="Role" error="Pick one" options={options} />);
    const trigger = screen.getByRole('combobox', { name: 'Role' });
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Pick one')).toBeTruthy();
  });
});

describe('Toggle', () => {
  it('is a switch that Space and a click flip', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Visible to solvers" onCheckedChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Visible to solvers' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(screen.getByText('Visible to solvers'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    toggle.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('can be named without a visible label, and disabled', () => {
    render(<Toggle aria-label="Visible, testcase 3" disabled />);
    expect(screen.getByRole('switch', { name: 'Visible, testcase 3' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('Breadcrumb', () => {
  it('links every level and marks the last as the current page', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Submissions', href: '/s' }, { label: 'By member', href: '/m' }, { label: 'Ploy' }]}
      />
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/s', '/m']);
    expect(within(nav).getByText('Ploy').getAttribute('aria-current')).toBe('page');
  });
});

describe('Pagination', () => {
  it('says where you are and pages with Previous and Next', async () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pageSize={20} total={87} onPage={onPage} />);
    expect(screen.getByText('Showing 21–40 of 87')).toBeTruthy();
    expect(screen.getByText('Page 2 of 5')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onPage).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
    expect(onPage).toHaveBeenLastCalledWith(1);
  });

  it('disables Previous on the first page, Next on the last, and hides when one page is enough', () => {
    const { rerender } = render(<Pagination page={1} pageSize={20} total={87} onPage={() => undefined} />);
    expect(screen.getByRole('button', { name: /Previous/ }).hasAttribute('disabled')).toBe(true);
    rerender(<Pagination page={5} pageSize={20} total={87} onPage={() => undefined} />);
    expect(screen.getByRole('button', { name: /Next/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Showing 81–87 of 87')).toBeTruthy();
    rerender(<Pagination page={1} pageSize={20} total={12} onPage={() => undefined} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('FilterChips', () => {
  it('removes one filter, or all of them, and renders nothing without filters', async () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    const { container, rerender } = render(
      <FilterChips
        filters={[
          { key: 'verdict', label: 'Verdict: WA' },
          { key: 'q', label: 'Search: “ploy”' },
        ]}
        onRemove={onRemove}
        onClear={onClear}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Verdict: WA' }));
    expect(onRemove).toHaveBeenCalledWith('verdict');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalled();
    rerender(<FilterChips filters={[]} onRemove={onRemove} onClear={onClear} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('SortHeader', () => {
  it('announces the sort direction and sorts on press', async () => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortHeader direction="desc" onSort={onSort}>
              Submitted
            </SortHeader>
            <SortHeader onSort={() => undefined}>Member</SortHeader>
          </tr>
        </thead>
      </table>
    );
    expect(screen.getByRole('columnheader', { name: 'Submitted' }).getAttribute('aria-sort')).toBe('descending');
    expect(screen.getByRole('columnheader', { name: 'Member' }).getAttribute('aria-sort')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Submitted' }));
    expect(onSort).toHaveBeenCalled();
  });
});

describe('Banner', () => {
  it('announces danger at once and carries an action', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Banner tone="danger" title="Timed out" action={<button onClick={onClick}>Try again</button>}>
          Took too long.
        </Banner>
        <Banner tone="info">Note</Banner>
      </>
    );
    expect(screen.getByRole('alert').textContent).toContain('Timed out');
    expect(screen.getByRole('status').textContent).toBe('Note');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('Menu', () => {
  it('opens with the keyboard, runs an item with Enter and returns focus to the trigger', async () => {
    const onSelect = vi.fn();
    render(
      <Menu trigger={<button aria-label="More actions">⋯</button>}>
        <MenuItem onSelect={onSelect}>Move up</MenuItem>
        <MenuItem disabled>Move down</MenuItem>
        <MenuItem danger>Remove</MenuItem>
      </Menu>
    );
    screen.getByRole('button', { name: 'More actions' }).focus();
    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More actions' }));
  });

  it('closes with Escape', async () => {
    render(
      <Menu trigger={<button>Open</button>}>
        <MenuItem>One</MenuItem>
      </Menu>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('menu');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('ChangeBadge and StatSummary', () => {
  it('uses the agreed messages, with Undo on a removed row', async () => {
    const onUndo = vi.fn();
    render(
      <>
        <ChangeBadge kind="moved" from={7} />
        <ChangeBadge kind="now-visible" />
        <ChangeBadge kind="same" />
        <ChangeBadge kind="removed" onUndo={onUndo} />
      </>
    );
    expect(screen.getByText('Moved from 7')).toBeTruthy();
    expect(screen.getByText('Now visible')).toBeTruthy();
    expect(screen.getByText('Same as before')).toBeTruthy();
    expect(screen.getByText('Will be removed')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('lists numbers as a description list', () => {
    render(
      <StatSummary
        stats={[
          { label: 'Tried', value: 4 },
          { label: 'Solved', value: 3, tone: 'brand' },
        ]}
      />
    );
    expect(screen.getByText('Solved').closest('div')!.querySelector('dd')!.textContent).toBe('3');
  });
});

describe('UnsavedBar', () => {
  it('counts changes and offers Save and Discard; says Saving while it saves; hides at zero', async () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const { rerender } = render(<UnsavedBar count={2} onSave={onSave} onDiscard={onDiscard} />);
    expect(screen.getByText('2 unsaved changes')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onSave).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
    rerender(<UnsavedBar count={1} saving onSave={onSave} onDiscard={onDiscard} />);
    expect(screen.getByText('1 unsaved change')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true);
    rerender(<UnsavedBar count={0} onSave={onSave} onDiscard={onDiscard} />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('says why saving failed in place of the count, and keeps Save', () => {
    render(
      <UnsavedBar count={2} error="Could not save your changes." onSave={() => undefined} onDiscard={() => undefined} />
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not save your changes.');
    expect(screen.queryByText('2 unsaved changes')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });
});

describe('FilePreview', () => {
  const text = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join('\n');

  it('shows at most 10 lines and offers View all and Open raw past that', async () => {
    const onViewAll = vi.fn();
    render(<FilePreview name="3.in" text={text} onViewAll={onViewAll} rawHref="/raw/3" />);
    const pre = screen.getByLabelText('Preview of 3.in');
    expect(pre.textContent!.split('\n')).toHaveLength(10);
    expect(screen.getByText('First 10 of 30 lines')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'View all' }));
    expect(onViewAll).toHaveBeenCalled();
    const raw = screen.getByRole('link', { name: /Open raw/ });
    expect(raw.getAttribute('href')).toBe('/raw/3');
    expect(raw.getAttribute('target')).toBe('_blank');
  });

  it('shows a short file whole, without the buttons', () => {
    render(<FilePreview name="1.in" text={'4 9\n2 7\n'} onViewAll={() => undefined} />);
    expect(screen.getByText('2 lines')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View all' })).toBeNull();
  });

  it('says so for an empty file', () => {
    render(<FilePreview name="e.in" text="" />);
    expect(screen.getByText('(empty file)')).toBeTruthy();
  });
});

describe('ConfirmOverwriteDialog', () => {
  const items = [
    { id: 1, label: 'Testcase 1', detail: '1.out · 4 B' },
    { id: 2, label: 'Testcase 2', detail: '2.out · 4 B' },
  ];

  it('lists what will be replaced, lets some be kept, and confirms only the ticked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmOverwriteDialog
        open
        title="Overwrite expected outputs?"
        items={items}
        onConfirm={onConfirm}
        onClose={() => undefined}
      />
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Overwrite 2 files' })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Testcase 2/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Overwrite 1 file' }));
    expect(onConfirm).toHaveBeenCalledWith([1]);
  });

  it('cannot confirm with nothing ticked', async () => {
    render(
      <ConfirmOverwriteDialog
        open
        title="Overwrite?"
        items={items.slice(0, 1)}
        onConfirm={() => undefined}
        onClose={() => undefined}
      />
    );
    await userEvent.click(await screen.findByRole('checkbox', { name: /Testcase 1/ }));
    expect(screen.getByRole('button', { name: 'Overwrite 0 files' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('FileUploader', () => {
  it('hands chosen files to the page and shows each state', async () => {
    const onFiles = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(
      <FileUploader
        multiple
        onFiles={onFiles}
        onRemove={onRemove}
        files={[
          { id: 'a', name: '1.in', size: 18, status: 'done' },
          { id: 'b', name: '2.in', size: 2048, status: 'uploading', progress: 40 },
          { id: 'c', name: '3.in', size: 9_000_000, status: 'rejected', message: 'Too large: at most 8 MiB.' },
        ]}
      />
    );
    expect(screen.getByLabelText('Uploaded')).toBeTruthy();
    expect(screen.getByLabelText('Uploading')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Too large: at most 8 MiB.');
    const file = new File(['x'], 'x.in', { type: 'text/plain' });
    await userEvent.upload(container.querySelector('input[type=file]')!, file);
    expect(onFiles).toHaveBeenCalledWith([file]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove 1.in' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('takes dropped files, and offers Replace for a single file', () => {
    const onFiles = vi.fn();
    const { container } = render(
      <FileUploader onFiles={onFiles} files={[{ id: 'a', name: 'statement.pdf', size: 10, status: 'done' }]} />
    );
    expect(screen.getByRole('button', { name: 'Replace file' })).toBeTruthy();
    const file = new File(['x'], 'new.pdf');
    fireEvent.drop(container.querySelector('.vd-uploader__zone')!, {
      dataTransfer: { files: [file, new File(['y'], 'other.pdf')] },
    });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});

describe('ClickableRow', () => {
  function Table({ disabled }: { disabled?: boolean }) {
    return (
      <table>
        <tbody>
          <ClickableRow href="/open/1" disabled={disabled}>
            <td>
              <a href="/title">Title</a>
            </td>
            <td>
              <RowText>some text</RowText>
            </td>
            <td data-testid="empty" />
            <td>
              <button>Edit</button>
            </td>
          </ClickableRow>
        </tbody>
      </table>
    );
  }

  it('opens on empty space only', () => {
    router.push.mockClear();
    render(<Table />);
    fireEvent.click(screen.getByText('Title'));
    fireEvent.click(screen.getByText('some text'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('empty'));
    expect(router.push).toHaveBeenCalledWith('/open/1');
  });

  it('does not open after the person selected text', () => {
    router.push.mockClear();
    render(<Table />);
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('some text'));
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.click(screen.getByTestId('empty'));
    expect(router.push).not.toHaveBeenCalled();
    window.getSelection()!.removeAllRanges();
  });

  it('opens in a new tab with Ctrl, and ignores other mouse buttons', () => {
    router.push.mockClear();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<Table />);
    fireEvent.click(screen.getByTestId('empty'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('/open/1', '_blank', 'noopener');
    fireEvent.click(screen.getByTestId('empty'), { button: 1 });
    expect(router.push).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('is an ordinary row when disabled: no pointer cursor class, no navigation', () => {
    router.push.mockClear();
    render(<Table disabled />);
    expect(screen.getAllByRole('row')[0]!.className).not.toContain('vd-row-click');
    fireEvent.click(screen.getByTestId('empty'));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('ignores clicks that come from outside the row', () => {
    const row = document.createElement('tr');
    const outside = document.createElement('div');
    expect(isRowActivation({ target: outside, currentTarget: row, button: 0 })).toBe(false);
  });

  it('is not a second tab stop', () => {
    render(<Table />);
    expect(screen.getAllByRole('row')[0]!.getAttribute('tabindex')).toBeNull();
  });
});

function Pending() {
  const [count, setCount] = useState(1);
  return <UnsavedBar count={count} onSave={() => setCount(0)} onDiscard={() => setCount(0)} />;
}

describe('UnsavedBar in a page', () => {
  it('disappears after saving', async () => {
    render(<Pending />);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.queryByRole('region')).toBeNull();
  });
});
