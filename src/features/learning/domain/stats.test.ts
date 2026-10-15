import { computeLevelPolicy } from './levelPolicy';
import { accuracy, computeStreak, emptyDay, sumActivity } from './stats';

describe('computeStreak', () => {
  it('counts consecutive active days ending today', () => {
    expect(computeStreak(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10')).toEqual({
      current: 3,
      longest: 3,
      activeToday: true,
    });
  });

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(computeStreak(['2026-03-08', '2026-03-09'], '2026-03-10')).toMatchObject({ current: 2, activeToday: false });
  });

  it('resets after a missed day but remembers the longest run', () => {
    const days = ['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-03-09', '2026-03-10'];
    expect(computeStreak(days, '2026-03-10')).toMatchObject({ current: 2, longest: 4 });
    expect(computeStreak(days, '2026-03-12').current).toBe(0);
  });

  it('handles month boundaries', () => {
    expect(computeStreak(['2026-02-28', '2026-03-01'], '2026-03-01').current).toBe(2);
  });
});

describe('activity aggregation', () => {
  it('sums days and computes accuracy', () => {
    const a = { ...emptyDay('2026-03-01'), interactions: 5, correct: 4, incorrect: 1 };
    const b = { ...emptyDay('2026-03-02'), interactions: 3, correct: 1, incorrect: 2 };
    const total = sumActivity([a, b]);
    expect(total).toMatchObject({ interactions: 8, correct: 5, incorrect: 3 });
    expect(accuracy(total.correct, total.incorrect)).toBeCloseTo(5 / 8);
    expect(accuracy(0, 0)).toBeNull();
  });
});

describe('computeLevelPolicy (smart difficulty)', () => {
  it('stays at the current level without enough evidence', () => {
    expect(computeLevelPolicy('B1', 'C1', [{ level: 'B1', reviews: 10, correct: 10 }]).allowedLevels).toEqual(['B1']);
  });

  it('introduces the next level after consistent success', () => {
    expect(computeLevelPolicy('B1', 'C1', [{ level: 'B1', reviews: 40, correct: 36 }]).allowedLevels).toEqual([
      'B1',
      'B2',
    ]);
  });

  it('never goes beyond the target level', () => {
    expect(computeLevelPolicy('B2', 'B2', [{ level: 'B2', reviews: 50, correct: 50 }]).allowedLevels).toEqual(['B2']);
  });

  it('suggests a level change once the next level is also mastered', () => {
    const policy = computeLevelPolicy('B1', 'C1', [
      { level: 'B1', reviews: 40, correct: 38 },
      { level: 'B2', reviews: 35, correct: 31 },
    ]);
    expect(policy.suggestedLevel).toBe('B2');
  });

  it('draws from the level below when the learner is struggling', () => {
    expect(computeLevelPolicy('B2', 'C1', [{ level: 'B2', reviews: 40, correct: 20 }]).allowedLevels).toEqual([
      'B2',
      'B1',
    ]);
  });
});
