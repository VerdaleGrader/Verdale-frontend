import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { ALL_MESSAGES, testLocale } from '@/i18n/testing';

// Globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  testLocale.current = 'en';
});

// next-intl needs a request (server) or a provider (client). Tests answer from the real messages instead,
// in English unless a test sets testLocale.current.
type Translate = (namespace?: string) => unknown;
vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  const translator = (namespace?: string) =>
    actual.createTranslator({
      locale: testLocale.current,
      messages: ALL_MESSAGES[testLocale.current],
      namespace,
    } as never);
  return {
    ...actual,
    useLocale: () => testLocale.current,
    useTranslations: translator as Translate,
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
vi.mock('next-intl/server', async () => {
  const actual = await vi.importActual<typeof import('next-intl')>('next-intl');
  const translator = async (arg?: string | { namespace?: string }) =>
    actual.createTranslator({
      locale: testLocale.current,
      messages: ALL_MESSAGES[testLocale.current],
      namespace: typeof arg === 'string' ? arg : arg?.namespace,
    } as never);
  return { getTranslations: translator, getLocale: async () => testLocale.current };
});

// jsdom has no matchMedia. "Does not match" means a narrow screen, where the plain code editor is used.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// jsdom lacks a few DOM APIs that Radix (Select, Dialog, DropdownMenu) calls.
const elementPrototype = window.HTMLElement.prototype as unknown as Record<string, unknown>;
elementPrototype.hasPointerCapture ??= () => false;
elementPrototype.setPointerCapture ??= () => undefined;
elementPrototype.releasePointerCapture ??= () => undefined;
elementPrototype.scrollIntoView ??= () => undefined;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
