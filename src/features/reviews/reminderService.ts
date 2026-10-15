import type { AppSettings } from '@/features/settings/schema';
import type { Repositories } from '@/repositories';
import type { ReminderScheduler } from '@/services/notifications/types';
import { toDateKey } from '@/utils/date';

import { type ReminderSlot, nextReminderSlot } from './domain/reminder';
import type { ReviewDay } from './domain/weekly';

export const WEEKLY_REMINDER = {
  title: 'Your weekly review is ready',
  body: 'See your week and take a short quiz on the words you found hardest.',
  url: '/weekly-review',
} as const;

/**
 * Keeps the single weekly-review reminder in step with settings and activity.
 * It is only scheduled when the learner opted in, notifications are allowed,
 * and the week it announces already has some learning (a week without any is
 * skipped, like the review itself). Run on launch, on resume and after learning.
 */
export async function syncWeeklyReminder(
  repos: Repositories,
  settings: AppSettings,
  scheduler: ReminderScheduler,
  now: number,
): Promise<ReminderSlot | null> {
  if (!scheduler.available) return null;
  const { enabled, hour, minute } = settings.weeklyReminder;
  if (!enabled || (await scheduler.getPermission()) !== 'granted') {
    await scheduler.cancel();
    return null;
  }
  const [latest] = await repos.weekly.listSnapshots(1);
  const slot = nextReminderSlot(now, settings.weeklyReviewDay as ReviewDay, { hour, minute }, latest?.week.end ?? null);
  const today = toDateKey(now);
  const days = slot.week.start <= today ? await repos.activity.getRange(slot.week.start, today) : [];
  if (!days.some((d) => d.interactions > 0)) {
    await scheduler.cancel();
    return null;
  }
  await scheduler.schedule({ at: slot.at, ...WEEKLY_REMINDER });
  return slot;
}
