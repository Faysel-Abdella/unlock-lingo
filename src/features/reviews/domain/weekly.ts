import type { LearningItemType, LearningStatus } from '@/types/learning';
import { type DateKey, addDays, parseDateKey } from '@/utils/date';

/** 0 = Sunday … 6 = Saturday, matching `Date#getDay()` and the setting. */
export type ReviewDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeekWindow {
  /** First day of the week under review (inclusive). */
  start: DateKey;
  /** The review day that closes the week (inclusive). */
  end: DateKey;
}

/** The week that ends on the most recent review day on or before `today`. */
export function reviewWeek(today: DateKey, reviewDay: ReviewDay): WeekWindow {
  const weekday = parseDateKey(today).getDay();
  const back = (weekday - reviewDay + 7) % 7;
  const end = addDays(today, -back);
  return { start: addDays(end, -6), end };
}

/**
 * The review for a week is offered from its review day until it is completed or
 * the next week's review replaces it. Weeks without any learning are skipped.
 */
export function isWeeklyReviewDue(
  today: DateKey,
  reviewDay: ReviewDay,
  lastCompletedWeekEnd: DateKey | null,
  hadActivity: boolean,
): boolean {
  if (!hadActivity) return false;
  const { end } = reviewWeek(today, reviewDay);
  return lastCompletedWeekEnd === null || lastCompletedWeekEnd < end;
}

/** One answer from review history, enriched with what the stats need. */
export interface WeekAnswer {
  itemId: string;
  itemType: LearningItemType;
  /** False for exposure-only answers (intro cards), which don't count towards accuracy. */
  scored: boolean;
  correct: boolean;
  /** True when this was the first answer ever recorded for the item. */
  firstEver: boolean;
}

export interface ItemSnapshot {
  itemId: string;
  label: string;
  type: LearningItemType;
  status: LearningStatus;
}

export interface WeeklyStats {
  week: WeekWindow;
  /** Distinct words and phrases seen this week. */
  wordsEncountered: number;
  newWordsLearned: number;
  wordsReviewed: number;
  grammarCompleted: number;
  accuracy: number | null;
  answers: number;
  activeDays: number;
  streak: number;
  mostDifficult: ItemSnapshot[];
  mastered: ItemSnapshot[];
}

const isWord = (type: LearningItemType) => type === 'vocabulary' || type === 'phrase';

export function computeWeeklyStats(input: {
  week: WeekWindow;
  answers: readonly WeekAnswer[];
  items: ReadonlyMap<string, ItemSnapshot>;
  activeDays: number;
  streak: number;
  limit?: number;
}): WeeklyStats {
  const { answers, items, limit = 5 } = input;
  const seen = new Set<string>();
  const learned = new Set<string>();
  const incorrect = new Map<string, number>();
  let grammarCompleted = 0;
  let scored = 0;
  let correct = 0;

  for (const a of answers) {
    if (isWord(a.itemType)) {
      seen.add(a.itemId);
      if (a.firstEver) learned.add(a.itemId);
    }
    if (a.itemType === 'grammar' && a.scored) grammarCompleted++;
    if (a.scored) {
      scored++;
      if (a.correct) correct++;
      else incorrect.set(a.itemId, (incorrect.get(a.itemId) ?? 0) + 1);
    }
  }

  const mostDifficult = [...incorrect.entries()]
    .sort((x, y) => y[1] - x[1])
    .flatMap(([id]) => items.get(id) ?? [])
    .slice(0, limit);
  const touched = new Set(answers.map((a) => a.itemId));
  const mastered = [...touched].flatMap((id) => {
    const item = items.get(id);
    return item?.status === 'mastered' ? [item] : [];
  });

  return {
    week: input.week,
    wordsEncountered: seen.size,
    newWordsLearned: learned.size,
    wordsReviewed: [...seen].filter((id) => !learned.has(id)).length,
    grammarCompleted,
    accuracy: scored === 0 ? null : correct / scored,
    answers: answers.length,
    activeDays: input.activeDays,
    streak: input.streak,
    mostDifficult,
    mastered: mastered.slice(0, limit),
  };
}

/** About 5–10 minutes at 20–35 seconds per question. */
export const WEEKLY_QUIZ_SIZE = 16;
/** Share of the quiz reserved for difficult and missed items. */
export const WEEKLY_DIFFICULT_SHARE = 0.6;

export interface WeeklyCandidate {
  itemId: string;
  status: LearningStatus;
  incorrectThisWeek: number;
  firstSeenThisWeek: boolean;
  lapses: number;
}

/**
 * Picks the weekly quiz: mostly difficult and missed items, then words first
 * learned this week, then anything else practised this week.
 */
export function selectWeeklyQuiz(candidates: readonly WeeklyCandidate[], size = WEEKLY_QUIZ_SIZE): string[] {
  const struggling = candidates
    .filter((c) => c.incorrectThisWeek > 0 || c.status === 'difficult')
    .sort((a, b) => b.incorrectThisWeek - a.incorrectThisWeek || b.lapses - a.lapses);
  const struggleIds = new Set(struggling.map((c) => c.itemId));
  const recent = candidates.filter((c) => c.firstSeenThisWeek && !struggleIds.has(c.itemId));
  const recentIds = new Set(recent.map((c) => c.itemId));
  const rest = candidates.filter((c) => !struggleIds.has(c.itemId) && !recentIds.has(c.itemId) && c.status !== 'mastered');

  const difficultSlots = Math.round(size * WEEKLY_DIFFICULT_SHARE);
  const picked = [...struggling.slice(0, difficultSlots), ...recent.slice(0, size - Math.min(difficultSlots, struggling.length))];
  // Fill any gap from the remaining pools in priority order.
  for (const pool of [struggling, recent, rest]) {
    for (const c of pool) {
      if (picked.length >= size) break;
      if (!picked.some((p) => p.itemId === c.itemId)) picked.push(c);
    }
  }
  return picked.slice(0, size).map((c) => c.itemId);
}
