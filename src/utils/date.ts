/** Local calendar day as `YYYY-MM-DD`. */
export type DateKey = string;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateKey(ms: number): DateKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Adds calendar days (DST-safe because it works on local dates, not milliseconds). */
export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date.getTime());
}

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The `count` most recent day keys ending at `today`, oldest first. */
export function lastNDays(today: DateKey, count: number): DateKey[] {
  const keys: DateKey[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(addDays(today, -i));
  return keys;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayShort(key: DateKey): string {
  return WEEKDAY_SHORT[parseDateKey(key).getDay()] ?? '';
}

export function formatRelativeDue(dueAt: number, now: number): string {
  const diff = dueAt - now;
  if (diff <= 0) return 'due now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `in ${days} d`;
  const months = Math.round(days / 30);
  return `in ${months} mo`;
}
