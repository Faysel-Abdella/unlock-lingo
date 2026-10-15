import { DEFAULT_SETTINGS, type UserProfile } from '@/features/settings/schema';
import { createRepositories } from '@/repositories';
import { runMigrations } from '@/services/database/migrations';
import { seedContent } from '@/services/database/seed';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';

import { completeWeeklyReview, loadWeeklyReview, prepareWeeklySession } from './weeklyService';

// Jest pins TZ=Europe/Berlin. Sunday 2026-03-15 is the review day; the week is Mon 9 – Sun 15.
const at = (day: number, h = 9) => new Date(2026, 2, day, h).getTime();
const profile: UserProfile = { targetLanguage: 'en', nativeLanguage: null, currentLevel: 'B2', targetLevel: 'C1', interests: [], onboardedAt: at(1) };

async function setup() {
  const db = createNodeDatabase();
  await runMigrations(db);
  await seedContent(db, at(1));
  return { db, repos: createRepositories(db) };
}

const quiz = (correct: boolean) => ({ kind: 'quiz' as const, correct, responseMs: 3000 });

describe('weekly review service', () => {
  it('summarises the week, offers it on review day and stops once completed', async () => {
    const { db, repos } = await setup();
    const answer = (itemId: string, itemType: 'vocabulary' | 'grammar', correct: boolean, day: number, exerciseType: 'meaning' | 'grammar_choice' | 'intro' = 'meaning') =>
      repos.progress.recordReview({
        itemId,
        itemType,
        exerciseType,
        outcome: exerciseType === 'intro' ? { kind: 'self', knewIt: correct } : quiz(correct),
        context: 'session',
        now: at(day),
      });

    // Before the week: an older review, so 'candid' is not new this week.
    await answer('en-vocab-candid', 'vocabulary', true, 2);
    // This week.
    await answer('en-vocab-vague', 'vocabulary', false, 10, 'intro');
    await answer('en-vocab-vague', 'vocabulary', true, 10);
    await answer('en-vocab-ambiguous', 'vocabulary', false, 11);
    await answer('en-vocab-ambiguous', 'vocabulary', false, 12);
    await answer('en-vocab-candid', 'vocabulary', true, 12);
    await answer('en-grammar-since-for', 'grammar', true, 13, 'grammar_choice');

    const review = await loadWeeklyReview(repos, profile, DEFAULT_SETTINGS, at(15, 20));
    expect(review.stats.week).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    expect(review.stats).toMatchObject({ wordsEncountered: 3, newWordsLearned: 2, wordsReviewed: 1, grammarCompleted: 1, activeDays: 4 });
    expect(review.stats.accuracy).toBeCloseTo(3 / 5);
    expect(review.stats.mostDifficult[0]?.label).toBe('ambiguous');
    expect(review.due).toBe(true);
    expect(review.quizItemIds[0]).toBe('en-vocab-ambiguous');

    const session = await prepareWeeklySession(repos, profile, review.quizItemIds);
    expect(session.state.steps.every((s) => s.mode === 'quiz')).toBe(true);

    await completeWeeklyReview(repos, review.stats, { questions: 4, correct: 3 }, at(15, 21));
    const after = await loadWeeklyReview(repos, profile, DEFAULT_SETTINGS, at(16));
    expect(after.due).toBe(false);
    expect(after.completed?.quiz).toEqual({ questions: 4, correct: 3 });
    expect(await repos.weekly.listSnapshots()).toHaveLength(1);
    db.close();
  });

  it('is not offered for a week without any learning', async () => {
    const { db, repos } = await setup();
    const review = await loadWeeklyReview(repos, profile, DEFAULT_SETTINGS, at(15));
    expect(review.due).toBe(false);
    expect(review.quizItemIds).toEqual([]);
    db.close();
  });
});
