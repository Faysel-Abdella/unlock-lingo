import { useEffect, useMemo, useRef, useState } from 'react';

import { useProfile, useSettings } from '@/features/settings/hooks';
import { useRepositories } from '@/hooks/useRepositories';
import { completeWeeklyReview, loadWeeklyReview, prepareWeeklySession } from '@/features/reviews/weeklyService';
import type { WeeklyStats } from '@/features/reviews/domain/weekly';
import type { ExerciseType, ReviewContext } from '@/types/learning';

import { type Question, generateQuestion, introCard } from './domain/exercises';
import type { AnswerOutcome } from './domain/review';
import { type SessionState, answerStep, currentStep, isComplete, skipStep, summarize } from './domain/session';
import { type PreparedSession, prepareSession } from './learningService';

export type SessionPhase = 'loading' | 'empty' | 'active' | 'done' | 'error';

const randomRng = () => Math.random();

interface Answer {
  correct: boolean;
  exerciseType: ExerciseType;
}

export type SessionKind = 'daily' | 'weekly';

/**
 * Drives a learning session: builds the steps once, generates a question per
 * step, persists every answer immediately (so closing early never loses
 * progress) and advances through intro/quiz/retry steps.
 *
 * - `daily`: "Today's learning", from the review queue.
 * - `weekly`: the weekly review quiz; completing it saves the week's snapshot.
 */
export function useLearningSession(kind: SessionKind = 'daily') {
  const repos = useRepositories();
  const profile = useProfile().data;
  const settings = useSettings().data;
  const started = useRef(false);

  const [prepared, setPrepared] = useState<PreparedSession | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState<Answer | null>(null);
  const [lastTypes, setLastTypes] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const weeklySaved = useRef(false);
  const context: ReviewContext = kind === 'weekly' ? 'weekly' : 'session';

  useEffect(() => {
    if (!profile || !settings || started.current) return;
    started.current = true;
    const prepare = async (): Promise<PreparedSession> => {
      if (kind === 'daily') return prepareSession(repos, profile, settings, Date.now());
      const review = await loadWeeklyReview(repos, profile, settings, Date.now());
      setWeeklyStats(review.stats);
      return prepareWeeklySession(repos, profile, review.quizItemIds);
    };
    prepare()
      .then((p) => {
        setPrepared(p);
        setSession(p.state);
        setLastTypes(p.lastExerciseTypes);
        setSavedIds(new Set(p.personalItemIds));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, [repos, profile, settings, kind]);

  const step = session ? currentStep(session) : null;

  const question: Question | null = useMemo(() => {
    if (!step || !prepared) return null;
    const item = prepared.items[step.itemId];
    if (!item) return null;
    if (step.mode === 'intro') return introCard(item);
    return generateQuestion(item, {
      pool: prepared.pool,
      nativeLanguage: profile?.nativeLanguage ?? null,
      rng: randomRng,
      avoidType: lastTypes[item.id] as ExerciseType | undefined,
    });
    // Regenerate only when the step changes, not when answer bookkeeping updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.index, prepared]);

  const phase: SessionPhase = error
    ? 'error'
    : !session
      ? 'loading'
      : session.steps.length === 0
        ? 'empty'
        : isComplete(session)
          ? 'done'
          : 'active';

  // Completing the weekly quiz saves the week, so the review is not offered again.
  useEffect(() => {
    if (kind !== 'weekly' || phase !== 'done' || !weeklyStats || !session || weeklySaved.current) return;
    weeklySaved.current = true;
    const { quizzes, correct } = summarize(session);
    void completeWeeklyReview(repos, weeklyStats, { questions: quizzes, correct }, Date.now()).catch((e: unknown) =>
      console.warn('Could not save weekly review', e),
    );
  }, [kind, phase, weeklyStats, session, repos]);

  /** Persists an answer for the current step. Quizzes then show feedback until `advance`. */
  async function record(outcome: AnswerOutcome, exerciseType: ExerciseType): Promise<Answer | null> {
    if (!step || !prepared) return null;
    const item = prepared.items[step.itemId];
    if (!item) return null;
    const answer: Answer = { correct: outcome.kind === 'quiz' ? outcome.correct : outcome.knewIt, exerciseType };
    setPending(answer);
    setLastTypes((types) => ({ ...types, [item.id]: exerciseType }));
    await repos.progress.recordReview({
      itemId: item.id,
      itemType: item.type,
      exerciseType,
      outcome,
      context,
      now: Date.now(),
    });
    return answer;
  }

  /** Moves to the next step. Pass the answer when advancing in the same tick as `record`. */
  function advance(answer: Answer | null = pending) {
    setSession((s) => (s ? (answer ? answerStep(s, answer) : skipStep(s)) : s));
    setPending(null);
  }

  async function toggleSave(itemId: string, word: string) {
    if (savedIds.has(itemId) || !profile) return;
    await repos.personal.add(
      { word, language: profile.targetLanguage, defaultLevel: profile.currentLevel },
      Date.now(),
    );
    setSavedIds((ids) => new Set(ids).add(itemId));
  }

  return {
    phase,
    error,
    step,
    question,
    item: step && prepared ? (prepared.items[step.itemId] ?? null) : null,
    progress: session && session.steps.length > 0 ? session.index / session.steps.length : 0,
    position: session ? { index: session.index, total: session.steps.length } : null,
    summary: session ? summarize(session) : null,
    savedIds,
    record,
    advance,
    toggleSave,
  };
}
