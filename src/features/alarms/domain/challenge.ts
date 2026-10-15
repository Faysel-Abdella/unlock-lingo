/**
 * Learn-to-dismiss challenge. Pure state machine so its safety rules are testable:
 *
 * - The alarm stops after `required` correct answers. Wrong answers don't count,
 *   but they are never penalised beyond needing another question.
 * - Emergency dismiss is always possible (the UI asks for a deliberate long press).
 * - If questions run out (no content), the challenge resolves instead of trapping.
 */
export type ChallengeStatus = 'active' | 'completed' | 'emergency' | 'unavailable';

export interface ChallengeState {
  required: number;
  correct: number;
  attempts: number;
  status: ChallengeStatus;
}

export function createChallenge(required: number, questionsAvailable: number): ChallengeState {
  const req = Math.max(1, Math.floor(required));
  return {
    required: req,
    correct: 0,
    attempts: 0,
    // No questions could be generated: never leave the user stuck.
    status: questionsAvailable > 0 ? 'active' : 'unavailable',
  };
}

export function answerChallenge(state: ChallengeState, correct: boolean): ChallengeState {
  if (state.status !== 'active') return state;
  const next = { ...state, attempts: state.attempts + 1, correct: state.correct + (correct ? 1 : 0) };
  return next.correct >= next.required ? { ...next, status: 'completed' } : next;
}

export function emergencyDismiss(state: ChallengeState): ChallengeState {
  return state.status === 'active' ? { ...state, status: 'emergency' } : state;
}

/** Called when the question supply is exhausted mid-challenge. */
export function questionsExhausted(state: ChallengeState): ChallengeState {
  return state.status === 'active' ? { ...state, status: 'unavailable' } : state;
}

export function canStopAlarm(state: ChallengeState): boolean {
  return state.status !== 'active';
}

export function remainingCorrect(state: ChallengeState): number {
  return Math.max(0, state.required - state.correct);
}

/** How many questions to prepare: enough to absorb a fair number of mistakes. */
export function questionBudget(required: number): number {
  return Math.max(required * 3, required + 5);
}

export type DismissMethod = 'challenge' | 'emergency' | 'timeout';

export function dismissMethod(state: ChallengeState): DismissMethod {
  return state.status === 'emergency' ? 'emergency' : 'challenge';
}
