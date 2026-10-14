import { describe, expect, it } from 'vitest';
import en from '../messages/en.json';
import th from '../messages/th.json';
import { isLocale, localeFromAcceptLanguage } from './config';

describe('localeFromAcceptLanguage', () => {
  it.each([
    ['th', 'th'],
    ['th-TH,th;q=0.9,en;q=0.8', 'th'],
    ['en-US,en;q=0.9,th;q=0.8', 'en'],
    ['fr-FR,fr;q=0.9,th;q=0.5', 'th'],
    ['en;q=0.2, th;q=0.8', 'th'],
    ['th;q=0, en', 'en'],
  ])('%s -> %s', (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });

  it('has no opinion when nothing matches', () => {
    expect(localeFromAcceptLanguage('fr-FR,de;q=0.8')).toBeUndefined();
    expect(localeFromAcceptLanguage('')).toBeUndefined();
    expect(localeFromAcceptLanguage(null)).toBeUndefined();
  });
});

describe('isLocale', () => {
  it('accepts only the languages we have', () => {
    expect(isLocale('th')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return { ...all, ...(typeof value === 'string' ? { [path]: value } : leaves(value, path)) };
  }, {});
}

/** {name} in "Hello {name}" and the tags in "<terms>…</terms>". */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}|<(\w+)>/g)].map((match) => match[1] ?? `<${match[2]}>`).sort();
}

describe('messages', () => {
  const english = leaves(en);
  const thai = leaves(th);

  it('Thai has exactly the keys English has', () => {
    expect(Object.keys(thai).sort()).toEqual(Object.keys(english).sort());
  });

  it('Thai uses the same placeholders as English', () => {
    for (const key of Object.keys(english)) {
      expect(placeholders(thai[key]!), key).toEqual(placeholders(english[key]!));
    }
  });

  it('nothing is left empty, except the translation notice that only English readers see', () => {
    const empty = (messages: Record<string, string>) =>
      Object.keys(messages).filter((key) => messages[key]!.trim() === '');
    expect(empty(english)).toEqual([]);
    expect(empty(thai)).toEqual(['Legal.translationNotice']);
  });
});
