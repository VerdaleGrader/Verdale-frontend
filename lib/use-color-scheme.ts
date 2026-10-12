'use client';

import { useSyncExternalStore } from 'react';

function currentScheme(): 'light' | 'dark' {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'light' || forced === 'dark') return forced;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onChange);
  };
}

/** The theme in effect: the explicit choice on <html>, else the system setting. Follows changes. */
export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, currentScheme, () => 'light');
}
