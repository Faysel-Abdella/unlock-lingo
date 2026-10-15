import type { Hypothesis } from '@/features/audio/domain/pronunciation';
import type { LanguageCode } from '@/types/language';

export type RecognitionOutcome =
  | { kind: 'heard'; hypotheses: Hypothesis[] }
  /** Nothing was said (or nothing recognisable) before the recogniser gave up. */
  | { kind: 'silence' }
  | { kind: 'denied' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'cancelled' };

/**
 * Speech recognition for pronunciation practice. Implementations should
 * prefer on-device recognition so practice works offline.
 */
export interface SpeechRecognitionProvider {
  isAvailable(): boolean;
  /** Asks for microphone (and recogniser) permission. */
  requestPermission(): Promise<boolean>;
  recognize(options: { language: LanguageCode }): Promise<RecognitionOutcome>;
  cancel(): void;
}

export const nullSpeechRecognitionProvider: SpeechRecognitionProvider = {
  isAvailable: () => false,
  requestPermission: async () => false,
  recognize: async () => ({ kind: 'unavailable', reason: 'Speech recognition is not available on this device.' }),
  cancel: () => undefined,
};
