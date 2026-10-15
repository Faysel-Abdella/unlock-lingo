import { type ExpoSpeechRecognitionErrorCode, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';

import type { Hypothesis } from '@/features/audio/domain/pronunciation';
import { LANGUAGES } from '@/types/language';

import type { RecognitionOutcome, SpeechRecognitionProvider } from './recognition';

/** Give up if the recogniser never ends on its own (e.g. a stuck service). */
const RECOGNITION_TIMEOUT_MS = 12_000;
const MAX_ALTERNATIVES = 5;

function errorOutcome(code: ExpoSpeechRecognitionErrorCode, message: string): RecognitionOutcome {
  switch (code) {
    case 'no-speech':
    case 'speech-timeout':
      return { kind: 'silence' };
    case 'not-allowed':
      return { kind: 'denied' };
    case 'aborted':
      return { kind: 'cancelled' };
    default:
      return { kind: 'unavailable', reason: message || code };
  }
}

const onDeviceLocales = new Map<string, Promise<boolean>>();

/** True when the locale's offline model is installed, so audio never leaves the device. */
function canRecognizeOnDevice(locale: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) return Promise.resolve(false);
  let pending = onDeviceLocales.get(locale);
  if (!pending) {
    pending = ExpoSpeechRecognitionModule.getSupportedLocales({})
      .then(({ installedLocales }) => installedLocales.some((l) => l.toLowerCase() === locale.toLowerCase()))
      .catch(() => false);
    onDeviceLocales.set(locale, pending);
  }
  return pending;
}

function isAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/**
 * expo-speech-recognition backed provider: Android's SpeechRecognizer (on-device
 * when the language model is installed), SFSpeechRecognizer on iOS, and the Web
 * Speech API in browsers that have it. The recogniser is not biased towards the
 * expected word, so a mispronunciation is not "corrected" into a match.
 */
export const speechRecognitionProvider: SpeechRecognitionProvider = {
  isAvailable,

  async requestPermission() {
    try {
      return (await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  },

  async recognize({ language }) {
    const locale = LANGUAGES[language].speechLocale;
    const onDevice = await canRecognizeOnDevice(locale);
    return new Promise<RecognitionOutcome>((resolve) => {
      let hypotheses: Hypothesis[] = [];
      let settled = false;
      const subs = [
        ExpoSpeechRecognitionModule.addListener('result', (event) => {
          if (!event.isFinal) return;
          hypotheses = event.results.map((r) => ({ transcript: r.transcript, confidence: r.confidence }));
        }),
        ExpoSpeechRecognitionModule.addListener('error', (event) => finish(errorOutcome(event.error, event.message))),
        ExpoSpeechRecognitionModule.addListener('end', () =>
          finish(hypotheses.length > 0 ? { kind: 'heard', hypotheses } : { kind: 'silence' }),
        ),
      ];
      const timer = setTimeout(() => {
        ExpoSpeechRecognitionModule.abort();
        finish(hypotheses.length > 0 ? { kind: 'heard', hypotheses } : { kind: 'silence' });
      }, RECOGNITION_TIMEOUT_MS);

      function finish(outcome: RecognitionOutcome) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subs.forEach((s) => s.remove());
        resolve(outcome);
      }

      try {
        ExpoSpeechRecognitionModule.start({
          lang: locale,
          interimResults: false,
          maxAlternatives: MAX_ALTERNATIVES,
          continuous: false,
          requiresOnDeviceRecognition: onDevice,
          addsPunctuation: false,
        });
      } catch (e) {
        finish({ kind: 'unavailable', reason: e instanceof Error ? e.message : 'Could not start speech recognition.' });
      }
    });
  },

  cancel() {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Nothing to cancel.
    }
  },
};
