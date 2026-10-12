/**
 * Suggests a slug from a name while the person types it: lower-case letters, digits, "-" and "_",
 * up to 64 characters (Core's rule for Tracks and Collections; it also reserves a few words and
 * says so when the form is sent).
 */
export function suggestCatalogSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}
