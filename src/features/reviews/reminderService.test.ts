import { DEFAULT_SETTINGS, type AppSettings } from '@/features/settings/schema';
import { createRepositories } from '@/repositories';
import { runMigrations } from '@/services/database/migrations';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';
import type { NotificationPermission, ReminderScheduler, ScheduledReminder } from '@/services/notifications/types';

import { syncWeeklyReminder } from './reminderService';

// Jest pins TZ=Europe/Berlin. Wednesday 2026-03-11; the review day is Sunday 2026-03-15.
const at = (day: number, h = 9) => new Date(2026, 2, day, h).getTime();

function fakeScheduler(permission: NotificationPermission = 'granted') {
  const state: { scheduled: ScheduledReminder | null } = { scheduled: null };
  const scheduler: ReminderScheduler = {
    available: true,
    getPermission: async () => permission,
    requestPermission: async () => permission,
    schedule: async (r) => {
      state.scheduled = r;
    },
    cancel: async () => {
      state.scheduled = null;
    },
  };
  return { scheduler, state };
}

const settings = (enabled = true): AppSettings => ({ ...DEFAULT_SETTINGS, weeklyReminder: { enabled, hour: 18, minute: 0 } });

async function setup() {
  const db = createNodeDatabase();
  await runMigrations(db);
  return { db, repos: createRepositories(db) };
}

describe('syncWeeklyReminder', () => {
  it('schedules the review-day reminder once the week has learning', async () => {
    const { db, repos } = await setup();
    const { scheduler, state } = fakeScheduler();

    expect(await syncWeeklyReminder(repos, settings(), scheduler, at(11))).toBeNull();
    expect(state.scheduled).toBeNull();

    await repos.activity.increment('2026-03-10', { interactions: 3 }, at(10));
    const slot = await syncWeeklyReminder(repos, settings(), scheduler, at(11));
    expect(slot?.week.end).toBe('2026-03-15');
    expect(state.scheduled).toMatchObject({ at: at(15, 18), url: '/weekly-review' });
    db.close();
  });

  it('cancels when turned off, not permitted, or the week is reviewed', async () => {
    const { db, repos } = await setup();
    await repos.activity.increment('2026-03-14', { interactions: 3 }, at(14));

    const off = fakeScheduler();
    off.state.scheduled = { at: 1, title: '', body: '', url: '/' };
    expect(await syncWeeklyReminder(repos, settings(false), off.scheduler, at(14))).toBeNull();
    expect(off.state.scheduled).toBeNull();

    const denied = fakeScheduler('denied');
    expect(await syncWeeklyReminder(repos, settings(), denied.scheduler, at(14))).toBeNull();

    // Completing Sunday's review moves the reminder to next week, which has no learning yet.
    await repos.weekly.saveSnapshot(
      {
        week: { start: '2026-03-09', end: '2026-03-15' },
        wordsEncountered: 1,
        newWordsLearned: 1,
        wordsReviewed: 0,
        grammarCompleted: 0,
        accuracy: 1,
        activeDays: 1,
        streak: 1,
        quiz: { questions: 1, correct: 1 },
        completedAt: at(15, 10),
      },
      at(15, 10),
    );
    const done = fakeScheduler();
    expect(await syncWeeklyReminder(repos, settings(), done.scheduler, at(15, 11))).toBeNull();
    db.close();
  });
});
