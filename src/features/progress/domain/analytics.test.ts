import { emptyDay } from '@/features/learning/domain/stats';

import { describeLevelMix, longRangeStart, weeklyBuckets, difficultyStatus, levelAccuracy, reviewsUntilAdaptive, trendOf, weeklyTrends } from './analytics';

const week = (start: string, accuracy: number | null) => ({ week: { start, end: start }, wordsEncountered: 10, accuracy });

describe('weeklyTrends', () => {
  it('compares each week with the one before it', () => {
    const trends = weeklyTrends([week('2026-03-16', 0.9), week('2026-03-09', 0.8), week('2026-03-02', 0.81), week('2026-02-23', null)]);
    expect(trends.map((t) => t.accuracyTrend)).toEqual(['up', 'steady', null, null]);
  });

  it('reads small changes as steady and drops as down', () => {
    expect(trendOf(0.02)).toBe('steady');
    expect(trendOf(-0.1)).toBe('down');
    expect(trendOf(null)).toBeNull();
  });
});

describe('level analytics', () => {
  it('describes the level mix in CEFR order', () => {
    expect(describeLevelMix({ B2: 0.25, B1: 0.75 })).toBe('75% B1 · 25% B2');
    expect(describeLevelMix({ B1: 1, B2: 0 })).toBe('100% B1');
  });

  it('reports accuracy per level and the evidence still needed', () => {
    const stats = [{ level: 'B1' as const, reviews: 20, correct: 15 }];
    expect(levelAccuracy(stats, 'B1')).toEqual({ accuracy: 0.75, reviews: 20 });
    expect(levelAccuracy(stats, 'B2')).toEqual({ accuracy: null, reviews: 0 });
    expect(reviewsUntilAdaptive(20)).toBe(10);
    expect(reviewsUntilAdaptive(45)).toBe(0);
  });

  it('explains what smart difficulty is doing', () => {
    const b1 = (reviews: number) => [{ level: 'B1' as const, reviews, correct: reviews }];
    expect(difficultyStatus({ shares: { B1: 1 }, suggestedLevel: 'B2' }, b1(40), 'B1')).toEqual({ kind: 'suggest', level: 'B2' });
    expect(difficultyStatus({ shares: { B1: 0.75, B2: 0.25 }, suggestedLevel: null }, b1(40), 'B1')).toEqual({ kind: 'mixing' });
    expect(difficultyStatus({ shares: { B1: 1 }, suggestedLevel: null }, b1(12), 'B1')).toEqual({ kind: 'gathering', level: 'B1', needed: 18 });
    expect(difficultyStatus({ shares: { B1: 1 }, suggestedLevel: null }, b1(40), 'B1')).toEqual({ kind: 'steady', level: 'B1' });
  });
});

describe('weeklyBuckets', () => {
  // 2026-03-11 is a Wednesday.
  it('starts on the Monday of the earliest week', () => {
    expect(longRangeStart('2026-03-11', 1)).toBe('2026-03-09');
    expect(longRangeStart('2026-03-09', 3)).toBe('2026-02-23');
    expect(longRangeStart('2026-03-15', 1)).toBe('2026-03-09');
  });

  it('sums each calendar week and counts active days', () => {
    const days = [
      { ...emptyDay('2026-03-02'), interactions: 4, correct: 3, incorrect: 1 },
      { ...emptyDay('2026-03-08'), interactions: 2, correct: 2 },
      { ...emptyDay('2026-03-10'), interactions: 5, correct: 1, incorrect: 4 },
    ];
    expect(weeklyBuckets(days, '2026-03-11', 3)).toEqual([
      { start: '2026-02-23', interactions: 0, correct: 0, incorrect: 0, activeDays: 0 },
      { start: '2026-03-02', interactions: 6, correct: 5, incorrect: 1, activeDays: 2 },
      { start: '2026-03-09', interactions: 5, correct: 1, incorrect: 4, activeDays: 1 },
    ]);
  });
});
