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
