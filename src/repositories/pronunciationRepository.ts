import type { PronunciationVerdict } from '@/features/audio/domain/pronunciation';
import type { Database } from '@/services/database/types';
import type { LanguageCode } from '@/types/language';

export interface PronunciationAttempt {
  itemId: string;
  expected: string;
  heard: string | null;
  similarity: number;
  verdict: PronunciationVerdict;
  attemptedAt: number;
}

export interface PronunciationStats {
  attempts: number;
  clear: number;
  /** Items whose latest attempt was not clear, most recent first. */
  needsPractice: { itemId: string; expected: string }[];
}

export interface PronunciationRepository {
  record(attempt: PronunciationAttempt): Promise<void>;
  stats(language: LanguageCode, since: number, limit?: number): Promise<PronunciationStats>;
}

export function createPronunciationRepository(db: Database): PronunciationRepository {
  return {
    async record(a) {
      await db.runAsync(
        `INSERT INTO pronunciation_attempts (item_id, expected, heard, similarity, verdict, attempted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [a.itemId, a.expected, a.heard, a.similarity, a.verdict, a.attemptedAt],
      );
    },

    async stats(language, since, limit = 6) {
      const totals = await db.getFirstAsync<{ attempts: number; clear: number | null }>(
        `SELECT COUNT(*) AS attempts, SUM(pa.verdict = 'clear') AS clear
         FROM pronunciation_attempts pa JOIN learning_items li ON li.id = pa.item_id
         WHERE li.language = ? AND pa.attempted_at >= ?`,
        [language, since],
      );
      const latest = await db.getAllAsync<{ item_id: string; expected: string }>(
        `SELECT pa.item_id, pa.expected
         FROM pronunciation_attempts pa JOIN learning_items li ON li.id = pa.item_id
         WHERE li.language = ? AND pa.attempted_at >= ? AND pa.id = (
           SELECT id FROM pronunciation_attempts latest
           WHERE latest.item_id = pa.item_id ORDER BY attempted_at DESC, id DESC LIMIT 1
         ) AND pa.verdict <> 'clear'
         ORDER BY pa.attempted_at DESC LIMIT ?`,
        [language, since, limit],
      );
      return {
        attempts: totals?.attempts ?? 0,
        clear: totals?.clear ?? 0,
        needsPractice: latest.map((r) => ({ itemId: r.item_id, expected: r.expected })),
      };
    },
  };
}
