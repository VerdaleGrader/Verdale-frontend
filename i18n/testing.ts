import en from '../messages/en.json';
import th from '../messages/th.json';
import type { Locale } from './config';

/** For tests: the language the mocked next-intl (vitest.setup.ts) answers in. Reset to English after each test. */
export const testLocale: { current: Locale } = { current: 'en' };

export const ALL_MESSAGES = { en, th } as const;
