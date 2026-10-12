/**
 * Suggests a problem slug from its title while the person types: lower-case
 * letters, digits, "-" and "_", 2 to 64 characters. Core rejects anything
 * else and the reserved words (new, edit, tests, …); the form shows its message.
 */
export function suggestProblemSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

/** What Core accepts as a problem slug: 2 to 64 lower-case letters, digits, "-" or "_", starting with a letter or digit. */
export const PROBLEM_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

/** The message for a slug Core would refuse, or undefined. Reserved words and duplicates are checked against Core. */
export function problemSlugError(slug: string): string | undefined {
  if (!slug) return 'Enter a slug.';
  if (slug.length < 2) return 'Use at least 2 characters.';
  if (slug.length > 64) return 'Use at most 64 characters.';
  if (!PROBLEM_SLUG_PATTERN.test(slug)) {
    return 'Use lower-case letters, digits, “-” or “_”, starting with a letter or digit.';
  }
  return undefined;
}
