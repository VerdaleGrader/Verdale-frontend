import { statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { metadata } from '../app/page';
import { OG_IMAGE, SITE_URL, THEME_COLOR } from './site-metadata';

describe('home page Open Graph metadata', () => {
  it('uses absolute https URLs for the page and images', () => {
    expect(metadata.openGraph?.url).toBe(`${SITE_URL}/`);
    expect(OG_IMAGE.url).toBe('https://verdale.kanonkc.com/og-image.png');
    expect(metadata.twitter?.images).toEqual([OG_IMAGE.url]);
  });

  it('does not set twitter:site or twitter:creator (the brand has no X account)', () => {
    expect(metadata.twitter).not.toHaveProperty('site');
    expect(metadata.twitter).not.toHaveProperty('creator');
  });

  it('uses the Forest & Paper primary as the theme colour', () => {
    expect(THEME_COLOR.toUpperCase()).toBe('#1F6B45');
  });

  it('ships the image under 600 KB at the public root', () => {
    const size = statSync(path.resolve(__dirname, '../public/og-image.png')).size;
    expect(size).toBeLessThan(600 * 1024);
  });
});
