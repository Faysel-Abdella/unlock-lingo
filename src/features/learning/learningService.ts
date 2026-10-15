import type { Repositories } from '@/repositories';
import type { LevelTotals } from '@/repositories/contentRepository';
import type { PronunciationStats } from '@/repositories/pronunciationRepository';
import type { AppSettings, UserProfile } from '@/features/settings/schema';
import type { LearningItem, LearningStatus } from '@/types/learning';
import { type DateKey, addDays, toDateKey } from '@/utils/date';

import { DAY_MS } from './domain/fsrs';
import { computeLevelPolicy, type LevelAccuracy, type LevelPolicy } from './domain/levelPolicy';
import { buildQueue, countDue, type QueueCandidate } from './domain/queue';
import { effectiveStatus } from './domain/review';
import { createSession, type SessionState } from './domain/session';
import { computeStreak, type DailyActivity, type StreakInfo, sumActivity } from './domain/stats';
import { generateQuiz } from './domain/exercises';
import { createRng } from '@/utils/random';

/** Window used to judge accuracy for smart difficulty. */
const LEVEL_WINDOW_MS = 30 * DAY_MS;

export interface DashboardData {
  today: DailyActivity;
  dailyGoal: number;
  dueCount: number;
  newRemainingToday: number;
  streak: StreakInfo;
  statusCounts: Record<LearningStatus, number>;
  difficultCount: number;
  levelPolicy: LevelPolicy;
}

export function countStatuses(candidates: readonly QueueCandidate[]): Record<LearningStatus, number> {
  const counts: Record<LearningStatus, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0, difficult: 0 };
  for (const c of candidates) counts[effectiveStatus(c.progress?.status ?? 'new', c.personal)]++;
  return counts;
}

export async function getLevelPolicy(repos: Repositories, profile: UserProfile, now: number): Promise<LevelPolicy> {
  const stats = await repos.progress.getLevelAccuracy(profile.targetLanguage, now - LEVEL_WINDOW_MS);
  return computeLevelPolicy(profile.currentLevel, profile.targetLevel, stats);
}

export async function getStreak(repos: Repositories, today: DateKey): Promise<StreakInfo> {
  return computeStreak(await repos.activity.getActiveDays(), today);
}

export async function loadDashboard(
  repos: Repositories,
  profile: UserProfile,
  settings: AppSettings,
  now: number,
): Promise<DashboardData> {
  const today = toDateKey(now);
  const [candidates, day, streak, levelPolicy] = await Promise.all([
    repos.progress.getQueueCandidates(profile.targetLanguage),
    repos.activity.getDay(today),
    getStreak(repos, today),
    getLevelPolicy(repos, profile, now),
  ]);
  const statusCounts = countStatuses(candidates);
  return {
    today: day,
    dailyGoal: settings.dailyGoal,
    dueCount: countDue(candidates, now),
    newRemainingToday: Math.max(0, settings.newItemsPerDay - day.newItems),
    streak,
    statusCounts,
    difficultCount: statusCounts.difficult,
    levelPolicy,
  };
}

export interface PreparedSession {
  state: SessionState;
  items: Record<string, LearningItem>;
  /** Distractor sources for exercise generation. */
  pool: LearningItem[];
  lastExerciseTypes: Record<string, string>;
  /** Items already in My Words, so the card can show them as saved. */
  personalItemIds: string[];
}

/**
 * Builds a "Today's learning" session: picks items with the queue policy, loads
 * their content and a distractor pool, and lays out intro/quiz steps.
 */
export async function prepareSession(
  repos: Repositories,
  profile: UserProfile,
  settings: AppSettings,
  now: number,
  size: number = settings.sessionSize,
): Promise<PreparedSession> {
  const language = profile.targetLanguage;
  const [candidates, day, levelPolicy] = await Promise.all([
    repos.progress.getQueueCandidates(language),
    repos.activity.getDay(toDateKey(now)),
    getLevelPolicy(repos, profile, now),
  ]);

  const queue = buildQueue(candidates, {
    now,
    size,
    newItemsRemainingToday: Math.max(0, settings.newItemsPerDay - day.newItems),
    allowedLevels: levelPolicy.allowedLevels,
    levelShares: levelPolicy.shares,
    interests: profile.interests,
  });

  const ids = queue.map((e) => e.itemId);
  const [loaded, vocabPool, phrasePool, lastTypes] = await Promise.all([
    repos.content.getItems(ids),
    repos.content.getExercisePool(language, 'vocabulary'),
    repos.content.getExercisePool(language, 'phrase'),
    repos.progress.getLastExerciseTypes(ids),
  ]);
  const items: Record<string, LearningItem> = {};
  for (const item of loaded) items[item.id] = item;
  const pool = [...vocabPool, ...phrasePool, ...loaded];

  // Probe with a fixed seed: whether *some* quiz can be built does not depend on randomness.
  const probe = createRng(1);
  const canQuiz = (id: string) => {
    const item = items[id];
    return !!item && generateQuiz(item, { pool, nativeLanguage: profile.nativeLanguage, rng: probe }) !== null;
  };

  return {
    state: createSession(
      queue.filter((e) => items[e.itemId]),
      canQuiz,
    ),
    items,
    pool,
    lastExerciseTypes: Object.fromEntries(lastTypes),
    personalItemIds: candidates.filter((c) => c.personal !== null).map((c) => c.itemId),
  };
}

export interface WeekSummary {
  days: DailyActivity[];
}

export async function loadWeek(repos: Repositories, now: number): Promise<WeekSummary> {
  const today = toDateKey(now);
  return { days: await repos.activity.getRange(addDays(today, -6), today) };
}

export interface ProgressOverview {
  week: DailyActivity[];
  weekTotals: ReturnType<typeof sumActivity>;
  statusCounts: Record<LearningStatus, number>;
  streak: StreakInfo;
  levels: LevelTotals[];
  /** Quiz accuracy per level over the smart-difficulty window. */
  levelAccuracy: LevelAccuracy[];
  levelPolicy: LevelPolicy;
  /** Speaking practice over the smart-difficulty window. */
  speaking: PronunciationStats;
  difficultItems: { id: string; label: string }[];
}

function itemLabel(item: LearningItem): string {
  if (item.type === 'vocabulary') return item.word;
  if (item.type === 'phrase') return item.phrase;
  return item.rule;
}

export async function loadProgressOverview(
  repos: Repositories,
  profile: UserProfile,
  now: number,
): Promise<ProgressOverview> {
  const today = toDateKey(now);
  const [week, candidates, streak, levels, levelAccuracy, speaking] = await Promise.all([
    repos.activity.getRange(addDays(today, -6), today),
    repos.progress.getQueueCandidates(profile.targetLanguage),
    getStreak(repos, today),
    repos.content.levelTotals(profile.targetLanguage),
    repos.progress.getLevelAccuracy(profile.targetLanguage, now - LEVEL_WINDOW_MS),
    repos.pronunciation.stats(profile.targetLanguage, now - LEVEL_WINDOW_MS),
  ]);
  const difficultIds = candidates
    .filter((c) => effectiveStatus(c.progress?.status ?? 'new', c.personal) === 'difficult')
    .sort((a, b) => (b.progress?.lapses ?? 0) - (a.progress?.lapses ?? 0))
    .slice(0, 8)
    .map((c) => c.itemId);
  const difficultItems = (await repos.content.getItems(difficultIds)).map((item) => ({
    id: item.id,
    label: itemLabel(item),
  }));
  return {
    week,
    weekTotals: sumActivity(week),
    statusCounts: countStatuses(candidates),
    streak,
    levels,
    levelAccuracy,
    levelPolicy: computeLevelPolicy(profile.currentLevel, profile.targetLevel, levelAccuracy),
    speaking,
    difficultItems,
  };
}
