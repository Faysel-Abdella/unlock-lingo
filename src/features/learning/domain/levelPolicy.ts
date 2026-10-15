import { type CefrLevel, cefrAt, cefrIndex } from '@/types/language';

export interface LevelAccuracy {
  level: CefrLevel;
  reviews: number;
  correct: number;
}

export const LEVEL_MIN_REVIEWS = 30;
export const LEVEL_PROMOTE_ACCURACY = 0.85;
export const LEVEL_FALLBACK_ACCURACY = 0.6;

export interface LevelPolicy {
  /** Levels new items may come from, most preferred first. */
  allowedLevels: CefrLevel[];
  /** Present when the learner has clearly outgrown their configured level. */
  suggestedLevel: CefrLevel | null;
}

function accuracyFor(stats: readonly LevelAccuracy[], level: CefrLevel): number | null {
  const entry = stats.find((s) => s.level === level);
  if (!entry || entry.reviews < LEVEL_MIN_REVIEWS) return null;
  return entry.correct / entry.reviews;
}

/**
 * Smart difficulty: decides which CEFR levels new material is drawn from.
 *
 * - Consistently strong at the current level → gradually mix in the next level.
 * - Consistently weak → also draw from the level below to rebuild confidence.
 * - Never exceeds the learner's target level.
 */
export function computeLevelPolicy(
  current: CefrLevel,
  target: CefrLevel,
  stats: readonly LevelAccuracy[],
): LevelPolicy {
  const currentIdx = cefrIndex(current);
  const targetIdx = Math.max(currentIdx, cefrIndex(target));
  const accuracy = accuracyFor(stats, current);
  const allowed: CefrLevel[] = [current];
  let suggestedLevel: CefrLevel | null = null;

  if (accuracy !== null && accuracy >= LEVEL_PROMOTE_ACCURACY && currentIdx < targetIdx) {
    const next = cefrAt(currentIdx + 1);
    allowed.push(next);
    const nextAccuracy = accuracyFor(stats, next);
    if (nextAccuracy !== null && nextAccuracy >= LEVEL_PROMOTE_ACCURACY) suggestedLevel = next;
  } else if (accuracy !== null && accuracy < LEVEL_FALLBACK_ACCURACY && currentIdx > 0) {
    allowed.push(cefrAt(currentIdx - 1));
  }

  return { allowedLevels: allowed, suggestedLevel };
}
