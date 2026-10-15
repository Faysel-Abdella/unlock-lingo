import type { LearningProgress } from '@/types/learning';

import { DAY_MS } from './fsrs';
import { type QueueCandidate, type QueueOptions, buildQueue, countDue, mixByLevel } from './queue';
import { emptyProgress } from './review';

const NOW = Date.UTC(2026, 3, 10, 12);
const HOUR = 3_600_000;

function reviewed(overrides: Partial<LearningProgress> = {}): LearningProgress {
  return {
    ...emptyProgress('x'),
    status: 'reviewing',
    fsrsState: 'review',
    reps: 3,
    stability: 5,
    difficulty: 5,
    lastReviewedAt: NOW - 5 * DAY_MS,
    dueAt: NOW - HOUR,
    correctCount: 3,
    lastRating: 3,
    ...overrides,
  };
}

function candidate(itemId: string, progress: LearningProgress | null, extra: Partial<QueueCandidate> = {}): QueueCandidate {
  return {
    itemId,
    type: 'vocabulary',
    cefrLevel: 'B1',
    tags: [],
    contentDifficulty: 5,
    progress: progress ? { ...progress, itemId } : null,
    personal: null,
    ...extra,
  };
}

const opts = (overrides: Partial<QueueOptions> = {}): QueueOptions => ({
  now: NOW,
  size: 10,
  newItemsRemainingToday: 10,
  allowedLevels: ['B1'],
  interests: [],
  ...overrides,
});

describe('buildQueue priority', () => {
  it('orders due reviews before difficult, failed and new items', () => {
    const queue = buildQueue(
      [
        candidate('new1', null),
        candidate('failed', reviewed({ dueAt: NOW + 3 * DAY_MS, lapses: 1, lastReviewedAt: NOW - DAY_MS })),
        candidate('difficult', reviewed({ status: 'difficult', dueAt: NOW + 2 * DAY_MS, lastReviewedAt: NOW - DAY_MS })),
        candidate('due', reviewed()),
      ],
      opts({ size: 4, maxNewRatio: 0 }),
    );
    const reviews = queue.filter((e) => e.reason !== 'new').map((e) => e.reason);
    expect(reviews).toEqual(['due', 'difficult', 'failed']);
    expect(queue.map((e) => e.itemId)).toContain('new1');
  });

  it('puts the most at-risk due review first', () => {
    const queue = buildQueue(
      [
        candidate('slightly-due', reviewed({ stability: 20, lastReviewedAt: NOW - 21 * DAY_MS })),
        candidate('very-overdue', reviewed({ stability: 2, lastReviewedAt: NOW - 30 * DAY_MS })),
        candidate('learning-step', reviewed({ fsrsState: 'learning', dueAt: NOW - 60_000 })),
      ],
      opts(),
    );
    expect(queue.map((e) => e.itemId)).toEqual(['learning-step', 'very-overdue', 'slightly-due']);
  });

  it('boosts personal and important words among due reviews', () => {
    const flags = { isImportant: true, isDifficult: false, isMastered: false };
    const queue = buildQueue(
      [
        candidate('seed', reviewed({ stability: 5, lastReviewedAt: NOW - 6 * DAY_MS })),
        candidate('mine', reviewed({ stability: 5, lastReviewedAt: NOW - 5 * DAY_MS }), { personal: flags }),
      ],
      opts(),
    );
    expect(queue[0]?.itemId).toBe('mine');
  });

  it('does not offer extra practice for items seen in the last few hours', () => {
    const queue = buildQueue(
      [candidate('difficult', reviewed({ status: 'difficult', dueAt: NOW + DAY_MS, lastReviewedAt: NOW - HOUR }))],
      opts(),
    );
    expect(queue).toEqual([]);
  });

  it('skips words the learner marked as mastered', () => {
    const mastered = { isImportant: false, isDifficult: false, isMastered: true };
    const queue = buildQueue([candidate('m', reviewed(), { personal: mastered }), candidate('n', null, { personal: mastered })], opts());
    expect(queue).toEqual([]);
  });
});

describe('buildQueue new-item rationing', () => {
  const manyNew = Array.from({ length: 20 }, (_, i) => candidate(`new${i}`, null));
  const manyDue = (n: number) => Array.from({ length: n }, (_, i) => candidate(`due${i}`, reviewed()));

  it('fills a session with new items when nothing needs review', () => {
    const queue = buildQueue(manyNew, opts({ size: 8 }));
    expect(queue).toHaveLength(8);
    expect(queue.every((e) => e.reason === 'new')).toBe(true);
  });

  it('respects the daily new-item allowance', () => {
    const queue = buildQueue(manyNew, opts({ size: 8, newItemsRemainingToday: 3 }));
    expect(queue).toHaveLength(3);
  });

  it('limits new items to a share of the session when reviews are waiting', () => {
    const queue = buildQueue([...manyDue(10), ...manyNew], opts({ size: 10, maxNewRatio: 0.3 }));
    expect(queue.filter((e) => e.reason === 'new')).toHaveLength(3);
    expect(queue.filter((e) => e.reason === 'due')).toHaveLength(7);
  });

  it('introduces nothing new while the review backlog is large', () => {
    const queue = buildQueue([...manyDue(16), ...manyNew], opts({ size: 10, backlogLimit: 15 }));
    expect(queue.every((e) => e.reason === 'due')).toBe(true);
  });

  it('lets new items use slots left over once every review is included', () => {
    const queue = buildQueue([...manyDue(2), ...manyNew], opts({ size: 10, newItemsRemainingToday: 5 }));
    expect(queue.filter((e) => e.reason === 'due')).toHaveLength(2);
    expect(queue.filter((e) => e.reason === 'new')).toHaveLength(5);
  });

  it('starts with a review even when reviews are scarce', () => {
    const queue = buildQueue([...manyDue(1), ...manyNew], opts({ size: 3, newItemsRemainingToday: 2 }));
    expect(queue.map((e) => e.reason)).toEqual(['due', 'new', 'new']);
  });

  it('spreads new items through the session instead of front-loading them', () => {
    const queue = buildQueue([...manyDue(10), ...manyNew], opts({ size: 10, maxNewRatio: 0.3 }));
    expect(queue[0]?.reason).toBe('due');
    const positions = queue.flatMap((e, i) => (e.reason === 'new' ? [i] : []));
    expect(positions[positions.length - 1]! - positions[0]!).toBeGreaterThanOrEqual(4);
  });
});

describe('buildQueue new-item selection', () => {
  it('prefers personal words, then the allowed level order, then interests', () => {
    const queue = buildQueue(
      [
        candidate('c1', null, { cefrLevel: 'C1' }),
        candidate('b2', null, { cefrLevel: 'B2' }),
        candidate('b1-plain', null, { cefrLevel: 'B1' }),
        candidate('b1-software', null, { cefrLevel: 'B1', tags: ['software'] }),
        candidate('mine', null, { cefrLevel: 'C1', personal: { isImportant: false, isDifficult: false, isMastered: false } }),
      ],
      opts({ allowedLevels: ['B1', 'B2'], interests: ['software'] }),
    );
    expect(queue.map((e) => e.itemId)).toEqual(['mine', 'b1-software', 'b1-plain', 'b2']);
  });
});

describe('countDue', () => {
  it('counts only due, non-mastered reviews', () => {
    expect(
      countDue([candidate('a', reviewed()), candidate('b', reviewed({ dueAt: NOW + DAY_MS })), candidate('c', null)], NOW),
    ).toBe(1);
  });
});

describe('gradual level mixing', () => {
  const b1 = Array.from({ length: 20 }, (_, i) => candidate(`b1-${i}`, null, { cefrLevel: 'B1' }));
  const b2 = Array.from({ length: 20 }, (_, i) => candidate(`b2-${i}`, null, { cefrLevel: 'B2' }));

  it('mixes the next level in by share instead of waiting for the current level to run out', () => {
    const queue = buildQueue([...b1, ...b2], opts({ size: 8, allowedLevels: ['B1', 'B2'], levelShares: { B1: 0.75, B2: 0.25 } }));
    const fromB2 = queue.filter((e) => e.itemId.startsWith('b2-')).length;
    expect(fromB2).toBe(2);
    expect(queue).toHaveLength(8);
  });

  it('keeps personal words first and ignores levels with no share', () => {
    const mine = candidate('mine', null, { cefrLevel: 'C1', personal: { isImportant: false, isDifficult: false, isMastered: false } });
    const ordered = mixByLevel([...b1.slice(0, 2), ...b2.slice(0, 2), mine], { B1: 1 });
    expect(ordered.map((c) => c.itemId)).toEqual(['mine', 'b1-0', 'b1-1']);
  });
});

describe('no unnecessarily easy extra practice', () => {
  it('stops offering a once-failed item as extra practice after it has been answered correctly twice in a row', () => {
    const recovered = candidate('recovered', reviewed({ dueAt: NOW + 5 * DAY_MS, lapses: 1, streak: 4, lastRating: 3, lastReviewedAt: NOW - DAY_MS }));
    const shaky = candidate('shaky', reviewed({ dueAt: NOW + 5 * DAY_MS, lapses: 1, streak: 1, lastRating: 3, lastReviewedAt: NOW - DAY_MS }));
    const justFailed = candidate('just-failed', reviewed({ dueAt: NOW + DAY_MS, incorrectCount: 1, streak: 0, lastRating: 1, lastReviewedAt: NOW - DAY_MS }));
    const queue = buildQueue([recovered, shaky, justFailed], opts());
    expect(queue.map((e) => e.itemId).sort()).toEqual(['just-failed', 'shaky']);
  });
});
