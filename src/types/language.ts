import { z } from 'zod';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const cefrLevelSchema = z.enum(CEFR_LEVELS);
export type CefrLevel = z.infer<typeof cefrLevelSchema>;

export function cefrIndex(level: CefrLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

export function cefrAt(index: number): CefrLevel {
  const clamped = Math.max(0, Math.min(CEFR_LEVELS.length - 1, index));
  return CEFR_LEVELS[clamped] as CefrLevel;
}

/** Languages the architecture knows about. Content availability is tracked separately. */
export const LANGUAGES = {
  en: { name: 'English', speechLocale: 'en-US' },
  es: { name: 'Spanish', speechLocale: 'es-ES' },
  fr: { name: 'French', speechLocale: 'fr-FR' },
  ar: { name: 'Arabic', speechLocale: 'ar-SA' },
  de: { name: 'German', speechLocale: 'de-DE' },
  pt: { name: 'Portuguese', speechLocale: 'pt-PT' },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;
export const languageCodeSchema = z.enum(
  Object.keys(LANGUAGES) as [LanguageCode, ...LanguageCode[]],
);

/** Target languages that ship with learning content in this build. */
export const LANGUAGES_WITH_CONTENT: readonly LanguageCode[] = ['en'];

export const INTERESTS = [
  'general',
  'professional',
  'software',
  'business',
  'travel',
  'academic',
] as const;
export const interestSchema = z.enum(INTERESTS);
export type Interest = z.infer<typeof interestSchema>;

export const INTEREST_LABELS: Record<Interest, string> = {
  general: 'General',
  professional: 'Professional',
  software: 'Software engineering',
  business: 'Business',
  travel: 'Travel',
  academic: 'Academic',
};
