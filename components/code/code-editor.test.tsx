import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodeEditor } from './code-editor';

function setup(props: Partial<React.ComponentProps<typeof CodeEditor>> = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  render(
    <CodeEditor
      value="int x;"
      onChange={onChange}
      onSubmit={onSubmit}
      language="cpp"
      label="C++ source code"
      plain
      {...props}
    />
  );
  return { onChange, onSubmit, box: screen.getByRole('textbox', { name: 'C++ source code' }) as HTMLTextAreaElement };
}

describe('CodeEditor (plain text box)', () => {
  it('shows the code and reports edits', async () => {
    const { box, onChange } = setup();
    expect(box.value).toBe('int x;');
    await userEvent.type(box, '!');
    expect(onChange).toHaveBeenLastCalledWith('int x;!');
  });

  it('submits with Ctrl+Enter and with ⌘+Enter', () => {
    const { box, onSubmit } = setup();
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('a plain Enter only types a new line', () => {
    const { box, onSubmit } = setup();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Tab inserts a tab instead of leaving the box', () => {
    const { box, onChange } = setup({ value: 'ab' });
    box.setSelectionRange(1, 1);
    fireEvent.keyDown(box, { key: 'Tab' });
    expect(onChange).toHaveBeenCalledWith('a\tb');
  });

  it('can be read-only', () => {
    const { box } = setup({ readOnly: true });
    expect(box.readOnly).toBe(true);
  });
});
