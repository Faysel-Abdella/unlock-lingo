/**
 * FSRS-5 (Free Spaced Repetition Scheduler) implementation.
 *
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 * The scheduler is pure: it takes a card snapshot, a rating and a timestamp and
 * returns the next snapshot. Persistence and status derivation live elsewhere.
 */
import type { FsrsState, Rating } from '@/types/learning';

export const DEFAULT_FSRS_WEIGHTS: readonly number[] = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
  1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

const DECAY = -0.5;
const FACTOR = 19 / 81;
const MINUTE = 60_000;
export const DAY_MS = 86_400_000;

export interface FsrsParams {
  weights: readonly number[];
  /** Target probability of recall when a review becomes due. */
  requestRetention: number;
  maximumIntervalDays: number;
  /** Delay after rating a new or learning card Again / Hard / Good. */
  learningStepsMinutes: { again: number; hard: number; good: number };
  /** Delay before a lapsed review card is shown again. */
  relearningStepMinutes: number;
}

export const DEFAULT_FSRS_PARAMS: FsrsParams = {
  weights: DEFAULT_FSRS_WEIGHTS,
  requestRetention: 0.9,
  maximumIntervalDays: 365,
  learningStepsMinutes: { again: 1, hard: 5, good: 10 },
  relearningStepMinutes: 10,
};

export interface FsrsCard {
  state: FsrsState;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewedAt: number | null;
  dueAt: number | null;
}

export interface SchedulingResult {
  card: FsrsCard;
  /** Probability of recall at review time, before the rating was applied. Null for new cards. */
  retrievability: number | null;
  /** Interval until the next review, in milliseconds. */
  intervalMs: number;
}

export const NEW_CARD: FsrsCard = {
  state: 'new',
  stability: 0,
  difficulty: 0,
  reps: 0,
  lapses: 0,
  lastReviewedAt: null,
  dueAt: null,
};

function w(params: FsrsParams, index: number): number {
  const value = params.weights[index];
  if (value === undefined) {
    throw new Error(`FSRS weight w${index} is missing`);
  }
  return value;
}

function clampDifficulty(d: number): number {
  return Math.min(10, Math.max(1, d));
}

function clampStability(s: number): number {
  return Math.max(0.01, s);
}

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

export function initialStability(rating: Rating, params: FsrsParams = DEFAULT_FSRS_PARAMS): number {
  return clampStability(w(params, rating - 1));
}

export function initialDifficulty(rating: Rating, params: FsrsParams = DEFAULT_FSRS_PARAMS): number {
  return clampDifficulty(w(params, 4) - Math.exp(w(params, 5) * (rating - 1)) + 1);
}

export function nextDifficulty(d: number, rating: Rating, params: FsrsParams): number {
  const delta = -w(params, 6) * (rating - 3);
  // FSRS-5 linear damping: changes shrink as difficulty approaches 10.
  const damped = d + (delta * (10 - d)) / 9;
  // Mean reversion towards the initial difficulty of an Easy rating.
  const reverted = w(params, 7) * initialDifficulty(4, params) + (1 - w(params, 7)) * damped;
  return clampDifficulty(reverted);
}

function recallStability(d: number, s: number, r: number, rating: Rating, params: FsrsParams): number {
  const hardPenalty = rating === 2 ? w(params, 15) : 1;
  const easyBonus = rating === 4 ? w(params, 16) : 1;
  return clampStability(
    s *
      (1 +
        Math.exp(w(params, 8)) *
          (11 - d) *
          Math.pow(s, -w(params, 9)) *
          (Math.exp((1 - r) * w(params, 10)) - 1) *
          hardPenalty *
          easyBonus),
  );
}

function forgetStability(d: number, s: number, r: number, params: FsrsParams): number {
  const value =
    w(params, 11) *
    Math.pow(d, -w(params, 12)) *
    (Math.pow(s + 1, w(params, 13)) - 1) *
    Math.exp((1 - r) * w(params, 14));
  return clampStability(Math.min(value, s));
}

function shortTermStability(s: number, rating: Rating, params: FsrsParams): number {
  return clampStability(s * Math.exp(w(params, 17) * (rating - 3 + w(params, 18))));
}

export function nextIntervalDays(stability: number, params: FsrsParams = DEFAULT_FSRS_PARAMS): number {
  const raw = (stability / FACTOR) * (Math.pow(params.requestRetention, 1 / DECAY) - 1);
  return Math.min(params.maximumIntervalDays, Math.max(1, Math.round(raw)));
}

function graduate(card: FsrsCard, now: number, intervalDays: number): SchedulingResult {
  const intervalMs = intervalDays * DAY_MS;
  return { card: { ...card, state: 'review', dueAt: now + intervalMs }, retrievability: null, intervalMs };
}

function step(card: FsrsCard, now: number, state: FsrsState, minutes: number): SchedulingResult {
  const intervalMs = minutes * MINUTE;
  return { card: { ...card, state, dueAt: now + intervalMs }, retrievability: null, intervalMs };
}

/**
 * Computes the outcome of every rating for a card. Review-state intervals are
 * kept ordered so that Hard ≤ Good < Easy, as in the reference implementation.
 */
export function scheduleAll(
  card: FsrsCard,
  now: number,
  params: FsrsParams = DEFAULT_FSRS_PARAMS,
): Record<Rating, SchedulingResult> {
  const ratings: Rating[] = [1, 2, 3, 4];
  const results = {} as Record<Rating, SchedulingResult>;
  for (const rating of ratings) {
    results[rating] = scheduleOne(card, rating, now, params);
  }

  if (card.state === 'review') {
    const hard = results[2];
    const good = results[3];
    const easy = results[4];
    const hardDays = Math.round(hard.intervalMs / DAY_MS);
    let goodDays = Math.round(good.intervalMs / DAY_MS);
    let easyDays = Math.round(easy.intervalMs / DAY_MS);
    const cappedHard = Math.min(hardDays, goodDays);
    goodDays = Math.max(goodDays, cappedHard + 1);
    easyDays = Math.max(easyDays, goodDays + 1);
    results[2] = withInterval(hard, now, Math.min(cappedHard, params.maximumIntervalDays));
    results[3] = withInterval(good, now, Math.min(goodDays, params.maximumIntervalDays));
    results[4] = withInterval(easy, now, Math.min(easyDays, params.maximumIntervalDays));
  }
  return results;
}

function withInterval(result: SchedulingResult, now: number, days: number): SchedulingResult {
  const intervalMs = days * DAY_MS;
  return { ...result, intervalMs, card: { ...result.card, dueAt: now + intervalMs } };
}

export function schedule(
  card: FsrsCard,
  rating: Rating,
  now: number,
  params: FsrsParams = DEFAULT_FSRS_PARAMS,
): SchedulingResult {
  return scheduleAll(card, now, params)[rating];
}

function scheduleOne(card: FsrsCard, rating: Rating, now: number, params: FsrsParams): SchedulingResult {
  const steps = params.learningStepsMinutes;

  if (card.state === 'new' || card.lastReviewedAt === null) {
    const next: FsrsCard = {
      ...card,
      stability: initialStability(rating, params),
      difficulty: initialDifficulty(rating, params),
      reps: 1,
      lastReviewedAt: now,
    };
    if (rating === 4) return graduate(next, now, nextIntervalDays(next.stability, params));
    const minutes = rating === 1 ? steps.again : rating === 2 ? steps.hard : steps.good;
    return step(next, now, 'learning', minutes);
  }

  const elapsedDays = Math.max(0, (now - card.lastReviewedAt) / DAY_MS);
  const r = retrievability(elapsedDays, card.stability);
  const difficulty = nextDifficulty(card.difficulty, rating, params);
  const sameDay = elapsedDays < 1;

  let stability: number;
  if (sameDay) {
    stability = shortTermStability(card.stability, rating, params);
  } else if (rating === 1) {
    stability = forgetStability(card.difficulty, card.stability, r, params);
  } else {
    stability = recallStability(card.difficulty, card.stability, r, rating, params);
  }

  const base: FsrsCard = { ...card, stability, difficulty, reps: card.reps + 1, lastReviewedAt: now };
  let result: SchedulingResult;

  if (card.state === 'review') {
    if (rating === 1) {
      result = step({ ...base, lapses: card.lapses + 1 }, now, 'relearning', params.relearningStepMinutes);
    } else {
      result = graduate(base, now, nextIntervalDays(stability, params));
    }
  } else {
    // learning or relearning
    if (rating === 1) {
      result = step(base, now, card.state, steps.again);
    } else if (rating === 2) {
      result = step(base, now, card.state, steps.good);
    } else {
      result = graduate(base, now, nextIntervalDays(stability, params));
    }
  }
  return { ...result, retrievability: r };
}
