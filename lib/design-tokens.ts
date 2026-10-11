import tokens from '@/design/tokens.json';

type Theme = 'light' | 'dark';
type TokenValue = string | Partial<Record<Theme, string>>;

const byName = new Map<string, TokenValue>(
  (tokens.color.tokens as Array<{ name: string; value: TokenValue }>).map((token) => [token.name, token.value])
);

/** A colour token as hex for one theme, following `{alias}` references. */
export function colorOf(name: string, theme: Theme): string {
  const value = byName.get(name);
  if (value === undefined) throw new Error(`Unknown colour token: ${name}`);
  const raw = typeof value === 'string' ? value : (value[theme] ?? value.light);
  const alias = raw?.match(/^\{(.+)\}$/);
  if (alias) return colorOf(alias[1]!, theme);
  return raw!;
}

function channel(hex: string, index: number): number {
  const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** WCAG 2.x contrast ratio between two opaque hex colours. */
export function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

export type { Theme };
