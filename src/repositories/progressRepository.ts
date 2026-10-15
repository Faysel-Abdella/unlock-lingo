import type { LevelAccuracy } from '@/features/learning/domain/levelPolicy';
import type { QueueCandidate } from '@/features/learning/domain/queue';
import { type ReviewInput, type ReviewResult, applyReview } from '@/features/learning/domain/review';
import type { Database } from '@/services/database/types';
import { type CefrLevel, type LanguageCode, cefrLevelSchema } from '@/types/language';
import type { LearningItemType, LearningProgress } from '@/types/learning';
import { toDateKey } from '@/utils/date';

import type { ActivityRepository } from './activityRepository';
import {
  type FlagRow,
  PROGRESS_COLUMNS,
  type ProgressRow,
  flagsFromRow,
  parseJson,
  progressFromRow,
} from './rows';
import { z } from 'zod';

export interface RecordReviewInput extends ReviewInput {
  itemType: LearningItemType;
}

export interface ProgressRepository {
  getProgress(itemId: string): Promise<LearningProgress | null>;
  /** Every item of a language with its progress and personal-word flags. */
  getQueueCandidates(language: LanguageCode): Promise<QueueCandidate[]>;
  /** Applies an answer: updates progress, appends history and bumps daily activity atomically. */
  recordReview(input: RecordReviewInput): Promise<ReviewResult>;
  /** Accuracy of scored answers per CEFR level since `since`. */
  getLevelAccuracy(language: LanguageCode, since: number): Promise<LevelAccuracy[]>;
  /** The last exercise type used per item, to vary exercises. */
  getLastExerciseTypes(itemIds: readonly string[]): Promise<Map<string, string>>;
}

type CandidateRow = ProgressRow &
  FlagRow & {
    id: string;
    type: LearningItemType;
    cefr_level: string;
    difficulty_content: number;
    tags: string;
    personal_id: string | null;
    has_progress: number;
  };

const tagList = z.array(z.string());

async function upsertProgress(db: Database, p: LearningProgress, now: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO learning_progress (${PROGRESS_COLUMNS}, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (item_id) DO UPDATE SET
       status = excluded.status, fsrs_state = excluded.fsrs_state, stability = excluded.stability,
       difficulty = excluded.difficulty, due_at = excluded.due_at, last_reviewed_at = excluded.last_reviewed_at,
       reps = excluded.reps, lapses = excluded.lapses, seen_count = excluded.seen_count,
       correct_count = excluded.correct_count, incorrect_count = excluded.incorrect_count,
       streak = excluded.streak, confidence = excluded.confidence, last_rating = excluded.last_rating,
       updated_at = excluded.updated_at`,
    [
      p.itemId,
      p.status,
      p.fsrsState,
      p.stability,
      p.difficulty,
      p.dueAt,
      p.lastReviewedAt,
      p.reps,
      p.lapses,
      p.seenCount,
      p.correctCount,
      p.incorrectCount,
      p.streak,
      p.confidence,
      p.lastRating,
      now,
      now,
    ],
  );
}

export function createProgressRepository(db: Database, activity: ActivityRepository): ProgressRepository {
  async function getProgress(itemId: string): Promise<LearningProgress | null> {
    const row = await db.getFirstAsync<ProgressRow>(
      `SELECT ${PROGRESS_COLUMNS} FROM learning_progress WHERE item_id = ?`,
      [itemId],
    );
    return row ? progressFromRow(row) : null;
  }

  return {
    getProgress,

    async getQueueCandidates(language) {
      const rows = await db.getAllAsync<CandidateRow>(
        `SELECT li.id, li.type, li.cefr_level, li.difficulty AS difficulty_content, li.tags,
                lp.item_id IS NOT NULL AS has_progress,
                lp.item_id, lp.status, lp.fsrs_state, lp.stability, lp.difficulty, lp.due_at,
                lp.last_reviewed_at, lp.reps, lp.lapses, lp.seen_count, lp.correct_count,
                lp.incorrect_count, lp.streak, lp.confidence, lp.last_rating,
                pv.id AS personal_id, pv.is_important, pv.is_difficult, pv.is_mastered
         FROM learning_items li
         LEFT JOIN learning_progress lp ON lp.item_id = li.id
         LEFT JOIN personal_vocabulary pv ON pv.item_id = li.id
         WHERE li.language = ?`,
        [language],
      );
      return rows.map((row) => {
        const level = cefrLevelSchema.safeParse(row.cefr_level);
        return {
          itemId: row.id,
          type: row.type,
          cefrLevel: level.success ? level.data : ('B1' as CefrLevel),
          tags: parseJson(tagList, row.tags, []),
          contentDifficulty: row.difficulty_content,
          progress: row.has_progress ? progressFromRow(row) : null,
          personal: flagsFromRow(row),
        };
      });
    },

    async recordReview(input) {
      let result: ReviewResult | null = null;
      await db.withTransactionAsync(async () => {
        const previous = await getProgress(input.itemId);
        const review = applyReview(previous, input);
        await upsertProgress(db, review.progress, input.now);
        const r = review.record;
        await db.runAsync(
          `INSERT INTO review_history
             (item_id, exercise_type, rating, correct, response_ms, context, state_before, state_after,
              stability_before, stability_after, difficulty_before, difficulty_after, due_after, reviewed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.itemId,
            r.exerciseType,
            r.rating,
            r.correct ? 1 : 0,
            r.responseMs,
            r.context,
            r.stateBefore,
            r.stateAfter,
            r.stabilityBefore,
            r.stabilityAfter,
            r.difficultyBefore,
            r.difficultyAfter,
            r.dueAfter,
            r.reviewedAt,
          ],
        );
        await activity.increment(
          toDateKey(input.now),
          {
            interactions: 1,
            correct: review.scored && r.correct ? 1 : 0,
            incorrect: review.scored && !r.correct ? 1 : 0,
            newItems: review.wasNew ? 1 : 0,
            reviews: review.wasNew ? 0 : 1,
            grammarAnswered: input.itemType === 'grammar' && input.exerciseType !== 'intro' ? 1 : 0,
          },
          input.now,
        );
        result = review;
      });
      if (!result) throw new Error('Review was not recorded');
      return result;
    },

    async getLevelAccuracy(language, since) {
      const rows = await db.getAllAsync<{ level: string; reviews: number; correct: number }>(
        `SELECT li.cefr_level AS level, COUNT(*) AS reviews, SUM(rh.correct) AS correct
         FROM review_history rh
         JOIN learning_items li ON li.id = rh.item_id
         WHERE li.language = ? AND li.source = 'seed' AND rh.exercise_type != 'intro' AND rh.reviewed_at >= ?
         GROUP BY li.cefr_level`,
        [language, since],
      );
      return rows.flatMap((r) => {
        const level = cefrLevelSchema.safeParse(r.level);
        return level.success ? [{ level: level.data, reviews: r.reviews, correct: r.correct }] : [];
      });
    },

    async getLastExerciseTypes(itemIds) {
      if (itemIds.length === 0) return new Map();
      const placeholders = itemIds.map(() => '?').join(', ');
      const rows = await db.getAllAsync<{ item_id: string; exercise_type: string }>(
        `SELECT rh.item_id, rh.exercise_type FROM review_history rh
         JOIN (SELECT item_id, MAX(id) AS max_id FROM review_history
               WHERE item_id IN (${placeholders}) GROUP BY item_id) latest
           ON latest.max_id = rh.id`,
        [...itemIds],
      );
      return new Map(rows.map((r) => [r.item_id, r.exercise_type]));
    },
  };
}
