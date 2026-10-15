import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useProfile } from '@/features/settings/hooks';
import { queryKeys } from '@/hooks/queryKeys';
import { useRepositories } from '@/hooks/useRepositories';
import { speechRecognitionProvider } from '@/services/audio/speechRecognition';

import type { PronunciationScore } from './domain/pronunciation';
import { attemptPronunciation } from './pronunciationService';

export type PracticeState =
  | { status: 'idle' }
  | { status: 'listening' }
  | { status: 'scored'; score: PronunciationScore }
  | { status: 'silence' }
  | { status: 'blocked'; message: string };

/** One "say it" exercise: listen, score, and allow a few retries. Mount it once per item. */
export function usePronunciationPractice(target: { itemId: string; expected: string } | null) {
  const repos = useRepositories();
  const client = useQueryClient();
  const language = useProfile().data?.targetLanguage ?? 'en';
  const [state, setState] = useState<PracticeState>({ status: 'idle' });
  const [attempts, setAttempts] = useState(0);
  const mounted = useRef(true);

  // Callers remount the hook per item (via `key`), so state never carries over between items.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      speechRecognitionProvider.cancel();
    };
  }, []);

  const listen = useCallback(async () => {
    if (!target) return;
    if (!speechRecognitionProvider.isAvailable()) {
      setState({ status: 'blocked', message: 'Speech recognition is not available on this device.' });
      return;
    }
    if (!(await speechRecognitionProvider.requestPermission())) {
      setState({ status: 'blocked', message: 'Allow microphone access to practise speaking.' });
      return;
    }
    setState({ status: 'listening' });
    const { outcome, score } = await attemptPronunciation(repos, speechRecognitionProvider, { ...target, language }, Date.now);
    if (!mounted.current) return;
    setAttempts((n) => n + 1);
    if (score) {
      setState({ status: 'scored', score });
      void client.invalidateQueries({ queryKey: queryKeys.pronunciation });
    } else if (outcome.kind === 'silence' || outcome.kind === 'cancelled') setState({ status: 'silence' });
    else if (outcome.kind === 'denied') setState({ status: 'blocked', message: 'Allow microphone access to practise speaking.' });
    else if (outcome.kind === 'unavailable') setState({ status: 'blocked', message: outcome.reason });
  }, [repos, client, language, target]);

  const stop = useCallback(() => speechRecognitionProvider.cancel(), []);

  return { state, attempts, listen, stop, available: speechRecognitionProvider.isAvailable() };
}
