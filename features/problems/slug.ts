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

/** The same rule Core applies: 2 to 64 of a-z, 0-9, "-" and "_", starting with a letter or digit. */
export const PROBLEM_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

/** Words that are routes below a problem; Core refuses them as slugs too. */
export const RESERVED_PROBLEM_SLUGS: ReadonlySet<string> = new Set([
  'new',
  'edit',
  'editor',
  'tests',
  'solutions',
  'submissions',
  'images',
  'publish',
  'archive',
  'settings',
]);

/** What is wrong with a slug, in words, or nothing when it is fine. Whether it is taken is asked separately. */
export function validateProblemSlug(slug: string): string | undefined {
  if (!slug) return 'Enter a slug.';
  if (RESERVED_PROBLEM_SLUGS.has(slug)) return 'This slug is reserved. Pick another.';
  if (!PROBLEM_SLUG_PATTERN.test(slug)) {
    return 'Use 2 to 64 lower-case letters, digits, “-” or “_”, starting with a letter or digit.';
  }
  return undefined;
}
