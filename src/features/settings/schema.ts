import { z } from 'zod';

import { DEFAULT_UNLOCK_SETTINGS, unlockSettingsSchema } from '@/features/unlock/domain/settings';
import { cefrLevelSchema, interestSchema, languageCodeSchema } from '@/types/language';

/** Each field falls back to its default if stored data is missing or invalid. */
function setting<T extends z.ZodType>(schema: T, fallback: z.output<T>) {
  return schema.default(fallback as never).catch(fallback as never) as unknown as z.ZodType<z.output<T>, unknown>;
}

export const appSettingsSchema = z.object({
  /** Micro-lessons per day shown as the dashboard goal. */
  dailyGoal: setting(z.number().int().min(1).max(100), 10),
  /** Maximum number of brand-new items introduced per day. */
  newItemsPerDay: setting(z.number().int().min(0).max(50), 8),
  /** Items in a "Today's learning" session. */
  sessionSize: setting(z.number().int().min(3).max(30), 10),
  theme: setting(z.enum(['system', 'light', 'dark']), 'system'),
  /** Text-to-speech rate (1 = normal). */
  speechRate: setting(z.number().min(0.5).max(1.5), 0.9),
  autoPlayAudio: setting(z.boolean(), false),
  /** 0 = Sunday … 6 = Saturday. */
  weeklyReviewDay: setting(z.number().int().min(0).max(6), 0),
  /** Unlock learning cards. Falls back to safe defaults (off) if stored data is invalid. */
  unlock: setting(unlockSettingsSchema, DEFAULT_UNLOCK_SETTINGS),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type ThemePreference = AppSettings['theme'];

export const DEFAULT_SETTINGS: AppSettings = appSettingsSchema.parse({});

export const userProfileSchema = z.object({
  targetLanguage: languageCodeSchema,
  nativeLanguage: languageCodeSchema.nullable(),
  currentLevel: cefrLevelSchema,
  targetLevel: cefrLevelSchema,
  interests: z.array(interestSchema),
  onboardedAt: z.number().nullable(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
