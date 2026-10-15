import type { LanguageCode } from '@/types/language';

export interface RecognitionResult {
  transcript: string;
  /** 0–1, as reported by the engine. */
  confidence: number;
}

/**
 * Speech recognition for future pronunciation practice ("say the word").
 * Nothing in the app depends on it yet; a provider backed by an on-device
 * recogniser can be added behind this interface.
 */
export interface SpeechRecognitionProvider {
  readonly available: boolean;
  recognize(options: { language: LanguageCode; expected?: string }): Promise<RecognitionResult | null>;
  cancel(): void;
}

export const nullSpeechRecognitionProvider: SpeechRecognitionProvider = {
  available: false,
  recognize: async () => null,
  cancel: () => undefined,
};
