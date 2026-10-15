import { LEVEL_MIN_REVIEWS, type LevelAccuracy, type LevelPolicy } from '@/features/learning/domain/levelPolicy';
import type { DailyActivity } from '@/features/learning/domain/stats';
import { CEFR_LEVELS, type CefrLevel } from '@/types/language';
import { type DateKey, addDays, parseDateKey } from '@/utils/date';

/** Changes smaller than this read as "steady". */
export const TREND_THRESHOLD = 0.03;

export type Trend = 'up' | 'down' | 'steady';

export interface WeekSummary {
  week: { start: string; end: string };
  wordsEncountered: number;
  accuracy: number | null;
}

export interface WeekTrend<T extends WeekSummary> {
  snapshot: T;
  /** Accuracy change against the previous recorded week; null without both values. */
  accuracyTrend: Trend | null;
}

export function trendOf(delta: number | null, threshold = TREND_THRESHOLD): Trend | null {
  if (delta === null) return null;
  if (delta > threshold) return 'up';
  if (delta < -threshold) return 'down';
  return 'steady';
}

/** Annotates weekly snapshots (most recent first) with their accuracy trend. */
export function weeklyTrends<T extends WeekSummary>(snapshots: readonly T[]): WeekTrend<T>[] {
  return snapshots.map((snapshot, i) => {
    const previous = snapshots[i + 1];
    const delta =
      snapshot.accuracy !== null && previous?.accuracy != null ? snapshot.accuracy - previous.accuracy : null;
    return { snapshot, accuracyTrend: trendOf(delta) };
  });
}

/** "75% B1 · 25% B2": the CEFR mix new material is drawn from. */
export function describeLevelMix(shares: Partial<Record<CefrLevel, number>>): string {
  return CEFR_LEVELS.flatMap((level) => {
    const share = shares[level];
    return share && share > 0 ? [`${Math.round(share * 100)}% ${level}`] : [];
  }).join(' · ');
}

/** Recent accuracy for a level, or null until there is enough evidence for smart difficulty to use it. */
export function levelAccuracy(stats: readonly LevelAccuracy[], level: CefrLevel): { accuracy: number | null; reviews: number } {
  const entry = stats.find((s) => s.level === level);
  const reviews = entry?.reviews ?? 0;
  return { accuracy: entry && reviews > 0 ? entry.correct / reviews : null, reviews };
}

/** Reviews still needed at a level before smart difficulty acts on it. */
export function reviewsUntilAdaptive(reviews: number): number {
  return Math.max(0, LEVEL_MIN_REVIEWS - reviews);
}

export type DifficultyStatus =
  | { kind: 'suggest'; level: CefrLevel }
  | { kind: 'mixing' }
  | { kind: 'gathering'; level: CefrLevel; needed: number }
  | { kind: 'steady'; level: CefrLevel };

/** What smart difficulty is doing right now, for the learner-facing explanation. */
export function difficultyStatus(
  policy: Pick<LevelPolicy, 'shares' | 'suggestedLevel'>,
  stats: readonly LevelAccuracy[],
  currentLevel: CefrLevel,
): DifficultyStatus {
  if (policy.suggestedLevel) return { kind: 'suggest', level: policy.suggestedLevel };
  const mixed = Object.values(policy.shares).filter((share) => (share ?? 0) > 0).length > 1;
  if (mixed) return { kind: 'mixing' };
  const needed = reviewsUntilAdaptive(levelAccuracy(stats, currentLevel).reviews);
  return needed > 0 ? { kind: 'gathering', level: currentLevel, needed } : { kind: 'steady', level: currentLevel };
}

export const LONG_RANGE_WEEKS = 12;

export interface WeekBucket {
  /** Monday of the week. */
  start: DateKey;
  interactions: number;
  correct: number;
  incorrect: number;
  activeDays: number;
}

/** First day (a Monday) of the `weeks` calendar weeks ending with the week containing `today`. */
export function longRangeStart(today: DateKey, weeks: number): DateKey {
  const sinceMonday = (parseDateKey(today).getDay() + 6) % 7;
  return addDays(today, -sinceMonday - 7 * (weeks - 1));
}

/** Groups daily activity into Monday-based calendar weeks, oldest first; missing days count as empty. */
export function weeklyBuckets(days: readonly DailyActivity[], today: DateKey, weeks: number): WeekBucket[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = longRangeStart(today, weeks);
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(first, w * 7);
    const bucket: WeekBucket = { start, interactions: 0, correct: 0, incorrect: 0, activeDays: 0 };
    for (let i = 0; i < 7; i++) {
      const day = byDate.get(addDays(start, i));
      if (!day) continue;
      bucket.interactions += day.interactions;
      bucket.correct += day.correct;
      bucket.incorrect += day.incorrect;
      if (day.interactions > 0) bucket.activeDays += 1;
    }
    return bucket;
  });
}
