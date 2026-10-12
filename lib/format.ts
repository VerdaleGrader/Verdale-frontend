/** Numbers carry units with a space (design system: Voice and copy): 124 ms, 1.25 s, 15.2 MB. */
export function formatTime(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${Number((milliseconds / 1000).toFixed(2))} s`;
}

export function formatMemory(kilobytes: number): string {
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

/** "3 days ago" style, in English, from an ISO date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const units: Array<[number, string]> = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [2592000, 'month'],
    [31536000, 'year'],
  ];
  let chosen: [number, string] = [1, 'second'];
  for (const unit of units) if (seconds >= unit[0]) chosen = unit;
  const count = Math.floor(seconds / chosen[0]);
  return `${count} ${chosen[1]}${count === 1 ? '' : 's'} ago`;
}

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}
