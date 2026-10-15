import { type CefrLevel, cefrAt, cefrIndex } from '@/types/language';

export interface LevelAccuracy {
  level: CefrLevel;
  reviews: number;
  correct: number;
}

export const LEVEL_MIN_REVIEWS = 30;
export const LEVEL_PROMOTE_ACCURACY = 0.85;
export const LEVEL_FALLBACK_ACCURACY = 0.6;
/** Share of the level below while struggling. */
export const FALLBACK_SHARE = 0.3;

/** Share of new material from the next level, growing with accuracy at the current level. */
export function nextLevelShare(accuracy: number): number {
  if (accuracy >= 0.95) return 0.5;
  if (accuracy >= 0.9) return 0.4;
  if (accuracy >= LEVEL_PROMOTE_ACCURACY) return 0.25;
  return 0;
}

export interface LevelPolicy {
  /** Levels new items may come from, most preferred first. */
  allowedLevels: CefrLevel[];
  /**
   * Share of new items per level (sums to 1). The next level is mixed in
   * gradually, growing with accuracy, rather than only once the current level
   * runs out.
   */
  shares: Partial<Record<CefrLevel, number>>;
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
  const shares: Partial<Record<CefrLevel, number>> = { [current]: 1 };
  let suggestedLevel: CefrLevel | null = null;

  if (accuracy !== null && accuracy >= LEVEL_PROMOTE_ACCURACY && currentIdx < targetIdx) {
    const next = cefrAt(currentIdx + 1);
    const share = nextLevelShare(accuracy);
    allowed.push(next);
    shares[current] = 1 - share;
    shares[next] = share;
    const nextAccuracy = accuracyFor(stats, next);
    if (nextAccuracy !== null && nextAccuracy >= LEVEL_PROMOTE_ACCURACY) suggestedLevel = next;
  } else if (accuracy !== null && accuracy < LEVEL_FALLBACK_ACCURACY && currentIdx > 0) {
    const below = cefrAt(currentIdx - 1);
    allowed.push(below);
    shares[current] = 1 - FALLBACK_SHARE;
    shares[below] = FALLBACK_SHARE;
  }

  return { allowedLevels: allowed, shares, suggestedLevel };
}
