import * as Speech from 'expo-speech';

import { pickVoice, slowRate } from '@/features/audio/domain/voices';
import { LANGUAGES, type LanguageCode } from '@/types/language';

export interface SpeakOptions {
  language: LanguageCode;
  rate?: number;
  /** Replay noticeably slower than the learner's preferred rate. */
  slow?: boolean;
}

/**
 * Pronunciation playback. The MVP uses the platform text-to-speech engine.
 * Prerecorded audio (`VocabularyItem.audioUri`) can be added as a further
 * implementation without touching UI code.
 */
export interface PronunciationService {
  speak(text: string, options: SpeakOptions): void;
  stop(): void;
}

const voiceCache = new Map<string, Promise<string | undefined>>();

/** Resolves (once per locale) the best installed voice; undefined lets the platform choose. */
function voiceFor(locale: string): Promise<string | undefined> {
  let pending = voiceCache.get(locale);
  if (!pending) {
    pending = Speech.getAvailableVoicesAsync()
      .then((voices) => {
        // Some engines (notably browsers) list voices lazily: try again next time.
        if (voices.length === 0) voiceCache.delete(locale);
        return pickVoice(voices, locale)?.identifier;
      })
      .catch(() => {
        voiceCache.delete(locale);
        return undefined;
      });
    voiceCache.set(locale, pending);
  }
  return pending;
}

let utterance = 0;

export const ttsPronunciationService: PronunciationService = {
  speak(text, { language, rate = 0.9, slow = false }) {
    const id = ++utterance;
    void Speech.stop();
    const locale = LANGUAGES[language].speechLocale;
    void voiceFor(locale).then((voice) => {
      // A newer request (or stop) arrived while voices were loading.
      if (id !== utterance) return;
      Speech.speak(text, { language: locale, voice, rate: slow ? slowRate(rate) : rate });
    });
  },
  stop() {
    utterance += 1;
    void Speech.stop();
  },
};
