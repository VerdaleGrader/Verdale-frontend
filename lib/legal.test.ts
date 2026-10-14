import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/i18n/config';
import {
  acceptTermsUrl,
  effectiveDateTail,
  effectiveLine,
  englishDate,
  LEGAL_VERSIONS,
  safeInternalPath,
  thaiDate,
  type LegalDocumentKey,
} from './legal';
import { LEGAL_SOURCES } from './legal-bundle.gen';
import { loadLegalContent, parseLegalMarkdown, sectionId } from './legal-content';

const KEYS: LegalDocumentKey[] = ['terms', 'privacy'];
const root = path.resolve(__dirname, '..');

describe('thaiDate', () => {
  it.each([
    ['2026-10-13', '13 ตุลาคม 2569'],
    ['2027-01-05', '5 มกราคม 2570'],
    ['2026-12-31', '31 ธันวาคม 2569'],
  ])('%s -> %s', (version, expected) => {
    expect(thaiDate(version)).toBe(expected);
  });

  it('refuses anything that is not a version date', () => {
    expect(() => thaiDate('latest')).toThrow();
    expect(() => thaiDate('2026-13-01')).toThrow();
  });
});

describe('englishDate', () => {
  it.each([
    ['2026-10-13', '13 October 2026'],
    ['2027-01-05', '5 January 2027'],
  ])('%s -> %s', (version, expected) => {
    expect(englishDate(version)).toBe(expected);
  });

  it('refuses anything that is not a version date', () => {
    expect(() => englishDate('latest')).toThrow();
  });
});

describe('the bundled text', () => {
  it.each(LOCALES.flatMap((locale) => KEYS.map((key) => [locale, key] as const)))(
    'lib/legal-bundle.gen.ts matches content/legal/%s/%s.md (run `npm run legal:generate`)',
    (locale, key) => {
      const file = readFileSync(path.join(root, 'content', 'legal', locale, `${key}.md`), 'utf8');
      expect(LEGAL_SOURCES[locale][key]).toBe(file);
    }
  );
});

describe('the versions this build shows', () => {
  it.each(LOCALES.flatMap((locale) => KEYS.map((key) => [locale, key] as const)))(
    '%s %s is the effective date printed at the end of its document',
    (locale, key) => {
      const file = readFileSync(path.join(root, 'content', 'legal', locale, `${key}.md`), 'utf8').trimEnd();
      expect(file.endsWith(effectiveDateTail(LEGAL_VERSIONS[key], locale))).toBe(true);
    }
  );

  it("the line under the title is in the reader's language", () => {
    expect(effectiveLine('2026-10-13', 'th')).toBe('มีผลใช้บังคับตั้งแต่วันที่ 13 ตุลาคม 2569');
    expect(effectiveLine('2026-10-13', 'en')).toBe('Effective as of 13 October 2026');
  });

  it('are ISO dates', () => {
    for (const key of KEYS) expect(LEGAL_VERSIONS[key]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe.each(LOCALES)('the documents in %s', (locale: Locale) => {
  it('terms has 16 numbered sections and privacy 14, each with its own anchor', () => {
    const terms = loadLegalContent('terms', locale);
    const privacy = loadLegalContent('privacy', locale);
    expect(terms.sections).toHaveLength(16);
    expect(privacy.sections).toHaveLength(14);
    for (const content of [terms, privacy]) {
      content.sections.forEach((section, index) => {
        expect(section.id).toBe(`section-${index + 1}`);
        expect(section.title.startsWith(`${index + 1}. `)).toBe(true);
      });
    }
  });

  it('say the same thing in both languages: same tables, same numbers, same contact', () => {
    const own = loadLegalContent('privacy', locale).body;
    const thai = loadLegalContent('privacy', 'th').body;
    const rows = (text: string) => text.split('\n').filter((line) => line.startsWith('|')).length;
    expect(rows(own)).toBe(rows(thai));
    for (const key of KEYS) {
      const body = loadLegalContent(key, locale).body;
      expect(body).toContain('help@kanonkc.com');
      expect(body).toMatch(/30/);
    }
    expect(loadLegalContent('terms', locale).body).toContain('verdale.kanonkc.com');
  });

  it('are kept as files that can be swapped for the final text: no placeholders left in them', () => {
    for (const key of KEYS) {
      const text = loadLegalContent(key, locale).body;
      expect(text).not.toMatch(/TODO|\[\[|\]\]|XXX|lorem/i);
    }
  });
});

describe('the Thai documents', () => {
  it('state the facts the system keeps to', () => {
    const terms = loadLegalContent('terms', 'th').body;
    const privacy = loadLegalContent('privacy', 'th').body;
    expect(terms).toContain('verdale.kanonkc.com');
    expect(terms).toContain('กานน ชีวทรรศน์');
    expect(terms).toContain('help@kanonkc.com');
    expect(terms).toContain('Google หรือ GitHub เท่านั้น');
    expect(privacy).toContain('อายุเซสชัน 30 วัน');
    expect(privacy).toMatch(/log ข้อมูลทางเทคนิค \| 90 วัน/);
    expect(privacy).toMatch(/สำเนาสำรอง \| 30 วัน/);
    expect(privacy).toContain('ภายใน 30 วันหลังท่านลบบัญชี');
    expect(privacy).toContain('ไม่ใช้คุกกี้โฆษณาหรือเครื่องมือวิเคราะห์ของบุคคลที่สาม');
  });
});

describe('the English documents', () => {
  it('state the same facts', () => {
    const terms = loadLegalContent('terms', 'en').body;
    const privacy = loadLegalContent('privacy', 'en').body;
    expect(terms).toContain('Google or GitHub account');
    expect(privacy).toContain('session lifetime is 30 days');
    expect(privacy).toMatch(/Technical logs \| 90 days/);
    expect(privacy).toMatch(/Backups \| 30 days/);
    expect(privacy).toContain('within 30 days after you delete your account');
    expect(privacy).toContain('do not use advertising cookies or third-party analytics tools');
  });
});

describe('parseLegalMarkdown', () => {
  it('splits title, body and numbered sections', () => {
    const parsed = parseLegalMarkdown('\n# Title\n\nintro\n\n## 1. One\n\ntext\n\n## 2. Two\n');
    expect(parsed.title).toBe('Title');
    expect(parsed.sections).toEqual([
      { id: 'section-1', title: '1. One' },
      { id: 'section-2', title: '2. Two' },
    ]);
    expect(parsed.body.startsWith('intro')).toBe(true);
  });

  it('refuses a file without a title', () => {
    expect(() => parseLegalMarkdown('no title')).toThrow();
  });

  it('sectionId uses the number', () => {
    expect(sectionId('12. การจำกัด')).toBe('section-12');
  });
});

describe('where a person is sent', () => {
  it.each([
    ['/spaces/team', '/spaces/team'],
    ['/explore?x=1', '/explore?x=1'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    ['/\\evil', '/'],
    ['/accept-terms', '/'],
    ['/accept-terms?next=/x', '/'],
    [null, '/'],
  ])('safeInternalPath(%j) -> %j', (input, expected) => {
    expect(safeInternalPath(input)).toBe(expected);
  });

  it('acceptTermsUrl carries the page to return to', () => {
    expect(acceptTermsUrl('/spaces/a b')).toBe('/accept-terms?next=%2Fspaces%2Fa%20b');
  });
});

// The Privacy Policy says there are no advertising cookies and no third-party analytics.
// Adding one means changing the policy first (GRD-122).
describe('no tracker', () => {
  const TRACKERS = [
    'google-analytics',
    'googletagmanager',
    'gtag(',
    '@vercel/analytics',
    '@vercel/speed-insights',
    'plausible',
    'posthog',
    'mixpanel',
    'hotjar',
    'clarity.ms',
    'segment.com',
    'fullstory',
    'amplitude',
    'sentry',
    'datadog',
    'facebook.net',
    'fbq(',
  ];

  it('is not a dependency', () => {
    const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    expect(names.filter((name) => TRACKERS.some((tracker) => name.includes(tracker)))).toEqual([]);
  });

  it('is not loaded by any page, component or script tag', () => {
    const offenders: string[] = [];
    const walk = (directory: string): string[] =>
      readdirSync(directory).flatMap((name) => {
        const full = path.join(directory, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
    for (const directory of ['app', 'components', 'features', 'lib']) {
      for (const file of walk(path.join(root, directory))) {
        if (!/\.(tsx?|css)$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
        const text = readFileSync(file, 'utf8').toLowerCase();
        for (const tracker of TRACKERS)
          if (text.includes(tracker)) offenders.push(`${path.relative(root, file)}: ${tracker}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
