/**
 * The Terms and the Privacy Policy (GRD-122): which version this build shows
 * and where the text lives.
 *
 * ONE place to change when a document is republished (GRD-121 will do it):
 *   1. replace the text in content/legal/<locale>/<document>.md (Thai and English),
 *   2. run `npm run legal:generate`,
 *   3. change its version here to its effective date (YYYY-MM-DD),
 *   4. change the same date in Core's src/constants/legal.ts, in the same release.
 * Core compares the versions this page sends with its own when a person
 * accepts, so a mismatch shows up as an error instead of a wrong record.
 * lib/legal.test.ts checks that each file ends with the date given here.
 */

import type { Locale } from '@/i18n/config';

export type LegalDocumentKey = 'terms' | 'privacy';

export const LEGAL_VERSIONS: Readonly<Record<LegalDocumentKey, string>> = {
  terms: '2026-10-13',
  privacy: '2026-10-13',
};

export interface LegalDocumentInfo {
  key: LegalDocumentKey;
  /** Public address of the page. */
  path: string;
}

export const LEGAL_DOCUMENTS: Readonly<Record<LegalDocumentKey, LegalDocumentInfo>> = {
  terms: { key: 'terms', path: '/terms' },
  privacy: { key: 'privacy', path: '/privacy' },
};

/** Where a signed-in person who has not accepted the current documents is sent. */
export const ACCEPT_TERMS_PATH = '/accept-terms';

/** Pages a person must be able to read before accepting. */
export const LEGAL_EXEMPT_PATHS: readonly string[] = [ACCEPT_TERMS_PATH, '/terms', '/privacy'];

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseVersion(version: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new Error(`Not a version date: ${version}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** "2026-10-13" -> "13 ตุลาคม 2569" (Buddhist era), as the Thai documents print their effective date. */
export function thaiDate(version: string): string {
  const { year, month, day } = parseVersion(version);
  return `${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
}

/** "2026-10-13" -> "13 October 2026", as the English documents print their effective date. */
export function englishDate(version: string): string {
  const { year, month, day } = parseVersion(version);
  return `${day} ${ENGLISH_MONTHS[month - 1]} ${year}`;
}

/** The sentence under the title of a document page and in the acceptance notice. */
export function effectiveLine(version: string, locale: Locale): string {
  return locale === 'th'
    ? `มีผลใช้บังคับตั้งแต่วันที่ ${thaiDate(version)}`
    : `Effective as of ${englishDate(version)}`;
}

/** What each document ends with, so the page and the file can be checked against the version above. */
export function effectiveDateTail(version: string, locale: Locale): string {
  return locale === 'th' ? `ตั้งแต่วันที่ ${thaiDate(version)}` : `as of ${englishDate(version)}`;
}

/** Same-site relative paths only, so "next" can never send a person elsewhere. */
export function safeInternalPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (LEGAL_EXEMPT_PATHS.some((path) => value === path || value.startsWith(`${path}?`))) return '/';
  return value;
}

export function acceptTermsUrl(next: string): string {
  return `${ACCEPT_TERMS_PATH}?next=${encodeURIComponent(next)}`;
}
