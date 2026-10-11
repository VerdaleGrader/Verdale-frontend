/**
 * Suggests a slug from a name while the person types it: lower-case letters,
 * digits, "-" and "_", 3 to 32 characters (Core rejects anything else and
 * names reserved words; the form shows Core's message).
 */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
}
