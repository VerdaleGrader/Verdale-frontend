/**
 * The Terms and the Privacy Policy (GRD-122): which version this build shows
 * and where the text lives.
 *
 * ONE place to change when a document is republished (GRD-121 will do it):
 *   1. replace the text in content/legal/<document>.md,
 *   2. change its version here to its effective date (YYYY-MM-DD),
 *   3. change the same date in Core's src/constants/legal.ts, in the same release.
 * Core compares the versions this page sends with its own when a person
 * accepts, so a mismatch shows up as an error instead of a wrong record.
 * lib/legal.test.ts checks that each file ends with the date given here.
 */

export type LegalDocumentKey = 'terms' | 'privacy';

export const LEGAL_VERSIONS: Readonly<Record<LegalDocumentKey, string>> = {
  terms: '2026-10-13',
  privacy: '2026-10-13',
};

export interface LegalDocumentInfo {
  key: LegalDocumentKey;
  /** Public address of the page. */
  path: string;
  /** File under content/legal/. */
  file: string;
  /** What the document is called in a sentence ("…ยอมรับ{name}"). */
  name: string;
}

export const LEGAL_DOCUMENTS: Readonly<Record<LegalDocumentKey, LegalDocumentInfo>> = {
  terms: { key: 'terms', path: '/terms', file: 'terms.md', name: 'ข้อกำหนดและเงื่อนไขการใช้บริการ' },
  privacy: { key: 'privacy', path: '/privacy', file: 'privacy.md', name: 'นโยบายความเป็นส่วนตัว' },
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

/** "2026-10-13" -> "13 ตุลาคม 2569" (Buddhist era), as the documents print their effective date. */
export function thaiDate(version: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  const month = match ? THAI_MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !month) throw new Error(`Not a version date: ${version}`);
  return `${Number(match[3])} ${month} ${Number(match[1]) + 543}`;
}

/** The sentence under the title of a document page and in the acceptance notice. */
export function effectiveLine(version: string): string {
  return `มีผลใช้บังคับตั้งแต่วันที่ ${thaiDate(version)}`;
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
