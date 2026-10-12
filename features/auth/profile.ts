/** Core's rule for a display name: trimmed, 1 to 64 characters, no control characters (new lines, tabs, NUL, …). */
export const DISPLAY_NAME_MAX_LENGTH = 64;

export function displayNameError(value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'Enter a name.';
  if (name.length > DISPLAY_NAME_MAX_LENGTH) return `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  if (/\p{Cc}/u.test(name)) return 'Remove control characters.';
  return undefined;
}
