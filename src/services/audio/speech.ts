import * as Speech from 'expo-speech';

import { LANGUAGES, type LanguageCode } from '@/types/language';

export interface SpeakOptions {
  language: LanguageCode;
  rate?: number;
}

/**
 * Pronunciation playback. The MVP uses the platform text-to-speech engine.
 * Prerecorded audio (`VocabularyItem.audioUri`) and speech recognition can be
 * added as further implementations without touching UI code.
 */
export interface PronunciationService {
  speak(text: string, options: SpeakOptions): void;
  stop(): void;
}

export const ttsPronunciationService: PronunciationService = {
  speak(text, { language, rate = 0.9 }) {
    void Speech.stop();
    Speech.speak(text, { language: LANGUAGES[language].speechLocale, rate });
  },
  stop() {
    void Speech.stop();
  },
};
