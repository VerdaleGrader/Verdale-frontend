import { useSyncExternalStore } from 'react';

/**
 * A tiny in-memory `next/navigation` for component tests that read or write the URL query:
 *   vi.mock('next/navigation', () => import('@/features/test-navigation'));
 * then `resetNavigation('/spaces/team?status=draft')` in beforeEach and inspect `currentUrl()`.
 * Not a test file itself.
 */

const state = {
  entries: ['/'],
  index: 0,
  params: {} as Record<string, string>,
  pushes: 0,
  replaces: 0,
  listeners: new Set<() => void>(),
};

function emit() {
  for (const listener of state.listeners) listener();
}

export function resetNavigation(url = '/', params: Record<string, string> = {}) {
  state.entries = [url];
  state.index = 0;
  state.params = params;
  state.pushes = 0;
  state.replaces = 0;
  emit();
}

export const currentUrl = () => state.entries[state.index]!;
export const navigationCounts = () => ({ pushes: state.pushes, replaces: state.replaces });

/** The browser's Back button. */
export function goBack() {
  if (state.index > 0) state.index -= 1;
  emit();
}

/** The browser's Forward button. */
export function goForward() {
  if (state.index < state.entries.length - 1) state.index += 1;
  emit();
}

const subscribe = (listener: () => void) => {
  state.listeners.add(listener);
  return () => void state.listeners.delete(listener);
};

const router = {
  push(url: string) {
    state.entries = [...state.entries.slice(0, state.index + 1), url];
    state.index += 1;
    state.pushes += 1;
    emit();
  },
  replace(url: string) {
    state.entries[state.index] = url;
    state.replaces += 1;
    emit();
  },
  back: goBack,
  forward: goForward,
  refresh: () => undefined,
  prefetch: () => undefined,
};

export const useRouter = () => router;
export const useParams = () => state.params;
export function usePathname() {
  return useSyncExternalStore(subscribe, currentUrl, currentUrl).split('?')[0]!;
}
export function useSearchParams() {
  const url = useSyncExternalStore(subscribe, currentUrl, currentUrl);
  return new URLSearchParams(url.split('?')[1] ?? '');
}
