import { buildQueue } from '@/features/learning/domain/queue';
import { type ChoiceQuestion, generateQuiz } from '@/features/learning/domain/exercises';
import { getLevelPolicy } from '@/features/learning/learningService';
import type { UserProfile } from '@/features/settings/schema';
import type { NativeAlarmEvent, NativeAlarmSpec } from '@/native/alarmClock';
import type { Repositories } from '@/repositories';
import type { LearningItem } from '@/types/learning';
import { toDateKey } from '@/utils/date';
import { type Rng, shuffle } from '@/utils/random';

import { questionBudget } from './domain/challenge';
import { daysToMask } from './domain/schedule';
import { type Alarm, effectiveChallengeTypes } from './domain/types';

/** The parts of the native bridge this service needs; injected so it can be tested. */
export interface AlarmBridge {
  setAlarms(specs: NativeAlarmSpec[]): Promise<Record<string, number | null>>;
  consumeEvents(): NativeAlarmEvent[];
}

export function toNativeSpec(alarm: Alarm): NativeAlarmSpec {
  return {
    id: alarm.id,
    label: alarm.label,
    hour: alarm.hour,
    minute: alarm.minute,
    daysMask: daysToMask(alarm.days),
    enabled: alarm.enabled,
    vibrate: alarm.vibrate,
    snoozeEnabled: alarm.snoozeEnabled,
    snoozeMinutes: alarm.snoozeMinutes,
    maxSnoozes: alarm.maxSnoozes,
    soundUri: alarm.sound?.uri ?? null,
    gradualVolume: alarm.gradualVolume,
  };
}

/**
 * Imports native outcome events into SQLite. Runs before every sync so that a
 * one-time alarm the OS already disabled is not re-enabled by a stale copy.
 */
export async function importNativeEvents(repos: Repositories, events: readonly NativeAlarmEvent[]): Promise<void> {
  for (const event of events) {
    switch (event.type) {
      case 'fired': {
        const open = await repos.alarms.findOpenEntry(event.alarmId);
        // A snoozed alarm ringing again continues the same history entry.
        if (!open || (event.snoozeCount ?? 0) === 0) await repos.alarms.recordFired(event.alarmId, event.at);
        break;
      }
      case 'snoozed': {
        const open = await repos.alarms.findOpenEntry(event.alarmId);
        if (open) await repos.alarms.recordSnoozed(open.id);
        break;
      }
      case 'stopped': {
        const open = await repos.alarms.findOpenEntry(event.alarmId);
        if (open) await repos.alarms.closeEntry(open.id, event.at, event.method);
        break;
      }
      case 'disabled':
        if (await repos.alarms.get(event.alarmId)) await repos.alarms.setEnabled(event.alarmId, false, event.at);
        break;
    }
  }
}

/** Pushes every alarm to the native scheduler. Returns next trigger times by alarm id. */
export async function syncAlarms(repos: Repositories, bridge: AlarmBridge): Promise<Record<string, number | null>> {
  await importNativeEvents(repos, bridge.consumeEvents());
  const alarms = await repos.alarms.list();
  return bridge.setAlarms(alarms.map(toNativeSpec));
}

export interface AlarmChallengeContent {
  questions: ChoiceQuestion[];
  items: Record<string, LearningItem>;
}

/**
 * Builds questions for a ringing alarm from the learning engine: due and
 * difficult items first, topped up from the learner's level so there are
 * always enough questions to absorb mistakes. Only quizzable items are used,
 * restricted to the alarm's challenge types.
 */
export async function prepareAlarmChallenge(
  repos: Repositories,
  profile: UserProfile,
  alarm: Pick<Alarm, 'questionCount' | 'challengeTypes'>,
  now: number,
  rng: Rng,
): Promise<AlarmChallengeContent> {
  const language = profile.targetLanguage;
  const budget = questionBudget(alarm.questionCount);
  const allowedTypes = effectiveChallengeTypes(alarm);
  const [candidates, policy] = await Promise.all([
    repos.progress.getQueueCandidates(language),
    getLevelPolicy(repos, profile, now),
  ]);

  const reviews = buildQueue(candidates, {
    now,
    size: budget,
    newItemsRemainingToday: 0,
    allowedLevels: policy.allowedLevels,
    levelShares: policy.shares,
    interests: profile.interests,
    // Being woken up is not "extra practice": allow recently seen difficult items too.
    extraPracticeGapMs: 0,
  }).map((e) => e.itemId);

  const fillers = shuffle(
    candidates.filter((c) => !reviews.includes(c.itemId) && policy.allowedLevels.includes(c.cefrLevel)),
    rng,
  ).map((c) => c.itemId);

  const ids = [...reviews, ...fillers].slice(0, budget * 2);
  const [loaded, vocabPool, phrasePool] = await Promise.all([
    repos.content.getItems(ids),
    repos.content.getExercisePool(language, 'vocabulary'),
    repos.content.getExercisePool(language, 'phrase'),
  ]);
  const pool = [...vocabPool, ...phrasePool];

  const items: Record<string, LearningItem> = {};
  const questions: ChoiceQuestion[] = [];
  for (const item of loaded) {
    if (questions.length >= budget) break;
    const question = generateQuiz(item, { pool, nativeLanguage: profile.nativeLanguage, rng, allowedTypes });
    if (!question) continue;
    items[item.id] = item;
    questions.push(question);
  }
  return { questions, items };
}

export interface ChallengeAnswer {
  question: ChoiceQuestion;
  item: LearningItem;
  correct: boolean;
  responseMs: number;
}

/** Records an alarm answer in the learning engine (context "alarm"). */
export async function recordAlarmAnswer(repos: Repositories, answer: ChallengeAnswer, now: number): Promise<void> {
  await repos.progress.recordReview({
    itemId: answer.item.id,
    itemType: answer.item.type,
    exerciseType: answer.question.exerciseType,
    outcome: { kind: 'quiz', correct: answer.correct, responseMs: answer.responseMs },
    context: 'alarm',
    now,
  });
}

/** Stores the question tally on the open history entry once the challenge resolves. */
export async function recordChallengeResult(
  repos: Repositories,
  bridge: AlarmBridge,
  alarmId: string,
  answered: number,
  correct: number,
  now: number,
): Promise<void> {
  await importNativeEvents(repos, bridge.consumeEvents());
  const open = await repos.alarms.findOpenEntry(alarmId);
  if (open) await repos.alarms.setQuestionCounts(open.id, answered, correct);
  await repos.activity.increment(toDateKey(now), { alarmChallenges: 1 }, now);
}
