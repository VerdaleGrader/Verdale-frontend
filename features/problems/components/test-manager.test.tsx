import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { makeEditor, renderInApp } from '@/features/test-support';
import type { TestCaseList } from '../types';
import { WorkspaceContext } from './problem-workspace';

const api = vi.hoisted(() => ({
  tests: vi.fn(),
  addTest: vi.fn(),
  replaceTest: vi.fn(),
  setTestSample: vi.fn(),
  removeTest: vi.fn(),
  reorderTests: vi.fn(),
}));
vi.mock('../api/problems.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/problems.api')>()),
  problemsApi: api,
}));

import { TestManager, uploadFailureMessage } from './test-manager';

const LIMITS = {
  max_count: 100,
  max_total_bytes: 134217728,
  max_file_bytes: 8388608,
  max_sample_bytes: 65536,
  max_samples: 10,
};
const test = (position: number, overrides = {}) => ({
  id: `t${position}`,
  position,
  is_sample: false,
  input_sha256: 'a'.repeat(64),
  output_sha256: 'b'.repeat(64),
  input_size_bytes: 1500,
  output_size_bytes: 12,
  created_at: '2026-10-11T00:00:00Z',
  ...overrides,
});
const listOf = (items: ReturnType<typeof test>[], overrides: Partial<TestCaseList> = {}): TestCaseList => ({
  items,
  summary: {
    count: items.length,
    sample_count: items.filter((item) => item.is_sample).length,
    total_bytes: items.length * 1512,
  },
  limits: LIMITS,
  editable: true,
  ...overrides,
});

const refresh = vi.fn().mockResolvedValue(undefined);
function renderManager(list: TestCaseList) {
  api.tests.mockResolvedValue(list);
  const editor = makeEditor({ editable: list.editable });
  return renderInApp(
    <WorkspaceContext.Provider
      value={{ target: { slug: 'team', problemSlug: 'sum' }, editor, setEditor: vi.fn(), refresh }}
    >
      <TestManager />
    </WorkspaceContext.Provider>
  );
}
/** jsdom's Blob has no text(). */
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
const file = (name: string, content = '1\n') => new File([content], name, { type: 'text/plain' });

beforeEach(() => {
  vi.clearAllMocks();
  api.addTest.mockResolvedValue(test(1));
});

describe('the test list', () => {
  it('shows the totals against the limits', async () => {
    renderManager(listOf([test(1, { is_sample: true }), test(2)]));
    const tests = await screen.findByRole('progressbar', { name: 'Tests' });
    expect(tests.getAttribute('aria-valuetext')).toBe('2 of 100');
    expect(screen.getByRole('progressbar', { name: 'Total size' }).getAttribute('aria-valuetext')).toBe(
      '3 KiB of 128 MiB'
    );
    expect(screen.getByRole('progressbar', { name: 'Samples shown to solvers' }).getAttribute('aria-valuetext')).toBe(
      '1 of 10'
    );
  });

  it('lists each test in order with its sample flag, sizes and download links', async () => {
    renderManager(listOf([test(1, { is_sample: true }), test(2)]));
    const table = await screen.findByRole('table', { name: 'Tests of this problem' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByRole('checkbox', { name: 'Test 1 is a sample' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(within(rows[1]!).getByRole('checkbox', { name: 'Test 2 is a sample' }).getAttribute('aria-checked')).toBe(
      'false'
    );
    expect(within(rows[0]!).getByText('Sample')).toBeTruthy();
    expect(within(rows[1]!).getByText('Hidden')).toBeTruthy();
    expect(within(rows[0]!).getByText('1.5 KiB')).toBeTruthy();
    expect(within(rows[0]!).getByText('12 bytes')).toBeTruthy();
    const download = within(rows[0]!).getAllByRole('link');
    expect(download[0]!.getAttribute('href')).toBe('/api/v1/spaces/team/problems/sum/tests/t1/input');
    expect(download[1]!.getAttribute('href')).toBe('/api/v1/spaces/team/problems/sum/tests/t1/output');
  });

  it('warns as a limit comes close', async () => {
    renderManager({ ...listOf([test(1)]), summary: { count: 95, sample_count: 1, total_bytes: 100 } });
    const bar = await screen.findByRole('progressbar', { name: 'Tests' });
    expect(bar.firstElementChild!.className).toContain('bg-warning');
    expect(screen.getByRole('progressbar', { name: 'Total size' }).firstElementChild!.className).toContain(
      'bg-primary'
    );
  });

  it('says what to do when there are none', async () => {
    renderManager(listOf([]));
    expect(await screen.findByText('No tests yet')).toBeTruthy();
    expect(screen.getByText(/Add at least one sample test/)).toBeTruthy();
  });

  it('is read-only once the version is published: nothing to add, change or delete, but files can still be downloaded', async () => {
    renderManager(listOf([test(1, { is_sample: true })], { editable: false }));
    await screen.findByRole('table', { name: 'Tests of this problem' });
    expect(screen.queryByRole('heading', { name: 'Add tests' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete test/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move test/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Test 1 is a sample' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('link').length).toBe(2);
  });
});

describe('changing tests', () => {
  it('toggles a sample', async () => {
    api.setTestSample.mockResolvedValue(test(2, { is_sample: true }));
    renderManager(listOf([test(1), test(2)]));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Test 2 is a sample' }));
    await waitFor(() =>
      expect(api.setTestSample).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, 't2', true)
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('shows why a sample could not be set (too large, too many)', async () => {
    api.setTestSample.mockRejectedValue(
      new ApiError(409, 'SAMPLE_TOO_LARGE', 'The input file is 70 KiB, too large for a sample (at most 64 KiB).')
    );
    renderManager(listOf([test(1)]));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Test 1 is a sample' }));
    expect(await screen.findByText(/too large for a sample/)).toBeTruthy();
  });

  it('moves a test up or down by sending the whole new order', async () => {
    api.reorderTests.mockResolvedValue(listOf([]));
    renderManager(listOf([test(1), test(2), test(3)]));
    await userEvent.click(await screen.findByRole('button', { name: 'Move test 3 up' }));
    await waitFor(() =>
      expect(api.reorderTests).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, ['t1', 't3', 't2'])
    );
    await userEvent.click(screen.getByRole('button', { name: 'Move test 1 down' }));
    await waitFor(() => expect(api.reorderTests).toHaveBeenLastCalledWith(expect.anything(), ['t2', 't1', 't3']));
  });

  it('cannot move the first test up or the last one down', async () => {
    renderManager(listOf([test(1), test(2)]));
    expect(((await screen.findByRole('button', { name: 'Move test 1 up' })) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move test 2 down' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('deletes a test only after confirming', async () => {
    api.removeTest.mockResolvedValue(undefined);
    renderManager(listOf([test(1), test(2)]));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete test 2' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete test 2?')).toBeTruthy();
    expect(api.removeTest).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete test' }));
    await waitFor(() => expect(api.removeTest).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, 't2'));
  });

  it('replaces the files of a test', async () => {
    api.replaceTest.mockResolvedValue(test(1));
    renderManager(listOf([test(1)]));
    await userEvent.click(await screen.findByRole('button', { name: 'Replace files of test 1' }));
    const dialog = await screen.findByRole('dialog');
    const replace = within(dialog).getByRole('button', { name: 'Replace' }) as HTMLButtonElement;
    expect(replace.disabled).toBe(true);
    const output = file('fixed.out', '9\n');
    await userEvent.upload(within(dialog).getByLabelText('New output file'), output);
    await userEvent.click(replace);
    await waitFor(() =>
      expect(api.replaceTest).toHaveBeenCalledWith({ slug: 'team', problemSlug: 'sum' }, 't1', {
        input: undefined,
        output,
      })
    );
  });

  it('shows the file error inside the replace dialog', async () => {
    api.replaceTest.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        {
          field: 'output',
          message:
            '“x.bin” (output) contains a NUL byte at offset 3, so it looks like a binary file; only UTF-8 text is accepted.',
        },
      ])
    );
    renderManager(listOf([test(1)]));
    await userEvent.click(await screen.findByRole('button', { name: 'Replace files of test 1' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('New output file'), file('x.bin'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
    expect(await within(dialog).findByText(/NUL byte at offset 3/)).toBeTruthy();
  });
});

describe('uploading files', () => {
  const chooser = () => document.getElementById('test-files') as HTMLInputElement;

  it('pairs input and output files by name and lists what will be uploaded', async () => {
    renderManager(listOf([test(1, { is_sample: true })]));
    await screen.findByRole('heading', { name: 'Add tests' });
    await userEvent.upload(chooser(), [file('2.in'), file('2.out'), file('10.in'), file('10.out'), file('notes.txt')]);
    const table = await screen.findByRole('table', { name: 'Tests ready to upload' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual(['2', '10']);
    expect(screen.getByRole('alert').textContent).toMatch(
      /notes\.txt.*Cannot tell whether this is an input or an output/
    );
    expect(screen.getByRole('button', { name: 'Upload 2 tests' })).toBeTruthy();
  });

  it('makes the first test a sample by default when there is no sample yet', async () => {
    renderManager(listOf([]));
    await screen.findByRole('heading', { name: 'Add tests' });
    await userEvent.upload(chooser(), [file('1.in'), file('1.out'), file('2.in'), file('2.out')]);
    expect((await screen.findByRole('checkbox', { name: '1 is a sample' })).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: '2 is a sample' }).getAttribute('aria-checked')).toBe('false');
  });

  it('does not, when a sample already exists', async () => {
    renderManager(listOf([test(1, { is_sample: true })]));
    await screen.findByRole('heading', { name: 'Add tests' });
    await userEvent.upload(chooser(), [file('1.in'), file('1.out')]);
    expect((await screen.findByRole('checkbox', { name: '1 is a sample' })).getAttribute('aria-checked')).toBe('false');
  });

  it('uploads the pairs one by one, in order, then reloads and clears the list', async () => {
    renderManager(listOf([test(1, { is_sample: true })]));
    await screen.findByRole('heading', { name: 'Add tests' });
    const files = [file('1.in', 'a'), file('1.out', 'b'), file('2.in', 'c'), file('2.out', 'd')];
    await userEvent.upload(chooser(), files);
    await userEvent.click(await screen.findByRole('button', { name: 'Upload 2 tests' }));
    await waitFor(() => expect(api.addTest).toHaveBeenCalledTimes(2));
    expect(api.addTest.mock.calls[0]![1]).toBe(files[0]);
    expect(api.addTest.mock.calls[0]![2]).toBe(files[1]);
    expect(api.addTest.mock.calls[1]![1]).toBe(files[2]);
    expect(api.addTest.mock.calls[0]![3]).toBe(false);
    await waitFor(() => expect(screen.queryByRole('table', { name: 'Tests ready to upload' })).toBeNull());
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText('Added 2 tests')).toBeTruthy();
  });

  it('keeps the pair that failed, with Core’s message naming the file, and still adds the others', async () => {
    api.addTest
      .mockRejectedValueOnce(
        new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
          {
            field: 'input',
            message:
              '“1.in” (input) contains a NUL byte at offset 4, so it looks like a binary file; only UTF-8 text is accepted.',
          },
        ])
      )
      .mockResolvedValueOnce(test(2));
    renderManager(listOf([]));
    await screen.findByRole('heading', { name: 'Add tests' });
    await userEvent.upload(chooser(), [file('1.in'), file('1.out'), file('2.in'), file('2.out')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Upload 2 tests' }));
    const alert = await screen.findAllByRole('alert');
    expect(alert.some((node) => /“1.in” \(input\) contains a NUL byte/.test(node.textContent ?? ''))).toBe(true);
    const table = screen.getByRole('table', { name: 'Tests ready to upload' });
    expect(within(table).getAllByRole('row')).toHaveLength(2); // header + the failed one
    expect(screen.getByRole('button', { name: 'Upload 1 test' })).toBeTruthy();
  });

  it('stops at a limit instead of failing every remaining file the same way', async () => {
    api.addTest.mockRejectedValue(new ApiError(409, 'TEST_LIMIT_REACHED', 'A problem can have at most 100 tests.'));
    renderManager(listOf([]));
    await screen.findByRole('heading', { name: 'Add tests' });
    await userEvent.upload(chooser(), [
      file('1.in'),
      file('1.out'),
      file('2.in'),
      file('2.out'),
      file('3.in'),
      file('3.out'),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Upload 3 tests' }));
    expect(await screen.findByText('A problem can have at most 100 tests.')).toBeTruthy();
    expect(api.addTest).toHaveBeenCalledTimes(1);
  });

  it('flags a file that is too large before uploading, and a sample that is too large for a sample', async () => {
    renderManager(listOf([]));
    await screen.findByRole('heading', { name: 'Add tests' });
    const big = new File(['x'.repeat(10)], '1.in');
    Object.defineProperty(big, 'size', { value: 70 * 1024 });
    await userEvent.upload(chooser(), [big, file('1.out')]);
    expect(await screen.findByText('Too large for a sample')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: '1 is a sample' }));
    expect(await screen.findByText('Ready')).toBeTruthy();
  });

  it('lets a pair be removed from the list, and the list be cleared', async () => {
    renderManager(listOf([test(1, { is_sample: true })]));
    await screen.findByRole('heading', { name: 'Add tests' });
    await userEvent.upload(chooser(), [file('1.in'), file('1.out'), file('2.in'), file('2.out')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove 1 from the list' }));
    expect(screen.queryByRole('checkbox', { name: '1 is a sample' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Clear list' }));
    expect(screen.queryByRole('table', { name: 'Tests ready to upload' })).toBeNull();
  });
});

describe('pasting text', () => {
  it('adds one test from two text boxes', async () => {
    renderManager(listOf([test(1, { is_sample: true })]));
    await userEvent.click(await screen.findByRole('tab', { name: 'Paste text' }));
    await userEvent.type(screen.getByLabelText('Input'), '4 5');
    await userEvent.type(screen.getByLabelText('Expected output'), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Add test' }));
    await waitFor(() => expect(api.addTest).toHaveBeenCalledTimes(1));
    const [, input, output, sample] = api.addTest.mock.calls[0]!;
    expect(await readBlob(input as Blob)).toBe('4 5');
    expect(await readBlob(output as Blob)).toBe('9');
    expect(sample).toBe(false);
    await waitFor(() => expect((screen.getByLabelText('Input') as HTMLTextAreaElement).value).toBe(''));
  });

  it('shows the problem next to the box it belongs to', async () => {
    api.addTest.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'output', message: 'The output file is larger than 8 MiB.' },
      ])
    );
    renderManager(listOf([test(1, { is_sample: true })]));
    await userEvent.click(await screen.findByRole('tab', { name: 'Paste text' }));
    await userEvent.type(screen.getByLabelText('Input'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Add test' }));
    expect(await screen.findByText('The output file is larger than 8 MiB.')).toBeTruthy();
    expect((screen.getByLabelText('Input') as HTMLTextAreaElement).value).toBe('1');
  });

  it('offers nothing to add while both boxes are empty', async () => {
    renderManager(listOf([test(1)]));
    await userEvent.click(await screen.findByRole('tab', { name: 'Paste text' }));
    expect((screen.getByRole('button', { name: 'Add test' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('uploadFailureMessage', () => {
  it('joins the file messages Core gave', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
      { field: 'input', message: 'A.' },
      { field: 'output', message: 'B.' },
    ]);
    expect(uploadFailureMessage(error)).toBe('A. B.');
  });
  it('falls back to the plain message', () => {
    expect(uploadFailureMessage(new ApiError(409, 'CONFLICT', 'Nope.'))).toBe('Nope.');
    expect(uploadFailureMessage(new Error('boom'))).toBe('boom');
  });
});
