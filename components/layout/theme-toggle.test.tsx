import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle, THEME_INIT_SCRIPT } from './theme-toggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeToggle', () => {
  it('cycles system -> light -> dark -> system, setting data-theme and remembering the choice', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = () => screen.getByRole('button', { name: /^Theme:/ });
    expect(button().getAttribute('aria-label')).toBe('Theme: follow system');

    await user.click(button());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('verdale-theme')).toBe('light');

    await user.click(button());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(button().getAttribute('aria-label')).toBe('Theme: dark');

    await user.click(button());
    // Back to the OS preference: no attribute, nothing stored.
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('verdale-theme')).toBeNull();
  });

  it('restores a stored choice on load', async () => {
    localStorage.setItem('verdale-theme', 'dark');
    render(<ThemeToggle />);
    expect((await screen.findByRole('button', { name: 'Theme: dark' })).getAttribute('aria-label')).toBe('Theme: dark');
  });

  it('the pre-paint script applies a stored theme and ignores junk', () => {
    localStorage.setItem('verdale-theme', 'dark');
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('verdale-theme', '"><script>');
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
