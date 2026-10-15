import { ALARM_DEFAULTS } from '@/features/alarms/domain/types';
import { runMigrations } from '@/services/database/migrations';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';

import { createAlarmRepository } from './alarmRepository';

const NOW = Date.UTC(2026, 2, 11, 6);

async function setup() {
  const db = createNodeDatabase();
  await runMigrations(db);
  return { db, alarms: createAlarmRepository(db) };
}

describe('alarm repository', () => {
  it('creates, lists in time order, updates, toggles and removes alarms', async () => {
    const { db, alarms } = await setup();
    const late = await alarms.create({ ...ALARM_DEFAULTS, hour: 8, label: 'Late' }, NOW);
    const early = await alarms.create({ ...ALARM_DEFAULTS, hour: 6, minute: 45, days: [7, 1, 1], challengeTypes: ['synonym'] }, NOW);
    expect(early).toMatchObject({ days: [1, 7], challengeTypes: ['synonym'], questionCount: 5 });
    expect((await alarms.list()).map((a) => a.id)).toEqual([early.id, late.id]);

    const updated = await alarms.update(late.id, { ...late, questionCount: 3, snoozeEnabled: false }, NOW + 1);
    expect(updated).toMatchObject({ questionCount: 3, snoozeEnabled: false, label: 'Late' });

    await alarms.setEnabled(early.id, false, NOW + 2);
    expect((await alarms.get(early.id))?.enabled).toBe(false);

    await alarms.remove(early.id);
    expect(await alarms.list()).toHaveLength(1);
    db.close();
  });

  it('rejects invalid input instead of storing it', async () => {
    const { db, alarms } = await setup();
    await expect(alarms.create({ ...ALARM_DEFAULTS, hour: 24 }, NOW)).rejects.toThrow();
    await expect(alarms.create({ ...ALARM_DEFAULTS, questionCount: 0 }, NOW)).rejects.toThrow();
    expect(await alarms.list()).toHaveLength(0);
    db.close();
  });

  it('records firing, snoozes and the dismissal outcome, and keeps history when an alarm is deleted', async () => {
    const { db, alarms } = await setup();
    const alarm = await alarms.create(ALARM_DEFAULTS, NOW);
    const historyId = await alarms.recordFired(alarm.id, NOW);
    await alarms.recordSnoozed(historyId);
    await alarms.recordOutcome(historyId, {
      dismissedAt: NOW + 120_000,
      method: 'challenge',
      snoozeCount: 1,
      questionsAnswered: 6,
      questionsCorrect: 5,
    });
    await alarms.remove(alarm.id);
    const [entry] = await alarms.recentHistory();
    expect(entry).toMatchObject({ alarmId: null, dismissMethod: 'challenge', snoozeCount: 1, questionsCorrect: 5 });
    db.close();
  });
});
