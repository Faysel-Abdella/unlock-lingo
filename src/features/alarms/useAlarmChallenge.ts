import { useEffect, useRef, useState } from 'react';

import type { ChoiceQuestion } from '@/features/learning/domain/exercises';
import { useProfile } from '@/features/settings/hooks';
import { useRepositories } from '@/hooks/useRepositories';
import { alarmClock } from '@/native/alarmClock';
import type { LearningItem } from '@/types/learning';

import { prepareAlarmChallenge, recordAlarmAnswer, recordChallengeResult } from './alarmService';
import {
  type ChallengeState,
  answerChallenge,
  canStopAlarm,
  createChallenge,
  dismissMethod,
  emergencyDismiss,
  questionsExhausted,
} from './domain/challenge';
import { snoozeDecision } from './domain/schedule';
import type { Alarm } from './domain/types';

export type ChallengePhase =
  /** Building questions. The emergency stop already works. */
  | 'loading'
  | 'active'
  /** The challenge is resolved and the alarm has been told to stop. */
  | 'stopped'
  /** Ringing ended elsewhere (timeout, notification emergency stop). */
  | 'ended';

const random = () => Math.random();

export function useAlarmChallenge(alarmId: string) {
  const repos = useRepositories();
  const profile = useProfile();
  const started = useRef(false);
  const stopping = useRef(false);

  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [questions, setQuestions] = useState<ChoiceQuestion[]>([]);
  const [items, setItems] = useState<Record<string, LearningItem>>({});
  const [index, setIndex] = useState(0);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [phase, setPhase] = useState<ChallengePhase>('loading');
  const [ringing] = useState(() => alarmClock.getRinging());
  const [snoozed, setSnoozed] = useState(false);

  // Build the challenge once. Any failure resolves to "no questions", which can be dismissed.
  useEffect(() => {
    if (started.current || profile.isPending) return;
    started.current = true;
    (async () => {
      const found = await repos.alarms.get(alarmId);
      setAlarm(found);
      if (!found || !profile.data) {
        setChallenge(createChallenge(1, 0));
        return;
      }
      const content = await prepareAlarmChallenge(repos, profile.data, found, Date.now(), random);
      setQuestions(content.questions);
      setItems(content.items);
      setChallenge(createChallenge(found.questionCount, content.questions.length));
    })()
      .catch((error: unknown) => {
        console.warn('Could not build alarm challenge', error);
        setChallenge(createChallenge(1, 0));
      })
      .finally(() => setPhase((p) => (p === 'loading' ? 'active' : p)));
  }, [repos, alarmId, profile.isPending, profile.data]);

  // Ringing may stop without us: timeout or the notification's emergency stop.
  useEffect(() => {
    const sub = alarmClock.onRingingChanged((ringingId) => {
      if (ringingId === null && !stopping.current) setPhase('ended');
    });
    return () => sub?.remove();
  }, []);

  // Once the challenge allows it, record the result and stop the alarm.
  useEffect(() => {
    if (!challenge || !canStopAlarm(challenge) || stopping.current) return;
    stopping.current = true;
    const method = dismissMethod(challenge);
    void (async () => {
      try {
        await recordChallengeResult(repos, alarmClock, alarmId, challenge.attempts, challenge.correct, Date.now());
      } finally {
        // Stopping the sound must not depend on bookkeeping succeeding.
        await alarmClock.stopRinging(method === 'emergency' ? 'emergency' : 'challenge');
        setPhase('stopped');
      }
    })();
  }, [challenge, repos, alarmId]);

  const question = phase === 'active' && challenge?.status === 'active' ? (questions[index] ?? null) : null;

  async function answer(correct: boolean, responseMs: number) {
    if (!question || !challenge) return;
    const item = items[question.itemId];
    if (item) {
      await recordAlarmAnswer(repos, { question, item, correct, responseMs }, Date.now()).catch((e: unknown) =>
        console.warn('Could not record alarm answer', e),
      );
    }
    setChallenge((c) => (c ? answerChallenge(c, correct) : c));
  }

  /** Called after the feedback for a question has been shown. */
  function next() {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= questions.length) setChallenge((c) => (c ? questionsExhausted(c) : c));
  }

  function emergency() {
    setChallenge((c) => (c ? emergencyDismiss(c) : createChallenge(1, 0)));
  }

  // Only `allowed`/`remaining` are used here; the native side computes the wake-up time.
  const decision = alarm ? snoozeDecision(alarm, ringing?.snoozeCount ?? 0, 0) : null;
  const snooze = decision ? { allowed: decision.allowed, remaining: decision.remaining, minutes: alarm?.snoozeMinutes ?? 0 } : null;

  async function snoozeAlarm() {
    stopping.current = true;
    await alarmClock.snooze();
    setSnoozed(true);
    setPhase('ended');
  }

  return { phase, snoozed, alarm, challenge, question, questionNumber: index + 1, snooze, answer, next, emergency, snoozeAlarm };
}
