import type { ExerciseType } from '@/types/learning';

import type { QueueEntry, QueueReason } from './queue';

export type StepMode = 'intro' | 'quiz';

export interface SessionStep {
  itemId: string;
  mode: StepMode;
  reason: QueueReason | 'retry';
}

export interface SessionAnswer {
  itemId: string;
  mode: StepMode;
  exerciseType: ExerciseType;
  correct: boolean;
}

export interface SessionState {
  steps: SessionStep[];
  index: number;
  answers: SessionAnswer[];
  /** Items already given a retry, so a hard item cannot loop forever. */
  retried: string[];
}

/** A new item's first quiz comes this many steps after its intro card. */
export const INTRO_QUIZ_GAP = 3;
/** A missed item comes back this many steps later, once per session. */
export const RETRY_GAP = 3;

function insertAt<T>(list: T[], position: number, value: T): T[] {
  const copy = [...list];
  copy.splice(Math.min(position, copy.length), 0, value);
  return copy;
}

/**
 * Turns a queue into session steps. New items get an intro card, then a quiz a
 * few steps later (spacing within the session aids encoding). Items that cannot
 * be quizzed (e.g. unenriched personal words) get the card only.
 */
export function createSession(entries: readonly QueueEntry[], canQuiz: (itemId: string) => boolean): SessionState {
  let steps: SessionStep[] = entries.map((e) => ({
    itemId: e.itemId,
    mode: e.reason === 'new' || !canQuiz(e.itemId) ? 'intro' : 'quiz',
    reason: e.reason,
  }));

  // Insert follow-up quizzes from the end so that earlier positions stay valid.
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i] as SessionStep;
    if (s.reason === 'new' && canQuiz(s.itemId)) {
      steps = insertAt(steps, i + 1 + INTRO_QUIZ_GAP, { itemId: s.itemId, mode: 'quiz', reason: 'new' });
    }
  }
  return { steps, index: 0, answers: [], retried: [] };
}

export function currentStep(state: SessionState): SessionStep | null {
  return state.steps[state.index] ?? null;
}

export function isComplete(state: SessionState): boolean {
  return state.index >= state.steps.length;
}

export function answerStep(
  state: SessionState,
  answer: { correct: boolean; exerciseType: ExerciseType },
): SessionState {
  const step = currentStep(state);
  if (!step) return state;

  const recorded: SessionAnswer = { itemId: step.itemId, mode: step.mode, ...answer };
  let steps = state.steps;
  let retried = state.retried;

  if (step.mode === 'quiz' && !answer.correct && !retried.includes(step.itemId)) {
    steps = insertAt(steps, state.index + 1 + RETRY_GAP, { itemId: step.itemId, mode: 'quiz', reason: 'retry' });
    retried = [...retried, step.itemId];
  }

  return { steps, index: state.index + 1, answers: [...state.answers, recorded], retried };
}

/** Skips the current step without recording an answer (e.g. content failed to load). */
export function skipStep(state: SessionState): SessionState {
  return { ...state, index: state.index + 1 };
}

export interface SessionSummary {
  interactions: number;
  quizzes: number;
  correct: number;
  accuracy: number | null;
  newItems: number;
  /** Items whose final answer in this session was wrong. */
  missedItemIds: string[];
}

export function summarize(state: SessionState): SessionSummary {
  const quizzes = state.answers.filter((a) => a.mode === 'quiz');
  const correct = quizzes.filter((a) => a.correct).length;
  const lastByItem = new Map<string, SessionAnswer>();
  for (const a of state.answers) lastByItem.set(a.itemId, a);
  return {
    interactions: state.answers.length,
    quizzes: quizzes.length,
    correct,
    accuracy: quizzes.length === 0 ? null : correct / quizzes.length,
    newItems: new Set(state.steps.filter((s) => s.reason === 'new').map((s) => s.itemId)).size,
    missedItemIds: [...lastByItem.values()].filter((a) => !a.correct).map((a) => a.itemId),
  };
}
