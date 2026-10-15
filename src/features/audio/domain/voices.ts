/** The parts of a platform TTS voice the picker needs. */
export interface VoiceInfo {
  identifier: string;
  language: string;
  quality: string;
}

/** Rate multiplier for "listen slowly". */
export const SLOW_RATE_FACTOR = 0.6;
export const MIN_SPEECH_RATE = 0.4;

export function slowRate(rate: number): number {
  return Math.max(MIN_SPEECH_RATE, Math.round(rate * SLOW_RATE_FACTOR * 100) / 100);
}

function normalise(tag: string): string {
  return tag.replace('_', '-').toLowerCase();
}

function score(voice: VoiceInfo, locale: string): number {
  const lang = normalise(voice.language);
  const wanted = normalise(locale);
  let s = 0;
  if (lang === wanted) s += 4;
  else if (lang.split('-')[0] === wanted.split('-')[0]) s += 2;
  else return -1;
  if (voice.quality === 'Enhanced') s += 2;
  const id = voice.identifier.toLowerCase();
  // Android voices are tagged; local ones work offline, network ones do not.
  if (id.includes('network')) s -= 3;
  else if (id.includes('local')) s += 1;
  return s;
}

/**
 * Picks the best voice for a locale: an exact locale match beats another
 * region of the same language, enhanced beats default, and offline voices
 * beat network ones. Returns null to let the platform choose.
 */
export function pickVoice(voices: readonly VoiceInfo[], locale: string): VoiceInfo | null {
  let best: VoiceInfo | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const s = score(voice, locale);
    if (s > bestScore) {
      best = voice;
      bestScore = s;
    }
  }
  return best;
}
