import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  acceptTermsUrl,
  effectiveLine,
  LEGAL_DOCUMENTS,
  LEGAL_VERSIONS,
  safeInternalPath,
  thaiDate,
  type LegalDocumentKey,
} from './legal';
import { LEGAL_MARKDOWN } from './legal-content.gen';
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

describe('the versions this build shows', () => {
  it.each(KEYS)('%s is the effective date printed at the end of its document', (key) => {
    const file = readFileSync(path.join(root, 'content', 'legal', LEGAL_DOCUMENTS[key].file), 'utf8').trimEnd();
    expect(file.endsWith(`ตั้งแต่วันที่ ${thaiDate(LEGAL_VERSIONS[key])}`)).toBe(true);
    expect(effectiveLine(LEGAL_VERSIONS[key])).toBe(`มีผลใช้บังคับตั้งแต่วันที่ ${thaiDate(LEGAL_VERSIONS[key])}`);
  });

  it('are ISO dates', () => {
    for (const key of KEYS) expect(LEGAL_VERSIONS[key]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('the embedded documents', () => {
  it.each(KEYS)('%s matches content/legal (run `npm run legal:generate` if this fails)', (key) => {
    const file = readFileSync(path.join(root, 'content', 'legal', LEGAL_DOCUMENTS[key].file), 'utf8');
    expect(LEGAL_MARKDOWN[key]).toBe(file);
  });
});

describe('the documents', () => {
  it('terms has 16 numbered sections and privacy 14, each with its own anchor', () => {
    const terms = loadLegalContent('terms');
    const privacy = loadLegalContent('privacy');
    expect(terms.sections).toHaveLength(16);
    expect(privacy.sections).toHaveLength(14);
    for (const content of [terms, privacy]) {
      content.sections.forEach((section, index) => {
        expect(section.id).toBe(`section-${index + 1}`);
        expect(section.title.startsWith(`${index + 1}. `)).toBe(true);
      });
    }
  });

  it('state the facts the system keeps to', () => {
    const terms = loadLegalContent('terms').body;
    const privacy = loadLegalContent('privacy').body;
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

  it('are kept as files that can be swapped for the final text: no placeholders left in them', () => {
    for (const key of KEYS) {
      const text = loadLegalContent(key).body;
      expect(text).not.toMatch(/TODO|\[\[|\]\]|XXX|lorem/i);
    }
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
