import { DEFAULT_SETTINGS, type UserProfile } from '@/features/settings/schema';
import { createRepositories } from '@/repositories';
import { runMigrations } from '@/services/database/migrations';
import { seedContent } from '@/services/database/seed';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';

import { DAY_MS } from './domain/fsrs';
import { answerStep, currentStep, isComplete } from './domain/session';
import { loadDashboard, prepareSession } from './learningService';

const NOW = new Date(2026, 4, 12, 9, 0).getTime();
const profile: UserProfile = {
  targetLanguage: 'en',
  nativeLanguage: 'es',
  currentLevel: 'B1',
  targetLevel: 'C1',
  interests: ['software'],
  onboardedAt: NOW,
};

async function setup() {
  const db = createNodeDatabase();
  await runMigrations(db);
  await seedContent(db, NOW);
  return { db, repos: createRepositories(db) };
}

describe('learning service', () => {
  it('builds a first session of new items from the learner level, then reviews them the next day', async () => {
    const { db, repos } = await setup();
    const settings = { ...DEFAULT_SETTINGS, sessionSize: 6, newItemsPerDay: 6 };
    const first = await prepareSession(repos, profile, settings, NOW);
    const newIds = first.state.steps.filter((s) => s.mode === 'intro').map((s) => s.itemId);
    expect(newIds).toHaveLength(6);
    expect(newIds.every((id) => first.items[id]?.cefrLevel === 'B1')).toBe(true);

    // Answer everything correctly, as the session screen would.
    let state = first.state;
    while (!isComplete(state)) {
      const step = currentStep(state)!;
      const item = first.items[step.itemId]!;
      await repos.progress.recordReview({
        itemId: item.id,
        itemType: item.type,
        exerciseType: step.mode === 'intro' ? 'intro' : 'meaning',
        outcome: step.mode === 'intro' ? { kind: 'self', knewIt: true } : { kind: 'quiz', correct: true, responseMs: 2000 },
        context: 'session',
        now: NOW,
      });
      state = answerStep(state, { correct: true, exerciseType: 'meaning' });
    }

    const dashboard = await loadDashboard(repos, profile, settings, NOW);
    expect(dashboard.today.newItems).toBe(6);
    expect(dashboard.newRemainingToday).toBe(0);
    expect(dashboard.streak.current).toBe(1);

    // No new items left today: nothing to study until reviews come due.
    expect((await prepareSession(repos, profile, settings, NOW + 60_000)).state.steps).toHaveLength(0);

    const later = NOW + 10 * DAY_MS;
    const review = await prepareSession(repos, profile, settings, later);
    const reviewed = review.state.steps.filter((s) => s.reason === 'due').map((s) => s.itemId);
    expect(reviewed.length).toBeGreaterThan(0);
    expect(reviewed.every((id) => newIds.includes(id))).toBe(true);
    db.close();
  });
});
