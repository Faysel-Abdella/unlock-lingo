import {
  type ItemSnapshot,
  type WeekAnswer,
  type WeeklyCandidate,
  WEEKLY_QUIZ_SIZE,
  computeWeeklyStats,
  isWeeklyReviewDue,
  reviewWeek,
  selectWeeklyQuiz,
} from './weekly';

// 2026-03-15 is a Sunday.
describe('review week', () => {
  it('ends on the most recent review day, inclusive', () => {
    expect(reviewWeek('2026-03-15', 0)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    expect(reviewWeek('2026-03-18', 0)).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    // Review day Friday (5), checked on Saturday 2026-03-14.
    expect(reviewWeek('2026-03-14', 5)).toEqual({ start: '2026-03-07', end: '2026-03-13' });
  });

  it('is due from the review day until completed, and skips empty weeks', () => {
    expect(isWeeklyReviewDue('2026-03-15', 0, null, true)).toBe(true);
    expect(isWeeklyReviewDue('2026-03-17', 0, '2026-03-08', true)).toBe(true);
    expect(isWeeklyReviewDue('2026-03-17', 0, '2026-03-15', true)).toBe(false);
    expect(isWeeklyReviewDue('2026-03-15', 0, null, false)).toBe(false);
  });
});

describe('computeWeeklyStats', () => {
  const item = (itemId: string, type: ItemSnapshot['type'], status: ItemSnapshot['status'] = 'reviewing'): ItemSnapshot => ({
    itemId,
    label: itemId,
    type,
    status,
  });
  const items = new Map(
    [
      item('ambiguous', 'vocabulary', 'difficult'),
      item('candid', 'vocabulary', 'mastered'),
      item('vague', 'vocabulary', 'learning'),
      item('touch-base', 'phrase'),
      item('since-for', 'grammar'),
    ].map((i) => [i.itemId, i]),
  );
  const a = (itemId: string, itemType: WeekAnswer['itemType'], correct: boolean, extra: Partial<WeekAnswer> = {}): WeekAnswer => ({
    itemId,
    itemType,
    correct,
    scored: true,
    firstEver: false,
    ...extra,
  });

  it('summarises words, new words, grammar, accuracy, difficult and mastered items', () => {
    const stats = computeWeeklyStats({
      week: { start: '2026-03-09', end: '2026-03-15' },
      answers: [
        a('vague', 'vocabulary', false, { scored: false, firstEver: true }), // intro: "new to me"
        a('vague', 'vocabulary', true),
        a('ambiguous', 'vocabulary', false),
        a('ambiguous', 'vocabulary', false),
        a('candid', 'vocabulary', true),
        a('touch-base', 'phrase', true, { firstEver: true }),
        a('since-for', 'grammar', false),
        a('since-for', 'grammar', true),
      ],
      items,
      activeDays: 4,
      streak: 3,
    });
    expect(stats).toMatchObject({
      wordsEncountered: 4,
      newWordsLearned: 2,
      wordsReviewed: 2,
      grammarCompleted: 2,
      answers: 8,
      activeDays: 4,
      streak: 3,
    });
    expect(stats.accuracy).toBeCloseTo(4 / 7);
    expect(stats.mostDifficult.map((i) => i.itemId)).toEqual(['ambiguous', 'since-for']);
    expect(stats.mastered.map((i) => i.itemId)).toEqual(['candid']);
  });

  it('reports no accuracy for a week without scored answers', () => {
    const stats = computeWeeklyStats({ week: { start: 'a', end: 'b' }, answers: [], items, activeDays: 0, streak: 0 });
    expect(stats.accuracy).toBeNull();
    expect(stats.wordsEncountered).toBe(0);
  });
});

describe('selectWeeklyQuiz', () => {
  const c = (itemId: string, extra: Partial<WeeklyCandidate> = {}): WeeklyCandidate => ({
    itemId,
    status: 'reviewing',
    incorrectThisWeek: 0,
    firstSeenThisWeek: false,
    lapses: 0,
    ...extra,
  });

  it('fills its difficult share with the most-missed items, then recent words, then tops up', () => {
    const quiz = selectWeeklyQuiz(
      [
        c('steady'),
        c('new-1', { firstSeenThisWeek: true }),
        c('missed-once', { incorrectThisWeek: 1 }),
        c('missed-thrice', { incorrectThisWeek: 3 }),
        c('flagged', { status: 'difficult' }),
      ],
      4,
    );
    // 4 slots: 60% (2) for the most-missed, then the recent word, then the remaining difficult item.
    expect(quiz).toEqual(['missed-thrice', 'missed-once', 'new-1', 'flagged']);
  });

  it('reserves room for recent words even when many items were missed', () => {
    const missed = Array.from({ length: 30 }, (_, i) => c(`missed-${i}`, { incorrectThisWeek: 1 }));
    const recent = Array.from({ length: 30 }, (_, i) => c(`new-${i}`, { firstSeenThisWeek: true }));
    const quiz = selectWeeklyQuiz([...missed, ...recent]);
    expect(quiz).toHaveLength(WEEKLY_QUIZ_SIZE);
    expect(quiz.filter((id) => id.startsWith('new-')).length).toBeGreaterThanOrEqual(5);
    expect(quiz.filter((id) => id.startsWith('missed-')).length).toBeGreaterThanOrEqual(9);
  });

  it('fills a small week from whatever was practised, but not mastered items', () => {
    const quiz = selectWeeklyQuiz([c('a'), c('b', { status: 'mastered' }), c('c', { firstSeenThisWeek: true })]);
    expect(quiz.sort()).toEqual(['a', 'c']);
  });
});
