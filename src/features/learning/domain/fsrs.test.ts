import {
  DAY_MS,
  DEFAULT_FSRS_PARAMS,
  type FsrsCard,
  NEW_CARD,
  initialDifficulty,
  initialStability,
  nextIntervalDays,
  retrievability,
  schedule,
  scheduleAll,
} from './fsrs';

const T0 = Date.UTC(2026, 0, 1, 9);
const MIN = 60_000;

function reviewCard(overrides: Partial<FsrsCard> = {}): FsrsCard {
  return {
    state: 'review',
    stability: 10,
    difficulty: 5,
    reps: 4,
    lapses: 0,
    lastReviewedAt: T0,
    dueAt: T0 + 10 * DAY_MS,
    ...overrides,
  };
}

describe('FSRS memory model', () => {
  it('has 90% retrievability after exactly one stability period', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 5);
    expect(retrievability(0, 10)).toBe(1);
  });

  it('decays retrievability over time', () => {
    expect(retrievability(30, 10)).toBeLessThan(retrievability(5, 10));
  });

  it('maps stability to an interval at 90% requested retention', () => {
    expect(nextIntervalDays(10)).toBe(10);
    expect(nextIntervalDays(0.2)).toBe(1); // minimum one day
    expect(nextIntervalDays(5000)).toBe(DEFAULT_FSRS_PARAMS.maximumIntervalDays);
  });

  it('uses the FSRS-5 initial values', () => {
    expect(initialStability(1)).toBeCloseTo(0.40255);
    expect(initialStability(3)).toBeCloseTo(3.173);
    expect(initialDifficulty(1)).toBeGreaterThan(initialDifficulty(3));
    expect(initialDifficulty(3)).toBeGreaterThan(initialDifficulty(4));
  });
});

describe('scheduling new cards', () => {
  it('puts Again/Hard/Good into short learning steps', () => {
    const again = schedule(NEW_CARD, 1, T0);
    const good = schedule(NEW_CARD, 3, T0);
    expect(again.card.state).toBe('learning');
    expect(again.card.dueAt).toBe(T0 + 1 * MIN);
    expect(good.card.state).toBe('learning');
    expect(good.card.dueAt).toBe(T0 + 10 * MIN);
    expect(good.card.reps).toBe(1);
  });

  it('graduates Easy straight to review with a multi-day interval', () => {
    const easy = schedule(NEW_CARD, 4, T0);
    expect(easy.card.state).toBe('review');
    expect(easy.intervalMs).toBeGreaterThanOrEqual(10 * DAY_MS);
  });

  it('graduates a learning card on Good later the same day', () => {
    const first = schedule(NEW_CARD, 3, T0).card;
    const second = schedule(first, 3, T0 + 15 * MIN);
    expect(second.card.state).toBe('review');
    expect(second.card.stability).toBeGreaterThan(first.stability); // short-term boost
    expect(second.intervalMs).toBeGreaterThanOrEqual(DAY_MS);
  });

  it('keeps a learning card in learning on Again', () => {
    const first = schedule(NEW_CARD, 3, T0).card;
    const again = schedule(first, 1, T0 + 15 * MIN);
    expect(again.card.state).toBe('learning');
    expect(again.card.stability).toBeLessThan(first.stability);
  });
});

describe('scheduling review cards', () => {
  it('grows stability on a successful review at the due date', () => {
    const card = reviewCard();
    const good = schedule(card, 3, T0 + 10 * DAY_MS);
    expect(good.card.state).toBe('review');
    expect(good.card.stability).toBeGreaterThan(card.stability);
    expect(good.retrievability).toBeCloseTo(0.9, 2);
  });

  it('orders intervals Hard ≤ Good < Easy', () => {
    const all = scheduleAll(reviewCard(), T0 + 10 * DAY_MS);
    expect(all[2].intervalMs).toBeLessThanOrEqual(all[3].intervalMs);
    expect(all[3].intervalMs).toBeLessThan(all[4].intervalMs);
  });

  it('sends a lapse to relearning, counts it, and shrinks stability', () => {
    const card = reviewCard();
    const again = schedule(card, 1, T0 + 10 * DAY_MS);
    expect(again.card.state).toBe('relearning');
    expect(again.card.lapses).toBe(1);
    expect(again.card.stability).toBeLessThan(card.stability);
    expect(again.card.dueAt).toBe(T0 + 10 * DAY_MS + 10 * MIN);
  });

  it('raises difficulty after Again and lowers it after Easy', () => {
    const card = reviewCard();
    const later = T0 + 10 * DAY_MS;
    expect(schedule(card, 1, later).card.difficulty).toBeGreaterThan(card.difficulty);
    expect(schedule(card, 4, later).card.difficulty).toBeLessThan(card.difficulty);
  });

  it('rewards an overdue success more than an on-time one (spacing effect)', () => {
    const card = reviewCard();
    const onTime = schedule(card, 3, T0 + 10 * DAY_MS).card.stability;
    const overdue = schedule(card, 3, T0 + 30 * DAY_MS).card.stability;
    expect(overdue).toBeGreaterThan(onTime);
  });

  it('keeps difficulty within [1, 10] under repeated extremes', () => {
    let card = reviewCard();
    let now = T0;
    for (let i = 0; i < 30; i++) {
      now += 2 * DAY_MS;
      card = schedule(card, 1, now).card;
    }
    expect(card.difficulty).toBeLessThanOrEqual(10);
    for (let i = 0; i < 30; i++) {
      now += 30 * DAY_MS;
      card = schedule(card, 4, now).card;
    }
    expect(card.difficulty).toBeGreaterThanOrEqual(1);
    expect(card.dueAt! - now).toBeLessThanOrEqual(DEFAULT_FSRS_PARAMS.maximumIntervalDays * DAY_MS);
  });
});
