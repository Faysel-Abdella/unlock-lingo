import type { Alarm, Weekday } from './types';
import { WEEKDAYS } from './types';

export function daysToMask(days: readonly Weekday[]): number {
  return days.reduce((mask, d) => mask | (1 << (d - 1)), 0);
}

export function maskToDays(mask: number): Weekday[] {
  return WEEKDAYS.filter((d) => (mask & (1 << (d - 1))) !== 0);
}

/** JS `Date#getDay()` (0 = Sunday) to ISO weekday (7 = Sunday). */
export function isoWeekday(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/**
 * Next time the alarm should ring strictly after `after`, in local time.
 * Uses calendar arithmetic (not fixed 24 h steps), so DST changes keep the
 * wall-clock time. Returns null for a disabled alarm.
 */
export function nextOccurrence(
  alarm: Pick<Alarm, 'hour' | 'minute' | 'days' | 'enabled'>,
  after: number,
): number | null {
  if (!alarm.enabled) return null;
  const base = new Date(after);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, alarm.hour, alarm.minute, 0, 0);
    if (candidate.getTime() <= after) continue;
    if (alarm.days.length === 0 || alarm.days.includes(isoWeekday(candidate))) return candidate.getTime();
  }
  return null;
}

export function nextEnabledAlarm<T extends Alarm>(alarms: readonly T[], after: number): { alarm: T; at: number } | null {
  let best: { alarm: T; at: number } | null = null;
  for (const alarm of alarms) {
    const at = nextOccurrence(alarm, after);
    if (at !== null && (best === null || at < best.at)) best = { alarm, at };
  }
  return best;
}

const SHORT_DAY: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

export function describeRepeat(days: readonly Weekday[]): string {
  const set = new Set(days);
  if (set.size === 0) return 'Once';
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d as Weekday))) return 'Weekdays';
  if (set.size === 2 && set.has(6) && set.has(7)) return 'Weekends';
  return WEEKDAYS.filter((d) => set.has(d)).map((d) => SHORT_DAY[d]).join(', ');
}

export function shortDayLabel(day: Weekday): string {
  return SHORT_DAY[day];
}

export function formatAlarmTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "in 7 h 30 min" style countdown, rounded up to the minute. */
export function describeTimeUntil(at: number, now: number): string {
  const totalMinutes = Math.max(1, Math.ceil((at - now) / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (minutes && !days) parts.push(`${minutes} min`);
  return `in ${parts.join(' ')}`;
}

export interface SnoozeDecision {
  allowed: boolean;
  remaining: number;
  until: number | null;
}

export function snoozeDecision(alarm: Pick<Alarm, 'snoozeEnabled' | 'snoozeMinutes' | 'maxSnoozes'>, snoozesUsed: number, now: number): SnoozeDecision {
  const remaining = alarm.snoozeEnabled ? Math.max(0, alarm.maxSnoozes - snoozesUsed) : 0;
  return {
    allowed: remaining > 0,
    remaining,
    until: remaining > 0 ? now + alarm.snoozeMinutes * 60_000 : null,
  };
}
