import { LEVEL_MIN_REVIEWS, type LevelAccuracy, type LevelPolicy } from '@/features/learning/domain/levelPolicy';
import { CEFR_LEVELS, type CefrLevel } from '@/types/language';

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
