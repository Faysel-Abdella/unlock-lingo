import type {
  ExerciseType,
  LearningProgress,
  LearningStatus,
  PersonalWordFlags,
  Rating,
  ReviewContext,
} from '@/types/learning';

import { DEFAULT_FSRS_PARAMS, type FsrsCard, type FsrsParams, NEW_CARD, schedule } from './fsrs';

/** Answers slower than this are treated as "Hard" even when correct. */
export const SLOW_ANSWER_MS = 12_000;
/** Mastered requires the item to be remembered for at least this many days. */
export const MASTERED_STABILITY_DAYS = 30;
export const MASTERED_MIN_STREAK = 3;
export const DIFFICULT_MIN_LAPSES = 3;
export const DIFFICULT_FSRS_DIFFICULTY = 8;
/** Weight of the latest answer in the confidence moving average. */
const CONFIDENCE_ALPHA = 0.3;

export type AnswerOutcome =
  | { kind: 'quiz'; correct: boolean; responseMs: number }
  /** Self-graded card (intro or unenriched personal word). */
  | { kind: 'self'; knewIt: boolean };

export function ratingForAnswer(outcome: AnswerOutcome): Rating {
  if (outcome.kind === 'self') return outcome.knewIt ? 3 : 1;
  if (!outcome.correct) return 1;
  return outcome.responseMs > SLOW_ANSWER_MS ? 2 : 3;
}

export function isCorrect(outcome: AnswerOutcome): boolean {
  return outcome.kind === 'quiz' ? outcome.correct : outcome.knewIt;
}

export function emptyProgress(itemId: string): LearningProgress {
  return {
    itemId,
    status: 'new',
    fsrsState: 'new',
    stability: 0,
    difficulty: 0,
    dueAt: null,
    lastReviewedAt: null,
    reps: 0,
    lapses: 0,
    seenCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    streak: 0,
    confidence: 0,
    lastRating: null,
  };
}

export function toFsrsCard(progress: LearningProgress | null): FsrsCard {
  if (!progress || progress.reps === 0) return NEW_CARD;
  return {
    state: progress.fsrsState,
    stability: progress.stability,
    difficulty: progress.difficulty,
    reps: progress.reps,
    lapses: progress.lapses,
    lastReviewedAt: progress.lastReviewedAt,
    dueAt: progress.dueAt,
  };
}

/**
 * Derives the user-facing status from scheduling state and answer history.
 * Personal-word flags are applied separately (see `effectiveStatus`).
 */
export function deriveStatus(p: LearningProgress): LearningStatus {
  if (p.reps === 0) return 'new';
  const answered = p.correctCount + p.incorrectCount;
  const failRatio = answered === 0 ? 0 : p.incorrectCount / answered;
  const struggling =
    p.lapses >= DIFFICULT_MIN_LAPSES ||
    p.difficulty >= DIFFICULT_FSRS_DIFFICULTY ||
    (p.incorrectCount >= 3 && failRatio >= 0.5);
  // A long correct streak means the learner has recovered, even if history was rough.
  if (struggling && p.streak < MASTERED_MIN_STREAK) return 'difficult';
  if (p.fsrsState === 'learning' || p.fsrsState === 'relearning') return 'learning';
  if (p.stability >= MASTERED_STABILITY_DAYS && p.streak >= MASTERED_MIN_STREAK) return 'mastered';
  return 'reviewing';
}

export function effectiveStatus(status: LearningStatus, flags: PersonalWordFlags | null): LearningStatus {
  if (!flags) return status;
  if (flags.isMastered) return 'mastered';
  if (flags.isDifficult && status !== 'new') return 'difficult';
  return status;
}

export interface ReviewInput {
  itemId: string;
  exerciseType: ExerciseType;
  outcome: AnswerOutcome;
  context: ReviewContext;
  now: number;
}

export interface ReviewRecord {
  itemId: string;
  exerciseType: ExerciseType;
  rating: Rating;
  correct: boolean;
  responseMs: number | null;
  context: ReviewContext;
  reviewedAt: number;
  stateBefore: LearningProgress['fsrsState'];
  stateAfter: LearningProgress['fsrsState'];
  stabilityBefore: number;
  stabilityAfter: number;
  difficultyBefore: number;
  difficultyAfter: number;
  dueAfter: number | null;
}

export interface ReviewResult {
  progress: LearningProgress;
  record: ReviewRecord;
  /** True when this was the learner's first ever answer for the item. */
  wasNew: boolean;
}

/** Applies one answer to an item's progress. Pure: persistence happens in the repository. */
export function applyReview(
  previous: LearningProgress | null,
  input: ReviewInput,
  params: FsrsParams = DEFAULT_FSRS_PARAMS,
): ReviewResult {
  const before = previous ?? emptyProgress(input.itemId);
  const rating = ratingForAnswer(input.outcome);
  const correct = isCorrect(input.outcome);
  const { card } = schedule(toFsrsCard(before), rating, input.now, params);

  const updated: LearningProgress = {
    ...before,
    fsrsState: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    dueAt: card.dueAt,
    lastReviewedAt: card.lastReviewedAt,
    reps: card.reps,
    lapses: card.lapses,
    seenCount: before.seenCount + 1,
    correctCount: before.correctCount + (correct ? 1 : 0),
    incorrectCount: before.incorrectCount + (correct ? 0 : 1),
    streak: correct ? before.streak + 1 : 0,
    confidence: before.confidence + CONFIDENCE_ALPHA * ((correct ? 1 : 0) - before.confidence),
    lastRating: rating,
  };
  updated.status = deriveStatus(updated);

  return {
    progress: updated,
    wasNew: before.reps === 0,
    record: {
      itemId: input.itemId,
      exerciseType: input.exerciseType,
      rating,
      correct,
      responseMs: input.outcome.kind === 'quiz' ? input.outcome.responseMs : null,
      context: input.context,
      reviewedAt: input.now,
      stateBefore: before.fsrsState,
      stateAfter: updated.fsrsState,
      stabilityBefore: before.stability,
      stabilityAfter: updated.stability,
      difficultyBefore: before.difficulty,
      difficultyAfter: updated.difficulty,
      dueAfter: updated.dueAt,
    },
  };
}
