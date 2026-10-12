import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '../hooks/auth-provider';

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => '/settings/profile',
}));
const api = vi.hoisted(() => ({ me: vi.fn(), updateProfile: vi.fn() }));
vi.mock('../api/auth.api', () => ({ authApi: api }));

import { ProfileSettings, validateDisplayName } from './profile-settings';
import { UserMenu } from './user-menu';

const USER = {
  id: 'u1',
  email: 'ada@example.com',
  username: 'ada',
  display_name: 'Ada',
  avatar_url: null as string | null,
  created_at: '2026-10-11T00:00:00Z',
};

function renderPage(user = USER) {
  api.me.mockResolvedValue(user);
  return render(
    <AuthProvider initial={{ status: 'authenticated', user }}>
      <ToastProvider>
        <UserMenu />
        <ProfileSettings />
      </ToastProvider>
    </AuthProvider>
  );
}

const nameField = () => screen.getByLabelText('Display name') as HTMLInputElement;
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

beforeEach(() => vi.clearAllMocks());

describe('validateDisplayName', () => {
  it.each(['Ada', 'ลัฟเลซ', 'Ada 🌿', 'x'.repeat(64)])('accepts %j', (value) => {
    expect(validateDisplayName(value)).toBeUndefined();
  });
  it.each(['', '   ', 'x'.repeat(65), 'two\nlines', 'tab\there', 'nul\u0000'])('refuses %j', (value) => {
    expect(validateDisplayName(value)).toBeTruthy();
  });
});

describe('profile settings (GRD-69)', () => {
  it('shows the picture from the provider and the username, which cannot be edited', () => {
    renderPage({ ...USER, avatar_url: 'https://example.com/ada.png' });
    const pictures = screen.getAllByRole('img', { name: 'Ada' }) as HTMLImageElement[];
    expect(pictures.filter((picture) => picture.tagName === 'IMG').length).toBeGreaterThanOrEqual(2); // header and page
    const username = screen.getByLabelText('Username') as HTMLInputElement;
    expect(username.value).toBe('ada');
    expect(username.readOnly).toBe(true);
    expect(screen.getByText(/comes from the account you signed in with/)).toBeTruthy();
  });

  it('shows initials and says so when the provider has no picture', () => {
    renderPage();
    expect(screen.getByText(/has no picture, so your initials are shown/)).toBeTruthy();
    expect(screen.getAllByText('AD').length).toBeGreaterThan(0);
  });

  it('keeps Save off until the name changed and is valid', async () => {
    renderPage();
    expect(save().disabled).toBe(true);
    await userEvent.clear(nameField());
    expect(await screen.findByText('Enter a name.')).toBeTruthy();
    expect(save().disabled).toBe(true);
    await userEvent.type(nameField(), 'Ada Lovelace');
    expect(save().disabled).toBe(false);
  });

  it('saves the new name, refreshes the account and the header shows it without a new login', async () => {
    api.updateProfile.mockResolvedValue({ ...USER, display_name: 'Ada Lovelace' });
    renderPage();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), '  Ada Lovelace  ');
    api.me.mockResolvedValue({ ...USER, display_name: 'Ada Lovelace' });
    await userEvent.click(save());
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ display_name: 'Ada Lovelace' }));
    // The header reads the name from the same account state.
    expect(await screen.findByRole('link', { name: 'Profile settings for Ada Lovelace' })).toBeTruthy();
    expect(await screen.findByText('Name updated')).toBeTruthy();
  });

  it('shows Core’s message next to the field when it refuses the name', async () => {
    api.updateProfile.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'display_name', message: 'Remove line breaks and other control characters.' },
      ])
    );
    renderPage();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), 'Grace');
    await userEvent.click(save());
    expect(await screen.findByText('Remove line breaks and other control characters.')).toBeTruthy();
  });

  it('says so when the rate limit is reached', async () => {
    api.updateProfile.mockRejectedValue(
      new ApiError(429, 'RATE_LIMITED', 'Too many changes. Try again in 30 seconds.')
    );
    renderPage();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), 'Grace');
    await userEvent.click(save());
    expect(await screen.findByText('Too many changes. Try again in 30 seconds.')).toBeTruthy();
  });

  it('Reset puts the saved name back', async () => {
    renderPage();
    await userEvent.type(nameField(), ' extra');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(nameField().value).toBe('Ada');
  });
});
