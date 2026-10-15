import type { UserProfile } from '@/features/settings/schema';
import type { NativeAlarmEvent, NativeAlarmSpec } from '@/native/alarmClock';
import { createRepositories } from '@/repositories';
import { runMigrations } from '@/services/database/migrations';
import { seedContent } from '@/services/database/seed';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';
import { toDateKey } from '@/utils/date';
import { createRng } from '@/utils/random';

import { type AlarmBridge, importNativeEvents, prepareAlarmChallenge, recordChallengeResult, syncAlarms } from './alarmService';
import { questionBudget } from './domain/challenge';
import { ALARM_DEFAULTS } from './domain/types';

const NOW = new Date(2026, 2, 11, 7, 0).getTime();
const profile: UserProfile = {
  targetLanguage: 'en',
  nativeLanguage: 'es',
  currentLevel: 'B2',
  targetLevel: 'C1',
  interests: [],
  onboardedAt: NOW,
};

function fakeBridge(events: NativeAlarmEvent[] = []) {
  const bridge: AlarmBridge & { synced: NativeAlarmSpec[] | null; pending: NativeAlarmEvent[] } = {
    synced: null,
    pending: events,
    async setAlarms(specs) {
      bridge.synced = specs;
      return Object.fromEntries(specs.map((s) => [s.id, s.enabled ? NOW + 60_000 : null]));
    },
    consumeEvents() {
      const out = bridge.pending;
      bridge.pending = [];
      return out;
    },
  };
  return bridge;
}

async function setup() {
  const db = createNodeDatabase();
  await runMigrations(db);
  await seedContent(db, NOW);
  return { db, repos: createRepositories(db) };
}

describe('alarm sync', () => {
  it('sends every alarm to the native scheduler with a weekday mask', async () => {
    const { db, repos } = await setup();
    const alarm = await repos.alarms.create({ ...ALARM_DEFAULTS, days: [1, 7] }, NOW);
    const bridge = fakeBridge();
    const next = await syncAlarms(repos, bridge);
    expect(bridge.synced).toEqual([expect.objectContaining({ id: alarm.id, daysMask: 0b1000001, enabled: true })]);
    expect(next[alarm.id]).toBe(NOW + 60_000);
    db.close();
  });

  it('imports a native "disabled" event before syncing, so a rung one-time alarm stays off', async () => {
    const { db, repos } = await setup();
    const alarm = await repos.alarms.create({ ...ALARM_DEFAULTS, days: [] }, NOW);
    const bridge = fakeBridge([{ type: 'disabled', alarmId: alarm.id, at: NOW }]);
    await syncAlarms(repos, bridge);
    expect(bridge.synced?.[0]?.enabled).toBe(false);
    expect((await repos.alarms.get(alarm.id))?.enabled).toBe(false);
    db.close();
  });
});

describe('native event import', () => {
  it('turns fired → snoozed → fired again → stopped into one history entry', async () => {
    const { db, repos } = await setup();
    const { id } = await repos.alarms.create(ALARM_DEFAULTS, NOW);
    await importNativeEvents(repos, [
      { type: 'fired', alarmId: id, at: NOW, snoozeCount: 0 },
      { type: 'snoozed', alarmId: id, at: NOW + 60_000, until: NOW + 600_000 },
      { type: 'fired', alarmId: id, at: NOW + 600_000, snoozeCount: 1 },
    ]);
    await recordChallengeResult(repos, fakeBridge(), id, 7, 5, NOW + 700_000);
    await importNativeEvents(repos, [{ type: 'stopped', alarmId: id, at: NOW + 700_000, method: 'challenge' }]);

    const history = await repos.alarms.recentHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      firedAt: NOW,
      snoozeCount: 1,
      dismissedAt: NOW + 700_000,
      dismissMethod: 'challenge',
      questionsAnswered: 7,
      questionsCorrect: 5,
    });
    expect((await repos.activity.getDay(toDateKey(NOW))).alarmChallenges).toBe(1);
    db.close();
  });

  it('records emergency stops and timeouts from the notification without JS', async () => {
    const { db, repos } = await setup();
    const { id } = await repos.alarms.create(ALARM_DEFAULTS, NOW);
    await importNativeEvents(repos, [
      { type: 'fired', alarmId: id, at: NOW },
      { type: 'stopped', alarmId: id, at: NOW + 120_000, method: 'emergency' },
      { type: 'fired', alarmId: id, at: NOW + 86_400_000 },
      { type: 'stopped', alarmId: id, at: NOW + 86_400_000 + 600_000, method: 'timeout' },
    ]);
    expect((await repos.alarms.recentHistory()).map((h) => h.dismissMethod)).toEqual(['timeout', 'emergency']);
    db.close();
  });
});

describe('alarm challenge content', () => {
  it('provides enough quizzable questions, restricted to the alarm types', async () => {
    const { db, repos } = await setup();
    const content = await prepareAlarmChallenge(
      repos,
      profile,
      { questionCount: 5, challengeTypes: ['synonym', 'grammar_choice'] },
      NOW,
      createRng(7),
    );
    expect(content.questions).toHaveLength(questionBudget(5));
    expect(new Set(content.questions.map((q) => q.exerciseType))).toEqual(new Set(['synonym', 'grammar_choice']));
    expect(content.questions.every((q) => content.items[q.itemId])).toBe(true);
    db.close();
  });

  it('puts due reviews first', async () => {
    const { db, repos } = await setup();
    await repos.progress.recordReview({
      itemId: 'en-vocab-candid',
      itemType: 'vocabulary',
      exerciseType: 'meaning',
      outcome: { kind: 'quiz', correct: false, responseMs: 3000 },
      context: 'session',
      now: NOW - 3 * 86_400_000,
    });
    const content = await prepareAlarmChallenge(repos, profile, { questionCount: 3, challengeTypes: [] }, NOW, createRng(1));
    expect(content.questions[0]?.itemId).toBe('en-vocab-candid');
    expect(content.questions.some((q) => q.exerciseType === 'listening')).toBe(false);
    db.close();
  });
});

