import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testLocale } from '@/i18n/testing';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { LanguageSwitcher } from './language-switcher';

beforeEach(() => {
  refresh.mockClear();
  document.cookie = 'vd_locale=; path=/; max-age=0';
});

describe('LanguageSwitcher', () => {
  it('offers Thai while reading English, and remembers the choice in a cookie', async () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole('button', { name: 'Switch language to ไทย' });
    expect(button.textContent).toBe('ไทย');
    await userEvent.setup().click(button);
    expect(document.cookie).toContain('vd_locale=th');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('offers English while reading Thai', async () => {
    testLocale.current = 'th';
    render(<LanguageSwitcher />);
    const button = screen.getByRole('button', { name: 'เปลี่ยนภาษาเป็นEnglish' });
    await userEvent.setup().click(button);
    expect(document.cookie).toContain('vd_locale=en');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
