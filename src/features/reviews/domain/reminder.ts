import { type DateKey, addDays, parseDateKey, toDateKey } from '@/utils/date';

import { type ReviewDay, type WeekWindow } from './weekly';

export interface ReminderTime {
  hour: number;
  minute: number;
}

export interface ReminderSlot {
  /** The week the reminder announces. */
  week: WeekWindow;
  /** When to notify (epoch ms, local time on the review day). */
  at: number;
}

function atLocalTime(day: DateKey, time: ReminderTime): number {
  const date = parseDateKey(day);
  // Constructing from local components keeps the wall-clock time across DST changes.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hour, time.minute).getTime();
}

/**
 * The next weekly-review reminder: the coming review day at the reminder time,
 * or the one after if today's time has passed or today's review is already done.
 */
export function nextReminderSlot(
  now: number,
  reviewDay: ReviewDay,
  time: ReminderTime,
  lastCompletedWeekEnd: DateKey | null,
): ReminderSlot {
  const today = toDateKey(now);
  const ahead = (reviewDay - parseDateKey(today).getDay() + 7) % 7;
  let end = addDays(today, ahead);
  const passed = end === today && atLocalTime(end, time) <= now;
  const done = lastCompletedWeekEnd !== null && lastCompletedWeekEnd >= end;
  if (passed || done) end = addDays(end, 7);
  return { week: { start: addDays(end, -6), end }, at: atLocalTime(end, time) };
}
