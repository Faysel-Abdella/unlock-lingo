import {
  type AppSettings,
  type UserProfile,
  appSettingsSchema,
  userProfileSchema,
} from '@/features/settings/schema';
import type { Database } from '@/services/database/types';

interface ProfileRow {
  target_language: string;
  native_language: string | null;
  current_level: string;
  target_level: string;
  interests: string;
  onboarded_at: number | null;
}

export interface ProfileRepository {
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile, now: number): Promise<void>;
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  /** Clears learning progress and history. Content, My Words and settings are kept. */
  resetProgress(): Promise<void>;
}

export function createProfileRepository(db: Database): ProfileRepository {
  async function getSettings(): Promise<AppSettings> {
    const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM app_settings', []);
    const raw: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        raw[row.key] = JSON.parse(row.value);
      } catch {
        // Ignore a corrupt value; the schema falls back to the default.
      }
    }
    return appSettingsSchema.parse(raw);
  }

  return {
    async getProfile() {
      const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM user_profile WHERE id = 1', []);
      if (!row) return null;
      let interests: unknown = [];
      try {
        interests = JSON.parse(row.interests);
      } catch {
        interests = [];
      }
      const parsed = userProfileSchema.safeParse({
        targetLanguage: row.target_language,
        nativeLanguage: row.native_language,
        currentLevel: row.current_level,
        targetLevel: row.target_level,
        interests,
        onboardedAt: row.onboarded_at,
      });
      return parsed.success ? parsed.data : null;
    },

    async saveProfile(profile, now) {
      const p = userProfileSchema.parse(profile);
      await db.runAsync(
        `INSERT INTO user_profile
           (id, target_language, native_language, current_level, target_level, interests, onboarded_at, created_at, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           target_language = excluded.target_language, native_language = excluded.native_language,
           current_level = excluded.current_level, target_level = excluded.target_level,
           interests = excluded.interests, onboarded_at = excluded.onboarded_at, updated_at = excluded.updated_at`,
        [p.targetLanguage, p.nativeLanguage, p.currentLevel, p.targetLevel, JSON.stringify(p.interests), p.onboardedAt, now, now],
      );
    },

    getSettings,

    async updateSettings(patch) {
      const next = appSettingsSchema.parse({ ...(await getSettings()), ...patch });
      await db.withTransactionAsync(async () => {
        for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
          await db.runAsync(
            `INSERT INTO app_settings (key, value) VALUES (?, ?)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
            [key, JSON.stringify(next[key])],
          );
        }
      });
      return next;
    },

    async resetProgress() {
      await db.withTransactionAsync(async () => {
        await db.execAsync(`
          DELETE FROM learning_progress;
          DELETE FROM review_history;
          DELETE FROM daily_activity;
          DELETE FROM weekly_stats;
        `);
      });
    },
  };
}
