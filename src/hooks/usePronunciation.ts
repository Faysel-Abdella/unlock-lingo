import { useCallback, useEffect } from 'react';

import { useProfile, useSettings } from '@/features/settings/hooks';
import { ttsPronunciationService } from '@/services/audio/speech';

/** Speaks text in the learner's target language at their preferred rate. */
export function usePronunciation() {
  const language = useProfile().data?.targetLanguage ?? 'en';
  const rate = useSettings().data?.speechRate ?? 0.9;
  useEffect(() => () => ttsPronunciationService.stop(), []);
  return useCallback((text: string) => ttsPronunciationService.speak(text, { language, rate }), [language, rate]);
}
