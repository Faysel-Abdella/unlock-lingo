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

function isNew(c: QueueCandidate): boolean {
  return c.progress === null || c.progress.reps === 0;
}

function isDue(c: QueueCandidate, now: number): boolean {
  return !isNew(c) && c.progress !== null && c.progress.dueAt !== null && c.progress.dueAt <= now;
}

function isDifficult(c: QueueCandidate): boolean {
  return c.progress?.status === 'difficult' || c.personal?.isDifficult === true;
}

function hasFailedBefore(c: QueueCandidate): boolean {
  return (c.progress?.lapses ?? 0) > 0 || c.progress?.lastRating === 1 || (c.progress?.incorrectCount ?? 0) > 0;
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
    .filter((c) => !difficultIds.has(c.itemId) && hasFailedBefore(c))
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
  const news = fresh.slice(0, newTake).map((c) => ({ itemId: c.itemId, reason: 'new' as const }));
  return interleave(reviews, news);
}

/** Number of reviews currently due, used for dashboard counts and backlog gating. */
export function countDue(candidates: readonly QueueCandidate[], now: number): number {
  return candidates.filter((c) => !c.personal?.isMastered && isDue(c, now)).length;
}
