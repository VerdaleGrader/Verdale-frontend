import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
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
