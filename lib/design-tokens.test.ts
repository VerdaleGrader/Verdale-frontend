import { describe, expect, it } from 'vitest';
import { contrast, colorOf, type Theme } from '@/lib/design-tokens';
import { verdaleDark, verdaleLight } from '@/lib/monaco-themes';

const themes: Theme[] = ['light', 'dark'];
const grounds = ['bg', 'surface', 'surface-sunken', 'surface-hover', 'primary-soft'];

describe('WCAG 2.2 AA contrast, both themes', () => {
  describe.each(themes)('%s theme', (theme) => {
    const ratio = (foreground: string, background: string) =>
      contrast(colorOf(foreground, theme), colorOf(background, theme));

    it.each(grounds)('text is at least 4.5:1 on %s', (ground) => {
      expect(ratio('text', ground)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(grounds)('muted text is at least 4.5:1 on %s', (ground) => {
      expect(ratio('text-muted', ground)).toBeGreaterThanOrEqual(4.5);
    });

    it('the primary button label is readable on primary (and on hover and pressed)', () => {
      for (const fill of ['primary', 'primary-hover', 'primary-pressed']) {
        expect(ratio('on-primary', fill)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('the danger button label is readable on danger', () => {
      expect(ratio('on-danger', 'danger')).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['bg', 'surface'])('brand text and links are at least 4.5:1 on %s', (ground) => {
      expect(ratio('brand-text', ground)).toBeGreaterThanOrEqual(4.5);
      expect(ratio('link', ground)).toBeGreaterThanOrEqual(4.5);
    });

    it('every verdict is readable on its soft background (4.5:1)', () => {
      for (const verdict of ['ac', 'wa', 'tle', 'mle', 're', 'ce', 'pending']) {
        expect({ verdict, ratio: ratio(`verdict-${verdict}`, `verdict-${verdict}-soft`) }).toEqual({
          verdict,
          ratio: expect.toSatisfy((value: number) => value >= 4.5),
        });
      }
    });

    it.each([
      ['danger', 'danger-soft'],
      ['warning', 'warning-soft'],
      ['info', 'info-soft'],
      ['brand-text', 'primary-soft'],
    ])('%s text is at least 4.5:1 on %s', (foreground, background) => {
      expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['bg', 'surface'])('control borders are at least 3:1 on %s', (ground) => {
      expect(ratio('border-strong', ground)).toBeGreaterThanOrEqual(3);
    });

    it.each(['bg', 'surface'])('the focus ring is at least 3:1 on %s', (ground) => {
      expect(ratio('focus-ring', ground)).toBeGreaterThanOrEqual(3);
    });

    it('syntax colours are at least 4.5:1 on the editor ground (surface)', () => {
      for (const name of ['keyword', 'string', 'number', 'comment', 'function', 'type']) {
        expect({ name, ok: ratio(`syntax-${name}`, 'surface') >= 4.5 }).toEqual({ name, ok: true });
      }
    });
  });
});

describe('Monaco themes match the design tokens', () => {
  const hex = (value: string) => value.replace('#', '').toUpperCase();
  const cases = [
    ['light', verdaleLight],
    ['dark', verdaleDark],
  ] as const;

  it.each(cases)('verdale-%s uses the syntax and surface tokens', (theme, data) => {
    const rule = (token: string) => data.rules.find((entry) => entry.token === token)?.foreground;
    expect(rule('keyword')).toBe(hex(colorOf('syntax-keyword', theme)));
    expect(rule('string')).toBe(hex(colorOf('syntax-string', theme)));
    expect(rule('number')).toBe(hex(colorOf('syntax-number', theme)));
    expect(rule('comment')).toBe(hex(colorOf('syntax-comment', theme)));
    expect(rule('type')).toBe(hex(colorOf('syntax-type', theme)));
    expect(rule('identifier.function')).toBe(hex(colorOf('syntax-function', theme)));

    const color = (key: string) => data.colors[key]?.replace('#', '').toUpperCase();
    expect(color('editor.background')).toBe(hex(colorOf('surface', theme)));
    expect(color('editor.foreground')).toBe(hex(colorOf('text', theme)));
    expect(color('editor.lineHighlightBackground')).toBe(hex(colorOf('surface-sunken', theme)));
    expect(color('editor.selectionBackground')).toBe(hex(colorOf('selection', theme)));
    expect(color('editorLineNumber.foreground')).toBe(hex(colorOf('text-muted', theme)));
    expect(color('editorCursor.foreground')).toBe(hex(colorOf('primary', theme)));
  });
});
