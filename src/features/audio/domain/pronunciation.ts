import type { LearningItem } from '@/types/learning';

/** One recogniser hypothesis. */
export interface Hypothesis {
  transcript: string;
  /** 0–1 as reported by the engine; some engines report 0 or -1 when unknown. */
  confidence: number;
}

export type PronunciationVerdict = 'clear' | 'close' | 'unclear';

export interface PronunciationScore {
  verdict: PronunciationVerdict;
  /** The hypothesis closest to the expected text, for feedback ("we heard …"). */
  heard: string | null;
  /** 0–1 similarity between the expected text and what was heard. */
  similarity: number;
}

/** At or above this similarity an attempt is "close" (likely recognition noise, not a different word). */
export const CLOSE_SIMILARITY = 0.75;
/** Speaking practice only makes sense for short texts: single words and short phrases. */
export const MAX_SPEAKABLE_WORDS = 5;

/** Lowercase, accents and punctuation removed, whitespace collapsed. */
export function normalizeSpeech(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function similarity(expected: string, heard: string): number {
  if (expected.length === 0) return 0;
  // Learners often say a word inside a carrier phrase ("resilient, resilient").
  const words = heard.split(' ');
  for (let size = 1; size <= words.length; size++) {
    for (let start = 0; start + size <= words.length; start++) {
      if (words.slice(start, start + size).join(' ') === expected) return 1;
    }
  }
  return Math.max(0, 1 - levenshtein(expected, heard) / Math.max(expected.length, heard.length));
}

/** Compares recogniser hypotheses with the expected text and keeps the best match. */
export function scorePronunciation(expected: string, hypotheses: readonly Hypothesis[]): PronunciationScore {
  const target = normalizeSpeech(expected);
  let best: PronunciationScore = { verdict: 'unclear', heard: null, similarity: 0 };
  for (const h of hypotheses) {
    const heard = normalizeSpeech(h.transcript);
    if (!heard) continue;
    const s = similarity(target, heard);
    if (s > best.similarity || best.heard === null) {
      best = { verdict: s === 1 ? 'clear' : s >= CLOSE_SIMILARITY ? 'close' : 'unclear', heard: h.transcript.trim(), similarity: s };
    }
  }
  return best;
}

/** Whether a text is short enough to practise saying aloud. */
export function isSpeakable(text: string): boolean {
  const words = normalizeSpeech(text).split(' ').filter(Boolean);
  return words.length > 0 && words.length <= MAX_SPEAKABLE_WORDS;
}

/** The text a learner would say for an item, or null when it is not suited to speaking practice. */
export function speakableText(item: LearningItem): string | null {
  const text = item.type === 'vocabulary' ? item.word : item.type === 'phrase' ? item.phrase : null;
  return text && isSpeakable(text) ? text : null;
}
