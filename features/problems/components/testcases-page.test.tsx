import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeEditor, makeSpace, renderInApp } from '@/features/test-support';
import type { Role } from '@/features/spaces/types';
import type { GenerateJob, GenerateRun, TestCase, TestCaseList } from '../types';
import { WorkspaceContext } from './problem-workspace';

const api = vi.hoisted(() => ({
  tests: vi.fn(),
  saveTests: vi.fn(),
  stageFile: vi.fn(),
  testFileSlice: vi.fn(),
  solutions: vi.fn(),
  startGenerate: vi.fn(),
  generateJob: vi.fn(),
  stopGenerate: vi.fn(),
}));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { TestcasesEditor } from './testcases-page';

const LIMITS = {
  max_count: 100,
  max_total_bytes: 134217728,
  max_file_bytes: 8388608,
  max_sample_bytes: 65536,
  max_samples: 2,
};
const sha = (char: string) => char.repeat(64);
const test = (position: number, overrides: Partial<TestCase> = {}): TestCase => ({
  id: `t${position}`,
  position,
  is_sample: false,
  input_sha256: sha(`i${position}`.slice(-1)),
  output_sha256: sha('b'),
  input_size_bytes: 1500,
  output_size_bytes: 12,
  created_at: '2026-10-12T00:00:00Z',
  ...overrides,
});
const listOf = (items: TestCase[], overrides: Partial<TestCaseList> = {}): TestCaseList => ({
  items,
  summary: {
    count: items.length,
    sample_count: items.filter((item) => item.is_sample).length,
    missing_output_count: items.filter((item) => item.output_sha256 === null).length,
    total_bytes: 0,
  },
  limits: LIMITS,
  editable: true,
  revision: 'r1',
  ...overrides,
});
const four = () => listOf([test(1, { is_sample: true }), test(2), test(3), test(4)]);

const refresh = vi.fn().mockResolvedValue(undefined);
function renderPage(list: TestCaseList, role: Role = 'editor') {
  const editor = makeEditor({ editable: list.editable });
  return renderInApp(
    <WorkspaceContext.Provider
      value={{ target: { slug: 'team', problemSlug: 'sum' }, editor, setEditor: vi.fn(), refresh }}
    >
      <TestcasesEditor initial={list} />
    </WorkspaceContext.Provider>,
    { space: makeSpace(role) }
  );
}
const toggle = (n: number) => screen.getByRole('switch', { name: `Visible to solvers, testcase ${n}` });
const rowOf = (n: number) => toggle(n).closest('.tc-row') as HTMLElement;
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
const moveMenu = (n: number, of: number) =>
  userEvent.click(screen.getByRole('button', { name: `Move Testcase ${n}, now ${n} of ${of}` }));
const apiError = (status: number, code: string, message: string) => new ApiError(status, code, message);

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  api.solutions.mockResolvedValue([
    {
      id: 'sol1',
      language: 'cpp',
      source: 'x',
      source_bytes: 1200,
      is_primary: true,
      created_by: { username: 'e', display_name: 'E', avatar_url: null },
      created_at: '2026-10-10T00:00:00Z',
      updated_at: '2026-10-10T00:00:00Z',
    },
  ]);
  api.testFileSlice.mockImplementation(async (_t: unknown, _id: string, side: string, from: number, max: number) => {
    const total = side === 'input' ? 25 : 1;
    const lines = Array.from(
      { length: Math.max(0, Math.min(max, total - from + 1)) },
      (_, i) => `${side} line ${from + i}`
    );
    return {
      lines,
      from_line: from,
      to_line: from + lines.length - 1,
      total_lines: total,
      size_bytes: 99,
      line_truncated: false,
      position: 1,
      side,
    };
  });
});
afterEach(() => vi.useRealTimers());

describe('the testcase list', () => {
  it('shows the testcases in judging order with sizes, visibility and the limits', () => {
    renderPage(four());
    expect(screen.getByRole('heading', { name: 'Testcases' })).toBeTruthy();
    expect(screen.getByText(/4 testcases, judged from top to bottom · 1 visible to solvers as samples/)).toBeTruthy();
    expect(
      screen.getByText(/Limits: 100 testcases, 128 MiB in total, each file up to 8 MiB; up to 2 visible/)
    ).toBeTruthy();
    expect(toggle(1).getAttribute('aria-checked')).toBe('true');
    expect(toggle(2).getAttribute('aria-checked')).toBe('false');
    expect(within(rowOf(1)).getByText('1.in')).toBeTruthy();
    expect(screen.getByText('All changes saved')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
  });

  it('shows an empty state without testcases', () => {
    renderPage(listOf([]));
    expect(screen.getByText('No testcases yet')).toBeTruthy();
  });

  it('warns about testcases without an expected output and says what to do', async () => {
    renderPage(listOf([test(1), test(2, { output_sha256: null, output_size_bytes: null })]));
    expect(screen.getByText('1 testcase has no expected output')).toBeTruthy();
    expect(within(rowOf(2)).getByText('No output yet')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Generate expected output' }).length).toBe(2);
  });

  it('opens a row to show the first 10 lines and offers View all and Open raw', async () => {
    renderPage(four());
    await userEvent.click(screen.getByRole('button', { name: 'Show files of testcase 1' }));
    await waitFor(() => expect(api.testFileSlice).toHaveBeenCalledWith(expect.anything(), 't1', 'input', 1, 10));
    expect(await screen.findByText('First 10 of 25 lines')).toBeTruthy();
    expect(screen.getByText(/input line 10/)).toBeTruthy();
    expect(screen.queryByText(/input line 11/)).toBeNull();
    expect(screen.getByText('1 line')).toBeTruthy();
    const raw = screen.getByRole('link', { name: /Open raw/ });
    expect(raw.getAttribute('href')).toBe('/api/v1/spaces/team/problems/sum/tests/t1/input');
    await userEvent.click(screen.getByRole('button', { name: 'Hide files of testcase 1' }));
    expect(screen.queryByText('First 10 of 25 lines')).toBeNull();
  });

  it('View all pages through a long file 1,000 lines at a time', async () => {
    api.testFileSlice.mockImplementation(async (_t: unknown, _id: string, _side: string, from: number, max: number) => {
      const total = 2500;
      const lines = Array.from({ length: Math.min(max, total - from + 1) }, (_, i) => `row ${from + i}`);
      return {
        lines,
        from_line: from,
        to_line: from + lines.length - 1,
        total_lines: total,
        size_bytes: 9000,
        line_truncated: false,
        position: 1,
        side: 'input',
      };
    });
    renderPage(four());
    await userEvent.click(screen.getByRole('button', { name: 'Show files of testcase 1' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'View all' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Lines 1–1,000 of 2,500')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Load the next 1,000 lines' }));
    expect(await within(dialog).findByText('Lines 1–2,000 of 2,500')).toBeTruthy();
    expect(api.testFileSlice).toHaveBeenLastCalledWith(expect.anything(), 't1', 'input', 1001, 1000);
    expect(within(dialog).getByRole('link', { name: /Open raw/ })).toBeTruthy();
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('tells the person when a file cannot be loaded and lets them retry', async () => {
    api.testFileSlice.mockRejectedValueOnce(apiError(503, 'STORAGE_UNAVAILABLE', 'Storage is down.'));
    renderPage(four());
    await userEvent.click(screen.getByRole('button', { name: 'Show files of testcase 2' }));
    expect(await screen.findByText(/Could not load 2.in. Storage is down./)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/First 10 of 25 lines/)).toBeTruthy();
  });
});

describe('changes wait for Save', () => {
  it('holds a visibility change until Save and then sends the whole list once', async () => {
    renderPage(four());
    await userEvent.click(toggle(3));
    expect(within(rowOf(3)).getByText('Now visible')).toBeTruthy();
    expect(screen.getByText('1 unsaved change')).toBeTruthy();
    expect(screen.getByText(/4 testcases after you save/)).toBeTruthy();
    expect(api.saveTests).not.toHaveBeenCalled();

    api.saveTests.mockResolvedValue(
      listOf([test(1, { is_sample: true }), test(2), test(3, { is_sample: true }), test(4)], { revision: 'r2' })
    );
    await save();
    await waitFor(() => expect(api.saveTests).toHaveBeenCalledTimes(1));
    expect(api.saveTests).toHaveBeenCalledWith(expect.anything(), {
      revision: 'r1',
      tests: [
        { id: 't1', is_sample: true },
        { id: 't2', is_sample: false },
        { id: 't3', is_sample: true },
        { id: 't4', is_sample: false },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull());
    expect(refresh).toHaveBeenCalled();
    expect(within(rowOf(3)).queryByText('Now visible')).toBeNull();
    expect(toggle(3).getAttribute('aria-checked')).toBe('true');
  });

  it('Discard takes every pending change back', async () => {
    renderPage(four());
    await userEvent.click(toggle(2));
    await moveMenu(4, 4);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to top' }));
    expect(screen.getByText('2 unsaved changes')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
    expect(toggle(2).getAttribute('aria-checked')).toBe('false');
    expect(within(rowOf(4)).queryByText(/Moved from/)).toBeNull();
    expect(api.saveTests).not.toHaveBeenCalled();
  });

  it('reorders with the row menu and says where the testcase came from', async () => {
    renderPage(four());
    await moveMenu(4, 4);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Move to top' }));
    const names = within(screen.getByRole('list', { name: 'Testcases in judging order' }))
      .getAllByRole('switch')
      .map((item) => item.getAttribute('aria-label'));
    expect(names[0]).toBe('Visible to solvers, testcase 1');
    expect(within(rowOf(1)).getByText('Moved from 4')).toBeTruthy();
    api.saveTests.mockResolvedValue(four());
    await save();
    await waitFor(() => expect(api.saveTests).toHaveBeenCalled());
    expect(api.saveTests.mock.calls[0]![1].tests.map((entry: { id: string }) => entry.id)).toEqual([
      't4',
      't1',
      't2',
      't3',
    ]);
  });

  it('removes a testcase only when saved, and Undo brings it back', async () => {
    renderPage(four());
    await moveMenu(2, 4);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(within(rowOf(2)).getByText('Will be removed')).toBeTruthy();
    expect(toggle(2).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/3 testcases after you save/)).toBeTruthy();
    await userEvent.click(within(rowOf(2)).getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();

    await moveMenu(2, 4);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    api.saveTests.mockResolvedValue(listOf([test(1, { is_sample: true }), test(2), test(3)]));
    await save();
    await waitFor(() => expect(api.saveTests).toHaveBeenCalled());
    expect(api.saveTests.mock.calls[0]![1].tests.map((entry: { id: string }) => entry.id)).toEqual(['t1', 't3', 't4']);
  });

  it('says why saving failed and keeps the changes', async () => {
    renderPage(four());
    await userEvent.click(toggle(2));
    api.saveTests.mockRejectedValue(apiError(409, 'SAMPLE_LIMIT_REACHED', 'At most 2 testcases can be samples.'));
    await save();
    expect(await screen.findByText('At most 2 testcases can be samples.')).toBeTruthy();
    expect(toggle(2).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  it('checks the limits before asking Core', async () => {
    renderPage(four());
    await userEvent.click(toggle(2));
    await userEvent.click(toggle(3));
    await save();
    expect(await screen.findByText(/At most 2 testcases can be visible to solvers and 3 are/)).toBeTruthy();
    expect(api.saveTests).not.toHaveBeenCalled();
  });

  it('asks what to do when somebody saved meanwhile, and can keep the changes on top of the new list', async () => {
    renderPage(four());
    await userEvent.click(toggle(3));
    api.saveTests.mockRejectedValue(apiError(409, 'TESTS_CHANGED', 'The testcases changed.'));
    const latest = listOf([test(1, { is_sample: true }), test(2), test(3), test(4), test(5)], { revision: 'r2' });
    api.tests.mockResolvedValue(latest);
    await save();
    expect(await screen.findByText('Someone saved these testcases while you were editing')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Keep my changes on top' }));
    expect(await screen.findByRole('switch', { name: 'Visible to solvers, testcase 5' })).toBeTruthy();
    expect(toggle(3).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText('Someone saved these testcases while you were editing')).toBeNull();
    api.saveTests.mockResolvedValue(latest);
    await save();
    await waitFor(() =>
      expect(api.saveTests).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ revision: 'r2' }))
    );
  });

  it('can load the new list instead and drop the changes', async () => {
    renderPage(four());
    await userEvent.click(toggle(3));
    api.saveTests.mockRejectedValue(apiError(409, 'TESTS_CHANGED', 'The testcases changed.'));
    api.tests.mockResolvedValue(listOf([test(1), test(2)], { revision: 'r2' }));
    await save();
    await userEvent.click(await screen.findByRole('button', { name: 'Load the new list' }));
    expect(screen.queryByRole('switch', { name: 'Visible to solvers, testcase 3' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
  });
});

describe('who can change what', () => {
  it('an observer sees every testcase and file but cannot change anything', async () => {
    renderPage(four(), 'observer');
    expect(screen.getByText('View only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Drag to reorder/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Move Testcase/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Generate expected output' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add testcases/ })).toBeNull();
    expect(toggle(1).hasAttribute('disabled')).toBe(true);
    await userEvent.click(toggle(1));
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show files of testcase 1' }));
    expect(await screen.findByText('First 10 of 25 lines')).toBeTruthy();
  });

  it('a published version is read-only for editors too', () => {
    renderPage(listOf([test(1)], { editable: false }));
    expect(screen.getByText('The testcases are read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add testcases/ })).toBeNull();
    expect(toggle(1).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: /Drag to reorder/ })).toBeNull();
  });

  it('an editor has the handles, menus and buttons', () => {
    renderPage(four());
    expect(screen.getAllByRole('button', { name: /Drag to reorder/ }).length).toBe(4);
    expect(screen.getByRole('button', { name: /Add testcases/ })).toBeTruthy();
  });
});

describe('Paste text', () => {
  const open = async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add testcases/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Paste text' }));
  };

  it('adds a row of input without an expected output and then asks for the output', async () => {
    renderPage(four());
    api.stageFile.mockResolvedValue({ sha256: sha('p'), size_bytes: 7, total_lines: 2 });
    await open();
    const panel = screen.getByRole('form', { name: 'Paste testcases' });
    fireEvent.change(within(panel).getByLabelText('Input of testcase 5'), { target: { value: '1 2\n3' } });
    await userEvent.click(within(panel).getByRole('button', { name: 'Add 1 testcase' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Paste testcases' })).toBeNull());
    expect(api.stageFile).toHaveBeenCalledTimes(1);
    expect(api.stageFile).toHaveBeenCalledWith(expect.anything(), { text: '1 2\n3' });
    expect(within(rowOf(5)).getByText('New')).toBeTruthy();
    expect(within(rowOf(5)).getByText('No output yet')).toBeTruthy();
    expect(screen.getByText('1 testcase has no expected output')).toBeTruthy();
    expect(screen.getByText('1 unsaved change')).toBeTruthy();

    api.saveTests.mockResolvedValue(four());
    await save();
    await waitFor(() => expect(api.saveTests).toHaveBeenCalled());
    expect(api.saveTests.mock.calls[0]![1].tests.at(-1)).toEqual({ is_sample: false, input: { sha256: sha('p') } });
  });

  it('adds several rows with and without output, and visible ones', async () => {
    renderPage(four());
    api.stageFile.mockImplementation(async (_t: unknown, source: { text: string }) => ({
      sha256: sha(source.text.slice(0, 1)),
      size_bytes: source.text.length + 1,
      total_lines: 1,
    }));
    await open();
    const panel = screen.getByRole('form', { name: 'Paste testcases' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Add row' }));
    fireEvent.change(within(panel).getByLabelText('Input of testcase 5'), { target: { value: 'a' } });
    fireEvent.change(within(panel).getByLabelText('Expected output of testcase 5'), { target: { value: 'b' } });
    fireEvent.change(within(panel).getByLabelText('Input of testcase 6'), { target: { value: 'c' } });
    await userEvent.click(within(panel).getByRole('switch', { name: 'Visible to solvers, new testcase 6' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Add 2 testcases' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Paste testcases' })).toBeNull());
    expect(api.stageFile).toHaveBeenCalledTimes(3);
    expect(within(rowOf(5)).queryByText('No output yet')).toBeNull();
    expect(within(rowOf(6)).getByText('No output yet')).toBeTruthy();
    expect(toggle(6).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('2 unsaved changes')).toBeTruthy();
  });

  it('needs an input in every row', async () => {
    renderPage(four());
    await open();
    const panel = screen.getByRole('form', { name: 'Paste testcases' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Add 1 testcase' }));
    expect(within(panel).getByText('Enter the input, or remove this row.')).toBeTruthy();
    expect(api.stageFile).not.toHaveBeenCalled();
  });

  it('shows what Core refuses under the row and keeps the text', async () => {
    renderPage(four());
    api.stageFile.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'Bad', [{ field: 'text', message: 'The text has a NUL character.' }])
    );
    await open();
    const panel = screen.getByRole('form', { name: 'Paste testcases' });
    fireEvent.change(within(panel).getByLabelText('Input of testcase 5'), { target: { value: 'x' } });
    await userEvent.click(within(panel).getByRole('button', { name: 'Add 1 testcase' }));
    expect(await within(panel).findByText('The text has a NUL character.')).toBeTruthy();
    expect((within(panel).getByLabelText('Input of testcase 5') as HTMLTextAreaElement).value).toBe('x');
  });

  it('closes without adding', async () => {
    renderPage(four());
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Close paste testcases' }));
    expect(screen.queryByRole('form', { name: 'Paste testcases' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
  });
});

describe('Upload files', () => {
  const file = (name: string, content = '1\n') => new File([content], name, { type: 'text/plain' });
  const open = async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add testcases/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Upload files' }));
    return screen.getByRole('region', { name: 'Upload testcase files' });
  };
  const choose = (panel: HTMLElement, files: File[]) => {
    const input = panel.querySelector('input[type="file"][multiple]:not([aria-label])') as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
  };

  it('pairs inputs with outputs by name, adds input-only files without an output and offers example files', async () => {
    renderPage(four());
    api.stageFile.mockImplementation(async (_t: unknown, source: File) => ({
      sha256: sha(source.name.slice(0, 1)),
      size_bytes: 2,
      total_lines: 1,
    }));
    const panel = await open();
    const examples = within(panel).getByRole('list', { name: 'Download example files' });
    const hrefs = within(examples)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/examples/testcases/1.in',
      '/examples/testcases/1.out',
      '/examples/testcases/testcases-pairs.zip',
      '/examples/testcases/testcases-in-out-folders.zip',
    ]);
    expect(within(panel).getByText(/How files are matched/)).toBeTruthy();

    choose(panel, [file('5.in'), file('5.out'), file('6.in'), file('notes.txt')]);
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Add 2 testcases' })).toBeTruthy());
    expect(within(within(panel).getByRole('alert')).getByText(/notes.txt/)).toBeTruthy();
    expect(within(panel).getByText(/1 input has no output file/)).toBeTruthy();
    await userEvent.click(within(panel).getByRole('button', { name: 'Add 2 testcases' }));
    expect(screen.queryByRole('region', { name: 'Upload testcase files' })).toBeNull();
    expect(within(rowOf(5)).getByText('New')).toBeTruthy();
    expect(within(rowOf(5)).queryByText('No output yet')).toBeNull();
    expect(within(rowOf(6)).getByText('No output yet')).toBeTruthy();
  });

  it('rejects a file over the limit and shows Core’s reason for a file it refuses', async () => {
    renderPage(listOf([test(1)], { limits: { ...LIMITS, max_file_bytes: 4 } }));
    api.stageFile.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'Bad', [{ field: 'file', message: 'bad.in is not text.' }])
    );
    const panel = await open();
    choose(panel, [file('big.in', '123456789'), file('bad.in', '1')]);
    expect(await within(panel).findByText('Too large: at most 4 bytes.')).toBeTruthy();
    expect(await within(panel).findByText('bad.in is not text.')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Add 0 testcases' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('Replace files', () => {
  it('stages the new files and marks the row; position and visibility stay', async () => {
    renderPage(four());
    api.stageFile.mockResolvedValue({ sha256: sha('n'), size_bytes: 3, total_lines: 1 });
    await moveMenu(2, 4);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Replace files…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace files of testcase 2' });
    expect(within(dialog).getByRole('button', { name: 'Replace files' }).hasAttribute('disabled')).toBe(true);
    const inputs = dialog.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[0]!, { target: { files: [new File(['9\n'], 'new.in')] } });
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Replace files' }).hasAttribute('disabled')).toBe(false)
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace files' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(rowOf(2)).getByText('Input replaced')).toBeTruthy();
    api.saveTests.mockResolvedValue(four());
    await save();
    await waitFor(() => expect(api.saveTests).toHaveBeenCalled());
    expect(api.saveTests.mock.calls[0]![1].tests[1]).toEqual({
      id: 't2',
      is_sample: false,
      input: { sha256: sha('n') },
    });
  });
});

const run = (position: number, overrides: Partial<GenerateRun> = {}): GenerateRun => ({
  test_id: `t${position}`,
  position,
  status: 'done',
  verdict: null,
  error_code: null,
  time_ms: 5,
  memory_kb: 100,
  stderr: null,
  output: { sha256: sha('g'), size_bytes: 6 },
  same_as_current: false,
  ...overrides,
});
const jobOf = (
  status: GenerateJob['status'],
  runs: GenerateRun[],
  overrides: Partial<GenerateJob> = {}
): GenerateJob => ({
  id: 'job1',
  status,
  error: null,
  created_at: '2026-10-12T00:00:00Z',
  deadline_at: '2026-10-12T00:10:00Z',
  finished_at: status === 'running' ? null : '2026-10-12T00:01:00Z',
  progress: {
    total: runs.length,
    done: runs.filter((entry) => entry.status === 'done').length,
    failed: runs.filter((entry) => entry.status === 'failed').length,
  },
  runs,
  ...overrides,
});

describe('Generate expected output', () => {
  const startFlow = async (untick: string[] = []) => {
    await userEvent.click(screen.getAllByRole('button', { name: 'Generate expected output' })[0]!);
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    for (const name of untick) await userEvent.click(await screen.findByRole('checkbox', { name }));
    await userEvent.click(await screen.findByRole('button', { name: /^Overwrite/ }));
  };

  it('chooses a solution and asks which existing outputs to overwrite, then runs and reports the result for review', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage(listOf([test(1), test(2), test(3), test(4, { output_sha256: null, output_size_bytes: null })]));
    await userEvent.click(screen.getAllByRole('button', { name: 'Generate expected output' })[0]!);
    const choose = await screen.findByRole('dialog', { name: 'Generate expected output' });
    expect(within(choose).getByText(/4 in total · 3 already have an expected output · 1 has none/)).toBeTruthy();
    expect(await within(choose).findByRole('combobox', { name: 'Solution' })).toBeTruthy();
    expect(within(choose).getByText(/1 s/)).toBeTruthy();
    await userEvent.click(within(choose).getByRole('button', { name: 'Continue' }));

    const confirm = await screen.findByRole('dialog', { name: 'Overwrite expected outputs?' });
    expect(within(confirm).getByText(/3 testcases already have an expected output/)).toBeTruthy();
    expect(within(confirm).getByText(/1 has none, so it is generated either way/)).toBeTruthy();
    await userEvent.click(within(confirm).getByRole('checkbox', { name: /Testcase 1/ }));
    expect(within(confirm).getByRole('button', { name: 'Overwrite 2 files' })).toBeTruthy();

    api.startGenerate.mockResolvedValue(
      jobOf('running', [
        run(2, { status: 'queued', output: null }),
        run(3, { status: 'queued', output: null }),
        run(4, { status: 'queued', output: null }),
      ])
    );
    await userEvent.click(within(confirm).getByRole('button', { name: 'Overwrite 2 files' }));
    await waitFor(() =>
      expect(api.startGenerate).toHaveBeenCalledWith(expect.anything(), {
        solution_id: 'sol1',
        test_ids: ['t2', 't3', 't4'],
      })
    );

    // Running: the list is locked, Stop is there and progress is labelled.
    const progress = await screen.findByRole('region', { name: 'Generating expected output' });
    expect(within(progress).getByText('Solution 1 (C++) · 3 testcases to run, 1 kept')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Generation progress' })).toBeTruthy();
    expect(within(rowOf(1)).getByText('Kept')).toBeTruthy();
    expect(toggle(2).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Move Testcase 2, now 2 of 4' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Generate expected output' })[0]!.hasAttribute('disabled')).toBe(true);

    api.generateJob.mockResolvedValue(
      jobOf('completed', [
        run(2, { same_as_current: true, output: { sha256: sha('b'), size_bytes: 12 } }),
        run(3, { same_as_current: false }),
        run(4, { same_as_current: null }),
      ])
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(await screen.findByText('Generated 3 of 3 expected outputs with Solution 1 (C++)')).toBeTruthy();
    expect(
      screen.getByText(/1 changed, 1 is the same as before, 1 is new\. Review them below, then save\./)
    ).toBeTruthy();
    expect(within(rowOf(1)).getByText('Kept')).toBeTruthy();
    expect(within(rowOf(2)).getByText('Same as before')).toBeTruthy();
    expect(within(rowOf(3)).getByText('Output changed')).toBeTruthy();
    expect(within(rowOf(4)).getByText('New output')).toBeTruthy();
    // Nothing is saved: the results are unsaved changes, and "Same" and "Kept" do not count.
    expect(screen.getByText('2 unsaved changes')).toBeTruthy();
    expect(api.saveTests).not.toHaveBeenCalled();

    api.saveTests.mockResolvedValue(four());
    await save();
    await waitFor(() => expect(api.saveTests).toHaveBeenCalled());
    const body = api.saveTests.mock.calls[0]![1];
    expect(body.tests[2]).toEqual({ id: 't3', is_sample: false, output: { sha256: sha('g') } });
    expect(body.tests[1]).toEqual({ id: 't2', is_sample: false });
  });

  it('Discard generated outputs puts the saved outputs back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage(listOf([test(1), test(2)]));
    api.startGenerate.mockResolvedValue(
      jobOf('running', [run(1, { status: 'queued', output: null }), run(2, { status: 'queued', output: null })])
    );
    api.generateJob.mockResolvedValue(jobOf('completed', [run(1), run(2)]));
    await startFlow();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(await screen.findByText('2 unsaved changes')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Discard generated outputs' }));
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
    expect(within(rowOf(1)).queryByText('Output changed')).toBeNull();
  });

  it('Stop keeps what finished and says so', async () => {
    renderPage(listOf([test(1), test(2)]));
    api.startGenerate.mockResolvedValue(jobOf('running', [run(1), run(2, { status: 'running', output: null })]));
    api.stopGenerate.mockResolvedValue(jobOf('stopped', [run(1), run(2, { status: 'queued', output: null })]));
    await startFlow();
    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('You stopped generation')).toBeTruthy();
    expect(
      screen.getByText(/1 output was generated and are waiting for review\. The other 1 kept their output\./)
    ).toBeTruthy();
    expect(within(rowOf(1)).getByText('Output changed')).toBeTruthy();
    expect(within(rowOf(2)).queryByText('Output changed')).toBeNull();
    // The list is unlocked again.
    expect(toggle(2).hasAttribute('disabled')).toBe(false);
  });

  it('reports a solution that does not compile and changes nothing', async () => {
    renderPage(listOf([test(1)]));
    api.startGenerate.mockResolvedValue(
      jobOf(
        'failed',
        [run(1, { status: 'failed', output: null, error_code: 'COMPILE_ERROR', same_as_current: null })],
        {
          error: { code: 'COMPILE_ERROR', message: "main.cpp:14:5: error: 'unordered_map' was not declared" },
        }
      )
    );
    await startFlow();
    expect(await screen.findByText("Couldn't generate: Solution 1 (C++) didn't compile")).toBeTruthy();
    expect(screen.getByText(/unordered_map/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Solutions' }).getAttribute('href')).toBe(
      '/spaces/team/problems/sum/edit/solutions'
    );
    expect(screen.getByRole('button', { name: 'Choose another solution' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull();
    expect(screen.queryByText('Internal error')).toBeNull();
  });

  it('shows a testcase the solution failed on in its row, with the verdict and what it printed', async () => {
    renderPage(listOf([test(1), test(2)]));
    api.startGenerate.mockResolvedValue(
      jobOf('completed', [
        run(1),
        run(2, { status: 'failed', verdict: 'TLE', output: null, same_as_current: null, stderr: 'it was slow' }),
      ])
    );
    await startFlow();
    expect(await screen.findByText('Generated 1 of 2 expected outputs with Solution 1 (C++)')).toBeTruthy();
    expect(screen.getByText(/Testcase 2 hit the time limit and kept its output/)).toBeTruthy();
    expect(within(rowOf(2)).getByText('Time limit exceeded · old output kept')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show files of testcase 2' }));
    expect(await screen.findByText('it was slow')).toBeTruthy();
  });

  it('reports a timeout with what was generated and offers to try the rest again', async () => {
    renderPage(listOf([test(1), test(2), test(3)]));
    api.startGenerate.mockResolvedValue(
      jobOf('timed_out', [
        run(1),
        run(2, { status: 'queued', output: null, same_as_current: null }),
        run(3, { status: 'queued', output: null, same_as_current: null }),
      ])
    );
    await startFlow();
    expect(await screen.findByText('Generation timed out after 10 minutes')).toBeTruthy();
    expect(
      screen.getByText(/1 of 3 outputs was generated and are waiting for review\. The other 2 kept their output\./)
    ).toBeTruthy();
    api.startGenerate.mockClear();
    api.startGenerate.mockResolvedValue(
      jobOf('running', [run(2, { status: 'queued', output: null }), run(3, { status: 'queued', output: null })])
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try the 2 again' }));
    await waitFor(() =>
      expect(api.startGenerate).toHaveBeenCalledWith(expect.anything(), { solution_id: 'sol1', test_ids: ['t2', 't3'] })
    );
    expect(await screen.findByRole('region', { name: 'Generating expected output' })).toBeTruthy();
  });

  it('says when the judge does not respond', async () => {
    renderPage(listOf([test(1), test(2)]));
    api.startGenerate.mockResolvedValue(
      jobOf(
        'failed',
        [
          run(1),
          run(2, {
            status: 'failed',
            verdict: 'ISE',
            error_code: 'JUDGE_UNAVAILABLE',
            output: null,
            same_as_current: null,
          }),
        ],
        {
          error: { code: 'JUDGE_UNAVAILABLE', message: 'x' },
        }
      )
    );
    await startFlow();
    expect(await screen.findByText("The judge isn't responding")).toBeTruthy();
    expect(screen.getByText(/This is a problem on our side/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Review the 1 generated' }));
    expect(screen.queryByText("The judge isn't responding")).toBeNull();
    expect(screen.getByText('1 unsaved change')).toBeTruthy();
  });

  it('tells what could not start', async () => {
    renderPage(listOf([test(1)]));
    api.startGenerate.mockRejectedValue(
      apiError(409, 'GENERATE_RUNNING', 'A generation is already running for this problem.')
    );
    await startFlow();
    expect(await screen.findByText('A generation is already running for this problem.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Generating expected output' })).toBeNull();
  });

  it('skips testcases that are not saved yet and says so', async () => {
    renderPage(listOf([test(1, { output_sha256: null, output_size_bytes: null })]));
    api.stageFile.mockResolvedValue({ sha256: sha('p'), size_bytes: 2, total_lines: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Add testcases/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Input of testcase 2'), { target: { value: 'x' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 testcase' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Paste testcases' })).toBeNull());
    await userEvent.click(screen.getAllByRole('button', { name: 'Generate expected output' })[0]!);
    expect(await screen.findByText(/1 testcase has changes that are not saved yet/)).toBeTruthy();
    api.startGenerate.mockResolvedValue(jobOf('running', [run(1, { status: 'queued', output: null })]));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(api.startGenerate).toHaveBeenCalledWith(expect.anything(), { solution_id: 'sol1', test_ids: ['t1'] })
    );
  });

  it('says there is no solution to run when none is saved', async () => {
    api.solutions.mockResolvedValue([]);
    renderPage(four());
    await userEvent.click(screen.getAllByRole('button', { name: 'Generate expected output' })[0]!);
    expect(await screen.findByText(/There is no saved solution yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(true);
  });
});
