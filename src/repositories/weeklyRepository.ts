import { z } from 'zod';

import type { WeekAnswer } from '@/features/reviews/domain/weekly';
import type { Database } from '@/services/database/types';
import type { LanguageCode } from '@/types/language';
import type { LearningItemType } from '@/types/learning';
import type { DateKey } from '@/utils/date';

import { parseJson } from './rows';

/** What is stored when a weekly review is completed. */
export const weeklySnapshotSchema = z.object({
  week: z.object({ start: z.string(), end: z.string() }),
  wordsEncountered: z.number(),
  newWordsLearned: z.number(),
  wordsReviewed: z.number(),
  grammarCompleted: z.number(),
  accuracy: z.number().nullable(),
  activeDays: z.number(),
  streak: z.number(),
  quiz: z.object({ questions: z.number(), correct: z.number() }),
  completedAt: z.number(),
});
export type WeeklySnapshot = z.infer<typeof weeklySnapshotSchema>;

export interface WeekAnswerRow extends WeekAnswer {
  lapses: number;
  status: string | null;
}

export interface WeeklyRepository {
  /** Every answer in [from, to] (epoch ms), oldest first, excluding the weekly quiz itself. */
  answersBetween(language: LanguageCode, from: number, to: number): Promise<WeekAnswerRow[]>;
  getSnapshot(weekStart: DateKey): Promise<WeeklySnapshot | null>;
  saveSnapshot(snapshot: WeeklySnapshot, now: number): Promise<void>;
  /** Most recent first. */
  listSnapshots(limit?: number): Promise<WeeklySnapshot[]>;
}

export function createWeeklyRepository(db: Database): WeeklyRepository {
  return {
    async answersBetween(language, from, to) {
      const rows = await db.getAllAsync<{
        item_id: string;
        type: LearningItemType;
        exercise_type: string;
        correct: number;
        first_ever: number;
        lapses: number | null;
        status: string | null;
      }>(
        `SELECT rh.item_id, li.type, rh.exercise_type, rh.correct, lp.lapses, lp.status,
                NOT EXISTS (
                  SELECT 1 FROM review_history earlier
                  WHERE earlier.item_id = rh.item_id
                    AND (earlier.reviewed_at < rh.reviewed_at OR (earlier.reviewed_at = rh.reviewed_at AND earlier.id < rh.id))
                ) AS first_ever
         FROM review_history rh
         JOIN learning_items li ON li.id = rh.item_id
         LEFT JOIN learning_progress lp ON lp.item_id = rh.item_id
         WHERE li.language = ? AND rh.reviewed_at BETWEEN ? AND ? AND rh.context <> 'weekly'
         ORDER BY rh.reviewed_at, rh.id`,
        [language, from, to],
      );
      return rows.map((r) => ({
        itemId: r.item_id,
        itemType: r.type,
        correct: r.correct === 1,
        firstEver: r.first_ever === 1,
        // Mirrors applyReview: a first-exposure self-grade is not scored.
        scored: !(r.first_ever === 1 && r.exercise_type === 'intro'),
        lapses: r.lapses ?? 0,
        status: r.status,
      }));
    },

    async getSnapshot(weekStart) {
      const row = await db.getFirstAsync<{ snapshot: string }>('SELECT snapshot FROM weekly_stats WHERE week_start = ?', [
        weekStart,
      ]);
      return row ? parseJson(weeklySnapshotSchema.nullable(), row.snapshot, null) : null;
    },

    async saveSnapshot(snapshot, now) {
      const valid = weeklySnapshotSchema.parse(snapshot);
      await db.runAsync(
        `INSERT INTO weekly_stats (week_start, snapshot, created_at) VALUES (?, ?, ?)
         ON CONFLICT (week_start) DO UPDATE SET snapshot = excluded.snapshot`,
        [valid.week.start, JSON.stringify(valid), now],
      );
    },

    async listSnapshots(limit = 12) {
      const rows = await db.getAllAsync<{ snapshot: string }>(
        'SELECT snapshot FROM weekly_stats ORDER BY week_start DESC LIMIT ?',
        [limit],
      );
      return rows.flatMap((r) => parseJson(weeklySnapshotSchema.nullable(), r.snapshot, null) ?? []);
    },
  };
}
