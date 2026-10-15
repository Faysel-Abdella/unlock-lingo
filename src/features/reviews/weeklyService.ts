import { generateQuiz } from '@/features/learning/domain/exercises';
import { createSession } from '@/features/learning/domain/session';
import { type PreparedSession, getStreak } from '@/features/learning/learningService';
import type { AppSettings, UserProfile } from '@/features/settings/schema';
import type { Repositories } from '@/repositories';
import type { WeeklySnapshot } from '@/repositories/weeklyRepository';
import type { LearningItem, LearningStatus } from '@/types/learning';
import { type DateKey, addDays, parseDateKey, toDateKey } from '@/utils/date';
import { createRng } from '@/utils/random';

import {
  type ItemSnapshot,
  type ReviewDay,
  type WeekWindow,
  type WeeklyCandidate,
  type WeeklyStats,
  computeWeeklyStats,
  isWeeklyReviewDue,
  reviewWeek,
  selectWeeklyQuiz,
} from './domain/weekly';

export interface WeeklyReview {
  stats: WeeklyStats;
  due: boolean;
  /** Present once this week's review has been completed. */
  completed: WeeklySnapshot | null;
  quizItemIds: string[];
}

const STATUSES: readonly LearningStatus[] = ['new', 'learning', 'reviewing', 'mastered', 'difficult'];

function toStatus(value: string | null): LearningStatus {
  return (STATUSES as readonly string[]).includes(value ?? '') ? (value as LearningStatus) : 'new';
}

function label(item: LearningItem): string {
  return item.type === 'vocabulary' ? item.word : item.type === 'phrase' ? item.phrase : item.rule;
}

function weekBounds(week: WeekWindow): { from: number; to: number } {
  const from = parseDateKey(week.start).getTime();
  const to = parseDateKey(addDays(week.end, 1)).getTime() - 1;
  return { from, to };
}

/** Loads the weekly review for the week ending on the latest review day. */
export async function loadWeeklyReview(
  repos: Repositories,
  profile: UserProfile,
  settings: AppSettings,
  now: number,
): Promise<WeeklyReview> {
  const today = toDateKey(now);
  const week = reviewWeek(today, settings.weeklyReviewDay as ReviewDay);
  const { from, to } = weekBounds(week);

  const [answers, days, streak, completed, latest] = await Promise.all([
    repos.weekly.answersBetween(profile.targetLanguage, from, to),
    repos.activity.getRange(week.start, week.end),
    getStreak(repos, today),
    repos.weekly.getSnapshot(week.start),
    repos.weekly.listSnapshots(1),
  ]);

  const ids = [...new Set(answers.map((a) => a.itemId))];
  const loaded = await repos.content.getItems(ids);
  const statusById = new Map(answers.map((a) => [a.itemId, toStatus(a.status)]));
  const items = new Map<string, ItemSnapshot>(
    loaded.map((item) => [item.id, { itemId: item.id, label: label(item), type: item.type, status: statusById.get(item.id) ?? 'new' }]),
  );

  const stats = computeWeeklyStats({
    week,
    answers,
    items,
    activeDays: days.filter((d) => d.interactions > 0).length,
    streak: streak.current,
  });

  const candidates = new Map<string, WeeklyCandidate>();
  for (const a of answers) {
    const c = candidates.get(a.itemId) ?? {
      itemId: a.itemId,
      status: toStatus(a.status),
      incorrectThisWeek: 0,
      firstSeenThisWeek: false,
      lapses: a.lapses,
    };
    if (a.scored && !a.correct) c.incorrectThisWeek += 1;
    if (a.firstEver) c.firstSeenThisWeek = true;
    candidates.set(a.itemId, c);
  }

  const lastCompletedEnd: DateKey | null = latest[0]?.week.end ?? null;
  return {
    stats,
    due: isWeeklyReviewDue(today, settings.weeklyReviewDay as ReviewDay, lastCompletedEnd, answers.length > 0),
    completed,
    quizItemIds: selectWeeklyQuiz([...candidates.values()]),
  };
}

/** Builds a quiz-only session from the weekly selection. */
export async function prepareWeeklySession(
  repos: Repositories,
  profile: UserProfile,
  itemIds: readonly string[],
): Promise<PreparedSession> {
  const language = profile.targetLanguage;
  const [loaded, vocabPool, phrasePool, candidates] = await Promise.all([
    repos.content.getItems(itemIds),
    repos.content.getExercisePool(language, 'vocabulary'),
    repos.content.getExercisePool(language, 'phrase'),
    repos.progress.getQueueCandidates(language),
  ]);
  const items: Record<string, LearningItem> = {};
  for (const item of loaded) items[item.id] = item;
  const pool = [...vocabPool, ...phrasePool, ...loaded];
  const probe = createRng(1);
  const canQuiz = (id: string) => {
    const item = items[id];
    return !!item && generateQuiz(item, { pool, nativeLanguage: profile.nativeLanguage, rng: probe }) !== null;
  };
  return {
    state: createSession(
      loaded.map((item) => ({ itemId: item.id, reason: 'difficult' as const })),
      canQuiz,
    ),
    items,
    pool,
    lastExerciseTypes: Object.fromEntries(await repos.progress.getLastExerciseTypes(itemIds)),
    personalItemIds: candidates.filter((c) => c.personal !== null).map((c) => c.itemId),
  };
}

/** Saves the completed review so it is not offered again and appears in history. */
export async function completeWeeklyReview(
  repos: Repositories,
  stats: WeeklyStats,
  quiz: { questions: number; correct: number },
  now: number,
): Promise<WeeklySnapshot> {
  const snapshot: WeeklySnapshot = {
    week: stats.week,
    wordsEncountered: stats.wordsEncountered,
    newWordsLearned: stats.newWordsLearned,
    wordsReviewed: stats.wordsReviewed,
    grammarCompleted: stats.grammarCompleted,
    accuracy: stats.accuracy,
    activeDays: stats.activeDays,
    streak: stats.streak,
    quiz,
    completedAt: now,
  };
  await repos.weekly.saveSnapshot(snapshot, now);
  return snapshot;
}
