import { coreApi } from '@/lib/api-client';
import { unwrap } from '@/lib/api';
import type { components } from '@/lib/contracts/core-public.gen';

export type Me = components['schemas']['Me'];
export type OAuthProvider = components['schemas']['OAuthProvider'];

/** Repository: pure calls to Core, no state. */
export const authApi = {
  me: () => unwrap(coreApi.GET('/api/v1/me')),
  providers: async () => (await unwrap(coreApi.GET('/api/v1/auth/providers'))).providers,
  logout: () => unwrap(coreApi.POST('/api/v1/auth/logout')),
  updateProfile: (body: components['schemas']['UpdateMeRequest']) => unwrap(coreApi.PATCH('/api/v1/me', { body })),
};

/** Sign-in is a browser navigation (Core redirects to the provider), not a fetch. */
export function signInUrl(provider: OAuthProvider, next?: string): string {
  const query = next ? `?redirect=${encodeURIComponent(next)}` : '';
  return `/api/v1/auth/oauth/${provider}/start${query}`;
}

/** Only same-site relative paths are followed after login (Core checks too). */
export function safeNext(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;
  return value;
}
