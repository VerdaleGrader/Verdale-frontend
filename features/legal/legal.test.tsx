import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthState } from '@/features/auth/hooks/auth-provider';
import { testLocale } from '@/i18n/testing';
import { ApiError } from '@/lib/api';
import { LEGAL_VERSIONS } from '@/lib/legal';
import { USER } from '../test-support';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), path: '/spaces', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const api = vi.hoisted(() => ({ accept: vi.fn() }));
vi.mock('./api/legal.api', () => ({ legalApi: api }));
const authApi = vi.hoisted(() => ({ me: vi.fn(), logout: vi.fn() }));
vi.mock('@/features/auth/api/auth.api', async (original) => ({
  ...(await original<typeof import('@/features/auth/api/auth.api')>()),
  authApi: authApi,
}));

import { AcceptTermsCard } from './components/accept-terms-card';
import { LegalGate } from './components/legal-gate';

const stale = (required: boolean): AuthState => ({
  status: 'authenticated',
  user: {
    ...USER,
    legal: { acceptance_required: required, current_versions: { ...LEGAL_VERSIONS } },
  },
});

beforeEach(() => {
  nav.replace.mockReset();
  nav.push.mockReset();
  nav.path = '/spaces';
  nav.search = '';
  window.history.pushState({}, '', '/');
  api.accept.mockReset();
  authApi.me.mockReset();
  authApi.logout.mockReset();
});

describe('LegalGate', () => {
  it('sends a person who has not accepted to the notice, remembering where they were', () => {
    nav.path = '/spaces/team';
    window.history.pushState({}, '', '/spaces/team?tab=members');
    render(
      <AuthProvider initial={stale(true)}>
        <LegalGate />
      </AuthProvider>
    );
    expect(nav.replace).toHaveBeenCalledWith('/accept-terms?next=%2Fspaces%2Fteam%3Ftab%3Dmembers');
  });

  it.each(['/accept-terms', '/terms', '/privacy'])('lets them read %s', (path) => {
    nav.path = path;
    render(
      <AuthProvider initial={stale(true)}>
        <LegalGate />
      </AuthProvider>
    );
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('leaves everyone else alone', () => {
    for (const auth of [stale(false), { status: 'anonymous', user: null } as AuthState]) {
      render(
        <AuthProvider initial={auth}>
          <LegalGate />
        </AuthProvider>
      );
    }
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe('AcceptTermsCard', () => {
  const renderCard = (auth: AuthState) =>
    render(
      <AuthProvider initial={auth}>
        <AcceptTermsCard />
      </AuthProvider>
    );

  it.each([
    [
      'en',
      'Terms and Privacy Policy updated',
      'Terms and Conditions of Use',
      'Privacy Policy',
      'Effective as of 13 October 2026',
    ],
    [
      'th',
      'ข้อกำหนดและนโยบายความเป็นส่วนตัวมีการปรับปรุง',
      'ข้อกำหนดและเงื่อนไขการใช้บริการ',
      'นโยบายความเป็นส่วนตัว',
      'มีผลใช้บังคับตั้งแต่วันที่ 13 ตุลาคม 2569',
    ],
  ] as const)(
    'shows both documents with their dates in %s, opening in a new tab',
    (locale, title, termsName, privacyName, date) => {
      testLocale.current = locale;
      renderCard(stale(true));
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      const terms = screen.getByRole('link', { name: termsName });
      const privacy = screen.getByRole('link', { name: privacyName });
      expect(terms.getAttribute('href')).toBe('/terms');
      expect(privacy.getAttribute('href')).toBe('/privacy');
      expect(terms.getAttribute('target')).toBe('_blank');
      expect(privacy.getAttribute('target')).toBe('_blank');
      expect(screen.getAllByText(date)).toHaveLength(2);
    }
  );

  it('accepting records the versions shown, reloads the account and goes where the person was going', async () => {
    nav.search = '?next=%2Fspaces%2Fteam';
    api.accept.mockResolvedValue(undefined);
    authApi.me.mockResolvedValue({ ...USER, legal: { acceptance_required: false, current_versions: LEGAL_VERSIONS } });
    renderCard(stale(true));
    await userEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/spaces/team'));
    expect(api.accept).toHaveBeenCalledTimes(1);
    expect(authApi.me).toHaveBeenCalled();
  });

  it('never follows a next address that leaves the site or loops back', async () => {
    nav.search = '?next=%2F%2Fevil.example';
    api.accept.mockResolvedValue(undefined);
    authApi.me.mockResolvedValue({ ...USER, legal: { acceptance_required: false, current_versions: LEGAL_VERSIONS } });
    renderCard(stale(true));
    await userEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
  });

  it('shows what Core said when the documents changed under the page, and stays', async () => {
    api.accept.mockRejectedValue(
      new ApiError(409, 'LEGAL_VERSION_CHANGED', 'Reload the page and read the new version.')
    );
    renderCard(stale(true));
    await userEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Reload the page and read the new version.');
    expect(nav.replace).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Accept and continue' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('logging out is the other way out', async () => {
    authApi.logout.mockResolvedValue(undefined);
    renderCard(stale(true));
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/'));
    expect(authApi.logout).toHaveBeenCalled();
    expect(api.accept).not.toHaveBeenCalled();
  });

  it('has no close button or skip link: only accept or log out', () => {
    renderCard(stale(true));
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Accept and continue', 'Log out']);
  });

  it('a person with nothing to accept is passed on; a visitor goes to log in', async () => {
    renderCard(stale(false));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
    nav.replace.mockReset();
    renderCard({ status: 'anonymous', user: null });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
    await act(async () => undefined);
  });
});
