import type { CefrLevel } from '@/types/language';
import type { LearningItemType, LearningProgress, PersonalWordFlags } from '@/types/learning';

import { DAY_MS, retrievability } from './fsrs';

export interface QueueCandidate {
  itemId: string;
  type: LearningItemType;
  cefrLevel: CefrLevel;
  tags: readonly string[];
  /** Content difficulty 1–10. */
  contentDifficulty: number;
  progress: LearningProgress | null;
  personal: PersonalWordFlags | null;
}

export type QueueReason = 'due' | 'difficult' | 'failed' | 'new';

export interface QueueEntry {
  itemId: string;
  reason: QueueReason;
}

export interface QueueOptions {
  now: number;
  size: number;
  /** New items the learner may still be introduced to today. */
  newItemsRemainingToday: number;
  /** Levels new seed content may come from, preferred first. Personal words ignore this. */
  allowedLevels: readonly CefrLevel[];
  /**
   * Optional share of new items per level (from the level policy). When given,
   * levels are mixed by share instead of exhausting the first level first.
   */
  levelShares?: Partial<Record<CefrLevel, number>>;
  interests: readonly string[];
  /** Maximum share of a session given to new items when reviews exist. */
  maxNewRatio?: number;
  /** With at least this many overdue reviews, no new items are introduced. */
  backlogLimit?: number;
  /** Non-due extra practice is only offered if the item was not seen recently. */
  extraPracticeGapMs?: number;
  excludeItemIds?: ReadonlySet<string>;
}

export const DEFAULT_MAX_NEW_RATIO = 0.3;
export const DEFAULT_BACKLOG_LIMIT = 15;
export const DEFAULT_EXTRA_PRACTICE_GAP_MS = 4 * 60 * 60 * 1000;
/**
 * Share of new items per type. Without it, ranking by interest and content
 * difficulty lets one type (e.g. easy, broadly tagged grammar) fill every slot.
 */
export const NEW_TYPE_SHARES: Readonly<Record<LearningItemType, number>> = {
  vocabulary: 0.6,
  phrase: 0.2,
  grammar: 0.2,
};

function isNew(c: QueueCandidate): boolean {
  return c.progress === null || c.progress.reps === 0;
}

function isDue(c: QueueCandidate, now: number): boolean {
  return !isNew(c) && c.progress !== null && c.progress.dueAt !== null && c.progress.dueAt <= now;
}

function isDifficult(c: QueueCandidate): boolean {
  return c.progress?.status === 'difficult' || c.personal?.isDifficult === true;
}

/** A correct streak this long means a past failure has been overcome. */
export const RECOVERED_STREAK = 2;

/**
 * Previously failed and not yet recovered. Items failed long ago but answered
 * correctly since are not offered as extra practice (no unnecessarily easy material).
 */
function needsFailurePractice(c: QueueCandidate): boolean {
  const p = c.progress;
  if (!p) return false;
  const failed = p.lapses > 0 || p.lastRating === 1 || p.incorrectCount > 0;
  return failed && (p.lastRating === 1 || p.streak < RECOVERED_STREAK);
}

function seenRecently(c: QueueCandidate, now: number, gapMs: number): boolean {
  const last = c.progress?.lastReviewedAt;
  return last !== null && last !== undefined && now - last < gapMs;
}

/** Lower is more urgent. Personal and important words get a boost. */
function dueUrgency(c: QueueCandidate, now: number): number {
  const p = c.progress as LearningProgress;
  // Short-term learning steps come first: they depend on working memory.
  if (p.fsrsState === 'learning' || p.fsrsState === 'relearning') return -1;
  const elapsedDays = p.lastReviewedAt === null ? 0 : (now - p.lastReviewedAt) / DAY_MS;
  let score = retrievability(elapsedDays, p.stability);
  if (c.personal) score -= 0.1;
  if (c.personal?.isImportant) score -= 0.1;
  if (isDifficult(c)) score -= 0.05;
  return score;
}

function newItemRank(c: QueueCandidate, opts: QueueOptions): number[] {
  const personalRank = c.personal ? (c.personal.isImportant ? 0 : 1) : 2;
  const levelIdx = opts.allowedLevels.indexOf(c.cefrLevel);
  const levelRank = c.personal ? 0 : levelIdx === -1 ? 99 : levelIdx;
  const interestMatches = c.tags.filter((t) => opts.interests.includes(t)).length;
  return [personalRank, levelRank, -interestMatches, c.contentDifficulty];
}

function compareRanks(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Spreads `inserts` evenly through `base`. A base item (a review) always comes first. */
function interleave<T>(base: T[], inserts: T[]): T[] {
  if (inserts.length === 0) return base;
  if (base.length === 0) return inserts;
  const result: T[] = [];
  const gap = (base.length + inserts.length) / inserts.length;
  const insertPosition = (n: number) => Math.max(1, Math.floor(gap / 2 + gap * n));
  let nextInsertAt = insertPosition(0);
  let b = 0;
  let i = 0;
  for (let pos = 0; pos < base.length + inserts.length; pos++) {
    if (i < inserts.length && (pos >= nextInsertAt || b >= base.length)) {
      result.push(inserts[i++] as T);
      nextInsertAt = insertPosition(i);
    } else {
      result.push(base[b++] as T);
    }
  }
  return result;
}

/**
 * Chooses what to study next.
 *
 * Priority: due reviews → difficult items → previously failed items → new items.
 * New material is rationed so that reviews of older material always come first:
 * none at all when the overdue backlog is large, and at most `maxNewRatio` of a
 * session while reviews are waiting. Once every pending review is included, new
 * items may fill the remaining slots up to the daily allowance.
 */
export function buildQueue(candidates: readonly QueueCandidate[], opts: QueueOptions): QueueEntry[] {
  const {
    now,
    size,
    maxNewRatio = DEFAULT_MAX_NEW_RATIO,
    backlogLimit = DEFAULT_BACKLOG_LIMIT,
    extraPracticeGapMs = DEFAULT_EXTRA_PRACTICE_GAP_MS,
  } = opts;
  if (size <= 0) return [];

  const eligible = candidates.filter(
    (c) => !c.personal?.isMastered && !opts.excludeItemIds?.has(c.itemId),
  );

  const due = eligible
    .filter((c) => isDue(c, now))
    .sort((a, b) => dueUrgency(a, now) - dueUrgency(b, now));

  const notDueReviewed = eligible.filter(
    (c) => !isNew(c) && !isDue(c, now) && !seenRecently(c, now, extraPracticeGapMs),
  );
  const difficult = notDueReviewed
    .filter(isDifficult)
    .sort((a, b) => (b.progress?.difficulty ?? 0) - (a.progress?.difficulty ?? 0));
  const difficultIds = new Set(difficult.map((c) => c.itemId));
  const failed = notDueReviewed
    .filter((c) => !difficultIds.has(c.itemId) && needsFailurePractice(c))
    .sort((a, b) => (a.progress?.lastReviewedAt ?? 0) - (b.progress?.lastReviewedAt ?? 0));

  const fresh = eligible
    .filter(isNew)
    .filter((c) => c.personal !== null || opts.allowedLevels.includes(c.cefrLevel))
    .sort((a, b) => compareRanks(newItemRank(a, opts), newItemRank(b, opts)));

  const reviewPool: QueueEntry[] = [
    ...due.map((c) => ({ itemId: c.itemId, reason: 'due' as const })),
    ...difficult.map((c) => ({ itemId: c.itemId, reason: 'difficult' as const })),
    ...failed.map((c) => ({ itemId: c.itemId, reason: 'failed' as const })),
  ];

  const newAllowance =
    due.length >= backlogLimit ? 0 : Math.max(0, Math.min(opts.newItemsRemainingToday, fresh.length));
  // Slots held back for new items when reviews compete for the session.
  const reservedNew =
    reviewPool.length > 0 ? Math.min(newAllowance, Math.max(1, Math.floor(size * maxNewRatio))) : newAllowance;

  const reviewTake = Math.min(reviewPool.length, size - Math.min(reservedNew, size));
  // Once every review is in, leftover slots may go to new items, within the daily allowance.
  const newTake = Math.min(newAllowance, size - reviewTake);

  const reviews = reviewPool.slice(0, reviewTake);
  const typeMixed = mixTypesWithinLevels(fresh);
  const orderedFresh = opts.levelShares ? mixByLevel(typeMixed, opts.levelShares) : typeMixed;
  const news = orderedFresh.slice(0, newTake).map((c) => ({ itemId: c.itemId, reason: 'new' as const }));
  return interleave(reviews, news);
}

/**
 * Reorders items so each key appears in proportion to its share, keeping the
 * order within each key: every slot goes to the key furthest behind its share
 * (largest-deficit rounding). Items whose key has no share are dropped.
 */
function mixByShare<T, K extends string>(
  items: readonly T[],
  keyOf: (item: T) => K,
  shares: Partial<Record<K, number>>,
): T[] {
  const pools = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!(shares[key] ?? 0)) continue;
    pools.set(key, [...(pools.get(key) ?? []), item]);
  }
  const taken = new Map<K, number>();
  const result: T[] = [];
  const total = [...pools.values()].reduce((n, p) => n + p.length, 0);
  for (let k = 1; result.length < total; k++) {
    let best: K | null = null;
    let bestDeficit = -Infinity;
    for (const [key, pool] of pools) {
      const used = taken.get(key) ?? 0;
      if (used >= pool.length) continue;
      const deficit = (shares[key] ?? 0) * k - used;
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        best = key;
      }
    }
    if (best === null) break;
    const used = taken.get(best) ?? 0;
    result.push((pools.get(best) as T[])[used] as T);
    taken.set(best, used + 1);
  }
  return result;
}

/**
 * Mixes item types (mostly vocabulary, some phrases and grammar) within each
 * level, keeping personal words first and levels in their ranked order.
 */
export function mixTypesWithinLevels(fresh: readonly QueueCandidate[]): QueueCandidate[] {
  const personal = fresh.filter((c) => c.personal !== null);
  const byLevel = new Map<CefrLevel, QueueCandidate[]>();
  for (const c of fresh) {
    if (c.personal !== null) continue;
    byLevel.set(c.cefrLevel, [...(byLevel.get(c.cefrLevel) ?? []), c]);
  }
  const mixed = [...byLevel.values()].flatMap((pool) => mixByShare(pool, (c) => c.type, NEW_TYPE_SHARES));
  return [...personal, ...mixed];
}

/**
 * Reorders new items so levels appear in proportion to their share: personal
 * words stay first, then each slot goes to the level furthest behind its share,
 * keeping each level's internal order.
 */
export function mixByLevel(
  fresh: readonly QueueCandidate[],
  shares: Partial<Record<CefrLevel, number>>,
): QueueCandidate[] {
  const personal = fresh.filter((c) => c.personal !== null);
  const seed = fresh.filter((c) => c.personal === null);
  return [...personal, ...mixByShare(seed, (c) => c.cefrLevel, shares)];
}

/** Number of reviews currently due, used for dashboard counts and backlog gating. */
export function countDue(candidates: readonly QueueCandidate[], now: number): number {
  return candidates.filter((c) => !c.personal?.isMastered && isDue(c, now)).length;
}
