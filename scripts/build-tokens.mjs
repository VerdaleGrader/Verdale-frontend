// Generates app/tokens.css from design/tokens.json, the Verdale Design
// System's token file (https://claude.ai/artifact/EPmCfi44rhHVD1Uf7JUZWZ).
// Re-run after updating design/tokens.json: node scripts/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tokens = JSON.parse(readFileSync(path.join(root, 'design/tokens.json'), 'utf8'));

const colorValue = (value, theme) => {
  const raw = typeof value === 'string' ? value : (value[theme] ?? value.light);
  const alias = raw.match(/^\{(.+)\}$/);
  return alias ? `var(--${alias[1]})` : raw;
};
const block = (selector, lines) => `${selector} {\n${lines.map((line) => `  ${line}`).join('\n')}\n}\n`;

const light = [];
const dark = [];
for (const token of tokens.color.tokens) {
  light.push(`--${token.name}: ${colorValue(token.value, 'light')};`);
  if (typeof token.value !== 'string' && token.value.dark)
    dark.push(`--${token.name}: ${colorValue(token.value, 'dark')};`);
}
for (const token of tokens.shadow.tokens) {
  light.push(`--${token.name}: ${token.value.light};`);
  dark.push(`--${token.name}: ${token.value.dark};`);
}
const shared = [];
for (const family of ['spacing', 'radius', 'size']) {
  for (const token of tokens[family].tokens) shared.push(`--${token.name}: ${token.value};`);
}
for (const [name, stack] of Object.entries(tokens.type.families)) shared.push(`--font-${name}-stack: ${stack};`);

const styles = [];
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    const lines = [
      `font-family: var(--font-${group.family});`,
      `font-size: ${style.fontSize};`,
      `line-height: ${style.lineHeight};`,
      `font-weight: ${style.fontWeight};`,
    ];
    if (style.letterSpacing) lines.push(`letter-spacing: ${style.letterSpacing};`);
    if (style.name === 'mono-label') lines.push('font-variant-numeric: tabular-nums;');
    styles.push(block(`@utility text-${style.name}`, lines));
  }
}

const css = `/* Verdale design tokens: generated from design/tokens.json by scripts/build-tokens.mjs. Do not edit. */
${block(':root', [...shared, ...light])}
@media (prefers-color-scheme: dark) {
${block('  :root:not([data-theme="light"])', dark).replace(/^/gm, '  ').trimEnd()}
}
${block('[data-theme="dark"]', [...dark, 'color-scheme: dark;'])}
${block('[data-theme="light"]', [...light, 'color-scheme: light;'])}
${styles.join('\n')}`;
writeFileSync(path.join(root, 'app/tokens.css'), css);
console.log(`app/tokens.css: ${light.length} colors and shadows, ${shared.length} sizes, ${styles.length} text styles`);
