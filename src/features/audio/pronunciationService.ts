import type { Repositories } from '@/repositories';
import type { RecognitionOutcome, SpeechRecognitionProvider } from '@/services/audio/recognition';
import type { LanguageCode } from '@/types/language';

import { type PronunciationScore, scorePronunciation } from './domain/pronunciation';

export interface PronunciationAttemptResult {
  outcome: RecognitionOutcome;
  /** Present when something was heard. */
  score: PronunciationScore | null;
}

/**
 * Listens once and scores what was heard against `expected`. Attempts where
 * something was heard are stored for progress; silence and errors are not.
 */
export async function attemptPronunciation(
  repos: Repositories,
  provider: SpeechRecognitionProvider,
  target: { itemId: string; expected: string; language: LanguageCode },
  now: () => number,
): Promise<PronunciationAttemptResult> {
  const outcome = await provider.recognize({ language: target.language });
  if (outcome.kind !== 'heard') return { outcome, score: null };
  const score = scorePronunciation(target.expected, outcome.hypotheses);
  await repos.pronunciation.record({
    itemId: target.itemId,
    expected: target.expected,
    heard: score.heard,
    similarity: score.similarity,
    verdict: score.verdict,
    attemptedAt: now(),
  });
  return { outcome, score };
}
