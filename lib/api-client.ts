import createClient from 'openapi-fetch';
import type { paths } from '@/lib/contracts/core-public.gen';

/**
 * Typed client for Core's public API, generated from the pinned contract.
 * Paths are relative: Next.js proxies them to Core (next.config.ts), so the
 * browser never needs Core's address and cookies stay first-party.
 */
export const coreApi = createClient<paths>({ baseUrl: '', credentials: 'include' });

export type { components } from '@/lib/contracts/core-public.gen';
