const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : absolute.format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateOnly.format(date);
}

export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return 'never';
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (Number.isNaN(seconds)) return 'unknown';
  if (seconds < 0) return 'in the future';
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [2592000, 'month'], [31536000, 'year']];
  let chosen = units[0];
  for (const unit of units) if (seconds >= unit[0]) chosen = unit;
  const amount = Math.floor(seconds / chosen[0]);
  return `${amount} ${chosen[1]}${amount === 1 ? '' : 's'} ago`;
}

// Value for <input type="datetime-local"> in the user's local zone.
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
