import type { LearningProgress } from '@/types/learning';

import { DAY_MS } from './fsrs';
import {
  SLOW_ANSWER_MS,
  applyReview,
  deriveStatus,
  effectiveStatus,
  emptyProgress,
  ratingForAnswer,
} from './review';

const T0 = Date.UTC(2026, 0, 1, 9);

function progress(overrides: Partial<LearningProgress>): LearningProgress {
  return { ...emptyProgress('x'), reps: 5, fsrsState: 'review', stability: 10, difficulty: 5, ...overrides };
}

describe('ratingForAnswer', () => {
  it('maps wrong answers to Again, slow correct to Hard and correct to Good', () => {
    expect(ratingForAnswer({ kind: 'quiz', correct: false, responseMs: 1000 })).toBe(1);
    expect(ratingForAnswer({ kind: 'quiz', correct: true, responseMs: SLOW_ANSWER_MS + 1 })).toBe(2);
    expect(ratingForAnswer({ kind: 'quiz', correct: true, responseMs: 2000 })).toBe(3);
  });

  it('maps self-graded cards to Good or Again', () => {
    expect(ratingForAnswer({ kind: 'self', knewIt: true })).toBe(3);
    expect(ratingForAnswer({ kind: 'self', knewIt: false })).toBe(1);
  });
});

describe('deriveStatus', () => {
  it('is new before any review', () => {
    expect(deriveStatus(emptyProgress('x'))).toBe('new');
  });

  it('is learning while in short-term steps', () => {
    expect(deriveStatus(progress({ fsrsState: 'learning', reps: 1 }))).toBe('learning');
  });

  it('is mastered with long stability and a correct streak', () => {
    expect(deriveStatus(progress({ stability: 45, streak: 4 }))).toBe('mastered');
    expect(deriveStatus(progress({ stability: 45, streak: 1 }))).toBe('reviewing');
  });

  it('is difficult after repeated lapses or a high failure ratio', () => {
    expect(deriveStatus(progress({ lapses: 3 }))).toBe('difficult');
    expect(deriveStatus(progress({ correctCount: 2, incorrectCount: 4 }))).toBe('difficult');
    expect(deriveStatus(progress({ difficulty: 9 }))).toBe('difficult');
  });

  it('lets a recovered item leave the difficult state', () => {
    expect(deriveStatus(progress({ lapses: 3, streak: 3 }))).toBe('reviewing');
  });
});

describe('effectiveStatus', () => {
  it('applies personal word flags', () => {
    const flags = { isImportant: false, isDifficult: true, isMastered: false };
    expect(effectiveStatus('reviewing', flags)).toBe('difficult');
    expect(effectiveStatus('new', flags)).toBe('new');
    expect(effectiveStatus('learning', { ...flags, isMastered: true })).toBe('mastered');
    expect(effectiveStatus('reviewing', null)).toBe('reviewing');
  });
});

describe('applyReview', () => {
  const quiz = (correct: boolean) => ({ kind: 'quiz' as const, correct, responseMs: 3000 });

  it('initialises progress for a first answer and records history', () => {
    const result = applyReview(null, {
      itemId: 'a',
      exerciseType: 'meaning',
      outcome: quiz(true),
      context: 'session',
      now: T0,
    });
    expect(result.wasNew).toBe(true);
    expect(result.progress).toMatchObject({
      itemId: 'a',
      status: 'learning',
      reps: 1,
      seenCount: 1,
      correctCount: 1,
      streak: 1,
    });
    expect(result.record).toMatchObject({ rating: 3, correct: true, stateBefore: 'new', stateAfter: 'learning' });
  });

  it('tracks counters, streaks and confidence across answers', () => {
    let p: LearningProgress | null = null;
    let now = T0;
    const answers = [true, true, false, true];
    for (const correct of answers) {
      p = applyReview(p, { itemId: 'a', exerciseType: 'meaning', outcome: quiz(correct), context: 'session', now })
        .progress;
      now += DAY_MS;
    }
    expect(p).toMatchObject({ seenCount: 4, correctCount: 3, incorrectCount: 1, streak: 1 });
    expect(p!.confidence).toBeGreaterThan(0);
    expect(p!.confidence).toBeLessThan(1);
  });

  it('schedules a failed item sooner than a successful one', () => {
    const base = progress({ lastReviewedAt: T0, dueAt: T0 + 10 * DAY_MS });
    const now = T0 + 10 * DAY_MS;
    const ok = applyReview(base, { itemId: 'x', exerciseType: 'meaning', outcome: quiz(true), context: 'unlock', now });
    const bad = applyReview(base, { itemId: 'x', exerciseType: 'meaning', outcome: quiz(false), context: 'unlock', now });
    expect(bad.progress.dueAt!).toBeLessThan(ok.progress.dueAt!);
    expect(bad.progress.lapses).toBe(1);
    expect(bad.record.context).toBe('unlock');
  });
});
