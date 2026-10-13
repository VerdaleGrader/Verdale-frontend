import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { safeNext, signInUrl } from './api/auth.api';

describe('sign-in links', () => {
  it('start the provider flow with the page to return to', () => {
    expect(signInUrl('github')).toBe('/api/v1/auth/oauth/github/start');
    expect(signInUrl('google', '/spaces/new')).toBe('/api/v1/auth/oauth/google/start?redirect=%2Fspaces%2Fnew');
  });

  it.each([
    ['/spaces', '/spaces'],
    ['//evil.example', undefined],
    ['https://evil.example', undefined],
    ['/\\evil.example', undefined],
    ['', undefined],
    [null, undefined],
  ])('safeNext(%j) -> %j', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

// The login card reads the URL and Core's provider list.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

describe('LoginCard', () => {
  it('shows a provider button per enabled provider, plain links to Core', async () => {
    vi.resetModules();
    vi.doMock('./api/auth.api', async (original) => ({
      ...(await original<typeof import('./api/auth.api')>()),
      authApi: { providers: async () => ['github', 'google'] },
    }));
    window.history.pushState({}, '', '/login?next=/spaces/new');
    const { LoginCard } = await import('./components/login-card');
    render(<LoginCard />);
    const github = await screen.findByRole('link', { name: 'Continue with GitHub' });
    expect(github.getAttribute('href')).toBe('/api/v1/auth/oauth/github/start?redirect=%2Fspaces%2Fnew');
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeTruthy();
  });

  it('explains a cancelled sign-in and an unsafe next is ignored', async () => {
    vi.resetModules();
    vi.doMock('./api/auth.api', async (original) => ({
      ...(await original<typeof import('./api/auth.api')>()),
      authApi: { providers: async () => ['github'] },
    }));
    window.history.pushState({}, '', '/login?error=access_denied&next=//evil.example');
    const { LoginCard } = await import('./components/login-card');
    render(<LoginCard />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/cancelled/);
    expect((await screen.findByRole('link', { name: 'Continue with GitHub' })).getAttribute('href')).toBe(
      '/api/v1/auth/oauth/github/start'
    );
  });

  it('says so when no sign-in method is configured', async () => {
    vi.resetModules();
    vi.doMock('./api/auth.api', async (original) => ({
      ...(await original<typeof import('./api/auth.api')>()),
      authApi: { providers: async () => [] },
    }));
    window.history.pushState({}, '', '/login');
    const { LoginCard } = await import('./components/login-card');
    render(<LoginCard />);
    expect(await screen.findByText(/No sign-in method is configured/)).toBeTruthy();
  });
  it('says that signing in means accepting the Terms and the Privacy Policy, with links that open in a new tab (GRD-122)', async () => {
    vi.resetModules();
    vi.doMock('./api/auth.api', async (original) => ({
      ...(await original<typeof import('./api/auth.api')>()),
      authApi: { providers: async () => ['github'] },
    }));
    window.history.pushState({}, '', '/login');
    const { LoginCard } = await import('./components/login-card');
    const { container } = render(<LoginCard />);
    await screen.findByRole('link', { name: 'Continue with GitHub' });
    const note = container.querySelector('.vd-consent');
    expect(note?.textContent).toBe('การล็อกอินถือว่าท่านยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว');
    const terms = screen.getByRole('link', { name: 'ข้อกำหนด' });
    const privacy = screen.getByRole('link', { name: 'นโยบายความเป็นส่วนตัว' });
    expect(terms.getAttribute('href')).toBe('/terms');
    expect(privacy.getAttribute('href')).toBe('/privacy');
    for (const link of [terms, privacy]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
