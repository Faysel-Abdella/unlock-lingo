import { useCallback, useEffect } from 'react';

import { useProfile, useSettings } from '@/features/settings/hooks';
import { ttsPronunciationService } from '@/services/audio/speech';

/** Speaks text in the learner's target language at their preferred rate, or slowly. */
export function usePronunciation() {
  const language = useProfile().data?.targetLanguage ?? 'en';
  const rate = useSettings().data?.speechRate ?? 0.9;
  useEffect(() => () => ttsPronunciationService.stop(), []);
  return useCallback(
    (text: string, options?: { slow?: boolean }) =>
      ttsPronunciationService.speak(text, { language, rate, slow: options?.slow }),
    [language, rate],
  );
}
