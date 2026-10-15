import { ALARM_DEFAULTS } from '@/features/alarms/domain/types';
import { MIGRATIONS, runMigrations } from '@/services/database/migrations';
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

  it('stores the chosen sound and gradual volume', async () => {
    const { db, alarms } = await setup();
    const sound = { uri: 'content://media/internal/audio/media/42', title: 'Morning Glory' };
    const alarm = await alarms.create({ ...ALARM_DEFAULTS, sound, gradualVolume: false }, NOW);
    expect(alarm).toMatchObject({ sound, gradualVolume: false });
    const reset = await alarms.update(alarm.id, { ...alarm, sound: null, gradualVolume: true }, NOW + 1);
    expect(reset).toMatchObject({ sound: null, gradualVolume: true });
    db.close();
  });

  it('keeps existing alarms on the default sound with gradual volume after the upgrade', async () => {
    const db = createNodeDatabase();
    await runMigrations(db, MIGRATIONS.filter((m) => m.version < 3));
    await db.runAsync(
      `INSERT INTO alarms (id, label, hour, minute, days_mask, enabled, created_at, updated_at)
       VALUES ('old', 'Before', 7, 0, 31, 1, ?, ?)`,
      [NOW, NOW],
    );
    await runMigrations(db);
    expect(await createAlarmRepository(db).get('old')).toMatchObject({ label: 'Before', sound: null, gradualVolume: true });
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
