import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ANONYMOUS, AUTHENTICATED, USER, renderInApp } from '@/features/test-support';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/account',
}));
const api = vi.hoisted(() => ({ me: vi.fn(), updateProfile: vi.fn() }));
vi.mock('../api/auth.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth.api')>()),
  authApi: api,
}));

import { ProfileForm } from './profile-form';
import { UserMenu } from './user-menu';
import { displayNameError } from '../profile';

beforeEach(() => vi.clearAllMocks());

const nameBox = () => screen.getByLabelText('Display name') as HTMLInputElement;

describe('the account page (GRD-69)', () => {
  it('shows the picture, the name and the account details', () => {
    renderInApp(<ProfileForm />, {
      auth: { status: 'authenticated', user: { ...USER, avatar_url: 'https://example.com/sol.png' } },
    });
    expect(screen.getAllByRole('img', { name: 'Sol' })[0]!.getAttribute('src')).toBe('https://example.com/sol.png');
    expect(screen.getByText('sol@example.com')).toBeTruthy();
    expect(nameBox().value).toBe('Sol');
  });

  it('saves a trimmed name, reloads the account so every place shows it, and says so', async () => {
    api.updateProfile.mockResolvedValue({ ...USER, display_name: 'Sol Invictus' });
    api.me.mockResolvedValue({ ...USER, display_name: 'Sol Invictus' });
    renderInApp(
      <>
        <UserMenu />
        <ProfileForm />
      </>
    );
    await userEvent.clear(nameBox());
    await userEvent.type(nameBox(), '  Sol Invictus  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ display_name: 'Sol Invictus' }));
    expect(await screen.findByText('Name updated')).toBeTruthy();
    // the header shows the new name without signing in again
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Your account, Sol Invictus' }).textContent).toContain('Sol Invictus')
    );
    expect(nameBox().value).toBe('Sol Invictus');
  });

  it('does not call Core when the name did not change', async () => {
    renderInApp(<ProfileForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('explains an empty or too long name without calling Core', async () => {
    renderInApp(<ProfileForm />);
    await userEvent.clear(nameBox());
    expect(screen.getByText('Enter a name.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(nameBox().getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the message Core gives for the name', async () => {
    api.updateProfile.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', 'The request is invalid.', [
        { field: 'display_name', message: 'Remove control characters.' },
      ])
    );
    renderInApp(<ProfileForm />);
    await userEvent.type(nameBox(), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Remove control characters.')).toBeTruthy();
    // typing again clears the old message
    await userEvent.type(nameBox(), 'y');
    expect(screen.queryByText('Remove control characters.')).toBeNull();
  });

  it('says plainly when the name is changed too often (429)', async () => {
    api.updateProfile.mockRejectedValue(
      new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again in 30 seconds.')
    );
    renderInApp(<ProfileForm />);
    await userEvent.type(nameBox(), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(
      await screen.findByText(/changing your name too often. Too many requests. Try again in 30 seconds./)
    ).toBeTruthy();
  });

  it('reports a network failure and keeps what was typed', async () => {
    api.updateProfile.mockRejectedValue(new ApiError(0, 'NETWORK', 'Could not reach the server.'));
    renderInApp(<ProfileForm />);
    await userEvent.type(nameBox(), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Could not reach the server.')).toBeTruthy();
    expect(nameBox().value).toBe('Solx');
  });

  it('waits while the account loads and shows no form to a visitor', () => {
    renderInApp(<ProfileForm />, { auth: ANONYMOUS });
    expect(screen.queryByLabelText('Display name')).toBeNull();
  });
});

describe('the header menu', () => {
  it('shows the picture and display name and links to the account page', () => {
    renderInApp(<UserMenu />, {
      auth: { status: 'authenticated', user: { ...USER, avatar_url: 'https://example.com/sol.png' } },
    });
    const link = screen.getByRole('link', { name: 'Your account, Sol' });
    expect(link.getAttribute('href')).toBe('/account');
    expect(link.querySelector('img')?.getAttribute('src')).toBe('https://example.com/sol.png');
  });

  it('shows the initials when the user has no picture', () => {
    renderInApp(<UserMenu />, { auth: AUTHENTICATED });
    expect(screen.getByRole('link', { name: 'Your account, Sol' }).textContent).toContain('SO');
  });
});

describe('displayNameError', () => {
  it.each([
    ['', 'Enter a name.'],
    ['   ', 'Enter a name.'],
    ['x'.repeat(65), 'Use at most 64 characters.'],
    ['a\nb', 'Remove control characters.'],
    ['x'.repeat(64), undefined],
    ['  Ada  ', undefined],
    ['สมชาย ใจดี', undefined],
  ])('%j -> %j', (value, message) => {
    expect(displayNameError(value)).toBe(message);
  });
});
