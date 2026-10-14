import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { testLocale } from '@/i18n/testing';
import { SiteFooter } from '@/components/layout/site-footer';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import { LEGAL_VERSIONS, effectiveLine } from '@/lib/legal';
import { loadLegalContent } from '@/lib/legal-content';

// These pages are rendered with no AuthProvider and no session at all: a visitor can read them.
describe.each([
  ['Terms', TermsPage, 'terms' as const],
  ['Privacy', PrivacyPage, 'privacy' as const],
])('%s page', (_name, Page, key) => {
  it.each(['th', 'en'] as const)('shows the whole document in %s, with its effective date', (locale) => {
    testLocale.current = locale;
    const content = loadLegalContent(key, locale);
    const { container } = render(<Page />);
    expect(screen.getByRole('heading', { level: 1, name: content.title })).toBeTruthy();
    expect(screen.getByText(effectiveLine(LEGAL_VERSIONS[key], locale))).toBeTruthy();
    const article = container.querySelector('article');
    expect(article?.getAttribute('lang')).toBe(locale);
    // Every numbered section is present as a heading with the anchor the contents list points to.
    const headings = container.querySelectorAll('.vd-legal__body h2');
    expect(headings).toHaveLength(content.sections.length);
    content.sections.forEach((section, index) => {
      expect(headings[index]?.textContent).toBe(section.title);
      expect(headings[index]?.id).toBe(section.id);
    });
  });

  it.each([
    ['th', 'สารบัญ'],
    ['en', 'Contents'],
  ] as const)('has a contents list with one link per section in %s', (locale, name) => {
    testLocale.current = locale;
    const content = loadLegalContent(key, locale);
    render(<Page />);
    const lists = screen.getAllByRole('navigation', { hidden: true, name });
    expect(lists.length).toBeGreaterThan(0);
    for (const nav of lists) {
      const links = within(nav).getAllByRole('link', { hidden: true });
      expect(links.map((link) => link.getAttribute('href'))).toEqual(content.sections.map((s) => `#${s.id}`));
    }
  });
});

describe('the English pages', () => {
  it('say they are a translation; the Thai pages do not', () => {
    testLocale.current = 'en';
    render(<TermsPage />);
    expect(screen.getByText(/English translation of the Thai original/)).toBeTruthy();
  });
});

describe('Privacy page tables', () => {
  it('renders the tables inside a scrolling wrapper', () => {
    const { container } = render(<PrivacyPage />);
    expect(container.querySelectorAll('.vd-tablewrap table').length).toBeGreaterThanOrEqual(4);
  });
});

describe('SiteFooter', () => {
  it('is in Thai when the interface is', () => {
    testLocale.current = 'th';
    render(<SiteFooter />);
    const nav = screen.getByRole('navigation', { name: 'เอกสารทางกฎหมาย' });
    expect(within(nav).getByRole('link', { name: 'ข้อกำหนด' }).getAttribute('href')).toBe('/terms');
    expect(within(nav).getByRole('link', { name: 'ความเป็นส่วนตัว' }).getAttribute('href')).toBe('/privacy');
  });

  it('links to the Terms and the Privacy Policy', () => {
    render(<SiteFooter />);
    const nav = screen.getByRole('navigation', { name: 'Legal' });
    expect(within(nav).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(within(nav).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy');
    expect(within(nav).getByRole('link', { name: 'help@kanonkc.com' }).getAttribute('href')).toBe(
      'mailto:help@kanonkc.com'
    );
  });
});
