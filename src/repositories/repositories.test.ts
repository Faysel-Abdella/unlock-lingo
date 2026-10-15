import { DAY_MS } from '@/features/learning/domain/fsrs';
import { buildQueue } from '@/features/learning/domain/queue';
import { runMigrations } from '@/services/database/migrations';
import { seedContent } from '@/services/database/seed';
import { createNodeDatabase } from '@/services/database/testing/nodeDatabase';
import { toDateKey } from '@/utils/date';

import { type Repositories, createRepositories } from './index';

const NOW = new Date(2026, 4, 12, 9, 0).getTime();

async function setup(): Promise<{ repos: Repositories; close: () => void }> {
  const db = createNodeDatabase();
  await runMigrations(db);
  await seedContent(db, NOW);
  return { repos: createRepositories(db), close: () => db.close() };
}

const quiz = (correct: boolean) => ({ kind: 'quiz' as const, correct, responseMs: 2500 });

describe('content repository', () => {
  it('loads typed items of each kind', async () => {
    const { repos, close } = await setup();
    const [vocab, grammar, phrase] = await repos.content.getItems([
      'en-vocab-resilient',
      'en-grammar-present-simple-third-person',
      'en-phrase-touch-base',
    ]);
    expect(vocab).toMatchObject({ type: 'vocabulary', word: 'resilient', synonyms: expect.arrayContaining(['tough']) });
    expect(grammar).toMatchObject({ type: 'grammar', correctAnswer: 'goes' });
    expect(phrase).toMatchObject({ type: 'phrase', phrase: 'touch base' });
    close();
  });

  it('searches and filters vocabulary', async () => {
    const { repos, close } = await setup();
    const results = await repos.content.listVocabulary({ language: 'en', search: 'recover' });
    expect(results.map((r) => r.item.word)).toContain('resilient');
    const c1 = await repos.content.listVocabulary({ language: 'en', level: 'C1' });
    expect(c1.length).toBe(30);
    expect(c1.every((r) => r.item.cefrLevel === 'C1' && r.status === 'new')).toBe(true);
    close();
  });
});

describe('progress repository', () => {
  it('records a review atomically: progress, history and daily activity', async () => {
    const { repos, close } = await setup();
    const result = await repos.progress.recordReview({
      itemId: 'en-vocab-resilient',
      itemType: 'vocabulary',
      exerciseType: 'meaning',
      outcome: quiz(true),
      context: 'session',
      now: NOW,
    });
    expect(result.wasNew).toBe(true);
    expect(await repos.progress.getProgress('en-vocab-resilient')).toMatchObject({ reps: 1, correctCount: 1 });
    expect(await repos.activity.getDay(toDateKey(NOW))).toMatchObject({ interactions: 1, correct: 1, newItems: 1, reviews: 0 });

    await repos.progress.recordReview({
      itemId: 'en-grammar-since-for',
      itemType: 'grammar',
      exerciseType: 'grammar_choice',
      outcome: quiz(false),
      context: 'unlock',
      now: NOW + 1000,
    });
    expect(await repos.activity.getDay(toDateKey(NOW))).toMatchObject({
      interactions: 2,
      incorrect: 1,
      grammarAnswered: 1,
      unlockCardsShown: 1,
    });
    expect((await repos.progress.getLastExerciseTypes(['en-vocab-resilient'])).get('en-vocab-resilient')).toBe('meaning');
    close();
  });

  it('feeds queue candidates that make reviewed items due later', async () => {
    const { repos, close } = await setup();
    await repos.progress.recordReview({
      itemId: 'en-vocab-resilient',
      itemType: 'vocabulary',
      exerciseType: 'meaning',
      outcome: quiz(true),
      context: 'session',
      now: NOW - 3 * DAY_MS,
    });
    const candidates = await repos.progress.getQueueCandidates('en');
    expect(candidates).toHaveLength(150);
    const queue = buildQueue(candidates, {
      now: NOW,
      size: 5,
      newItemsRemainingToday: 2,
      allowedLevels: ['B2'],
      interests: [],
    });
    expect(queue[0]).toEqual({ itemId: 'en-vocab-resilient', reason: 'due' });
    expect(queue.filter((e) => e.reason === 'new')).toHaveLength(2);
    close();
  });

  it('reports accuracy per CEFR level', async () => {
    const { repos, close } = await setup();
    for (const [id, correct] of [
      ['en-vocab-reliable', true],
      ['en-vocab-deadline', false],
      ['en-vocab-meticulous', true],
    ] as const) {
      await repos.progress.recordReview({ itemId: id, itemType: 'vocabulary', exerciseType: 'meaning', outcome: quiz(correct), context: 'session', now: NOW });
    }
    const stats = await repos.progress.getLevelAccuracy('en', NOW - DAY_MS);
    expect(stats).toEqual(
      expect.arrayContaining([
        { level: 'B1', reviews: 2, correct: 1 },
        { level: 'C1', reviews: 1, correct: 1 },
      ]),
    );
    close();
  });
});

describe('personal vocabulary repository', () => {
  it('links a word that exists in bundled content and enriches it immediately', async () => {
    const { repos, close } = await setup();
    const { word, created } = await repos.personal.add({ word: '  Resilient ', language: 'en', defaultLevel: 'B2', source: 'reading' }, NOW);
    expect(created).toBe(true);
    expect(word).toMatchObject({ itemId: 'en-vocab-resilient', enrichmentStatus: 'enriched', isBundled: true });
    expect(word.item.definition).toContain('recover');

    const again = await repos.personal.add({ word: 'resilient', language: 'en', defaultLevel: 'B2' }, NOW);
    expect(again.created).toBe(false);
    expect(await repos.personal.list()).toHaveLength(1);
    close();
  });

  it('creates a pending user item for unknown words, which can be filled in and removed', async () => {
    const { repos, close } = await setup();
    const { word } = await repos.personal.add({ word: 'serendipity', contextNote: 'from a podcast', language: 'en', defaultLevel: 'B2' }, NOW);
    expect(word).toMatchObject({ enrichmentStatus: 'pending', isBundled: false, contextNote: 'from a podcast', status: 'new' });

    await repos.personal.updateDetails(word.id, { definition: 'finding good things by chance', example: 'Meeting her was pure serendipity.' }, NOW);
    const updated = await repos.personal.get(word.id);
    expect(updated).toMatchObject({ enrichmentStatus: 'enriched', item: { definition: 'finding good things by chance' } });

    await repos.personal.updateFlags(word.id, { isImportant: true }, NOW);
    const candidates = await repos.progress.getQueueCandidates('en');
    expect(candidates.find((c) => c.itemId === word.itemId)?.personal).toEqual({ isImportant: true, isDifficult: false, isMastered: false });

    await repos.personal.remove(word.id);
    expect(await repos.content.getItem(word.itemId)).toBeNull();
    close();
  });

  it('keeps bundled content and progress when a linked word is removed', async () => {
    const { repos, close } = await setup();
    const { word } = await repos.personal.add({ word: 'candid', language: 'en', defaultLevel: 'B2' }, NOW);
    await repos.progress.recordReview({ itemId: word.itemId, itemType: 'vocabulary', exerciseType: 'meaning', outcome: quiz(true), context: 'session', now: NOW });
    await expect(repos.personal.updateDetails(word.id, { definition: 'x' }, NOW)).rejects.toThrow();
    await repos.personal.remove(word.id);
    expect(await repos.content.getItem(word.itemId)).not.toBeNull();
    expect(await repos.progress.getProgress(word.itemId)).not.toBeNull();
    close();
  });
});

describe('profile repository', () => {
  it('stores the profile and validates settings with defaults', async () => {
    const { repos, close } = await setup();
    expect(await repos.profile.getProfile()).toBeNull();
    await repos.profile.saveProfile(
      { targetLanguage: 'en', nativeLanguage: 'es', currentLevel: 'B1', targetLevel: 'C1', interests: ['software'], onboardedAt: NOW },
      NOW,
    );
    expect(await repos.profile.getProfile()).toMatchObject({ currentLevel: 'B1', interests: ['software'] });

    expect((await repos.profile.getSettings()).dailyGoal).toBe(10);
    const next = await repos.profile.updateSettings({ dailyGoal: 15 });
    expect(next.dailyGoal).toBe(15);
    expect((await repos.profile.getSettings()).dailyGoal).toBe(15);
    close();
  });

  it('resets progress without touching My Words', async () => {
    const { repos, close } = await setup();
    await repos.personal.add({ word: 'serendipity', language: 'en', defaultLevel: 'B2' }, NOW);
    await repos.progress.recordReview({ itemId: 'en-vocab-vague', itemType: 'vocabulary', exerciseType: 'meaning', outcome: quiz(true), context: 'session', now: NOW });
    await repos.profile.resetProgress();
    expect(await repos.progress.getProgress('en-vocab-vague')).toBeNull();
    expect((await repos.activity.getDay(toDateKey(NOW))).interactions).toBe(0);
    expect(await repos.personal.list()).toHaveLength(1);
    close();
  });
});

describe('activity repository', () => {
  it('fills gaps in a date range and lists active days', async () => {
    const { repos, close } = await setup();
    await repos.activity.increment('2026-05-10', { interactions: 2 }, NOW);
    await repos.activity.increment('2026-05-12', { interactions: 1 }, NOW);
    const range = await repos.activity.getRange('2026-05-09', '2026-05-12');
    expect(range.map((d) => d.interactions)).toEqual([0, 2, 0, 1]);
    expect(await repos.activity.getActiveDays()).toEqual(['2026-05-12', '2026-05-10']);
    close();
  });
});
