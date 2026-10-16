import { colorOf } from './design-tokens';

/** Single source of truth for the site's public copy and Open Graph values (GRD-130). */
export const SITE_URL = 'https://verdale.kanonkc.com';
export const SITE_NAME = 'Verdale';
export const SITE_TITLE = 'Verdale: Write the problems. Solve the problems';
export const SITE_DESCRIPTION =
  'An online judge where anyone can set the problems. Create problems, group them into Spaces, and solve problems from others.';
export const SITE_LOCALE = 'en_US';
/** The primary token (Forest & Paper), as the browser chrome colour. */
export const THEME_COLOR = colorOf('primary', 'light');

export const OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: 'Verdale: an online judge where anyone can set the problems, shown with an Accepted verdict and test progress',
};
