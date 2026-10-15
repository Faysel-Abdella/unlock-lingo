import type { Database, SqlValue } from '@/services/database/types';
import type { CefrLevel, LanguageCode } from '@/types/language';
import type { LearningItem, LearningItemType, LearningStatus, VocabularyItem } from '@/types/learning';

import { ITEM_SELECT, type ItemRow, itemFromRow } from './rows';

export interface VocabularyListEntry {
  item: VocabularyItem;
  status: LearningStatus;
  dueAt: number | null;
  isPersonal: boolean;
}

export interface VocabularyQuery {
  language: LanguageCode;
  search?: string;
  level?: CefrLevel | null;
  limit?: number;
}

export interface LevelTotals {
  level: CefrLevel;
  total: number;
  mastered: number;
}

export interface ContentRepository {
  getItem(id: string): Promise<LearningItem | null>;
  getItems(ids: readonly string[]): Promise<LearningItem[]>;
  /** A sample of items used as distractor sources for exercise generation. */
  getExercisePool(language: LanguageCode, type: LearningItemType, limit?: number): Promise<LearningItem[]>;
  listVocabulary(query: VocabularyQuery): Promise<VocabularyListEntry[]>;
  findVocabularyByWord(language: LanguageCode, word: string): Promise<VocabularyItem | null>;
  levelTotals(language: LanguageCode): Promise<LevelTotals[]>;
}

export function createContentRepository(db: Database): ContentRepository {
  return {
    async getItem(id) {
      const row = await db.getFirstAsync<ItemRow>(`${ITEM_SELECT} WHERE li.id = ?`, [id]);
      return row ? itemFromRow(row) : null;
    },

    async getItems(ids) {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(', ');
      const rows = await db.getAllAsync<ItemRow>(`${ITEM_SELECT} WHERE li.id IN (${placeholders})`, [...ids]);
      const byId = new Map(rows.map((r) => [r.id, itemFromRow(r)]));
      return ids.flatMap((id) => byId.get(id) ?? []);
    },

    async getExercisePool(language, type, limit = 200) {
      const rows = await db.getAllAsync<ItemRow>(
        `${ITEM_SELECT} WHERE li.language = ? AND li.type = ? ORDER BY RANDOM() LIMIT ?`,
        [language, type, limit],
      );
      return rows.map(itemFromRow);
    },

    async listVocabulary({ language, search, level, limit = 500 }) {
      const where = ["li.language = ?", "li.type = 'vocabulary'"];
      const params: SqlValue[] = [language];
      const term = search?.trim();
      if (term) {
        where.push('(v.word LIKE ? COLLATE NOCASE OR v.definition LIKE ? COLLATE NOCASE)');
        params.push(`%${term}%`, `%${term}%`);
      }
      if (level) {
        where.push('li.cefr_level = ?');
        params.push(level);
      }
      params.push(limit);
      const rows = await db.getAllAsync<
        ItemRow & { status: LearningStatus | null; due_at: number | null; personal_id: string | null }
      >(
        `SELECT q.*, lp.status, lp.due_at, pv.id AS personal_id
         FROM (${ITEM_SELECT} WHERE ${where.join(' AND ')}) q
         LEFT JOIN learning_progress lp ON lp.item_id = q.id
         LEFT JOIN personal_vocabulary pv ON pv.item_id = q.id
         ORDER BY q.word COLLATE NOCASE
         LIMIT ?`,
        params,
      );
      return rows.map((row) => ({
        item: itemFromRow(row) as VocabularyItem,
        status: row.status ?? 'new',
        dueAt: row.due_at,
        isPersonal: row.personal_id !== null,
      }));
    },

    async findVocabularyByWord(language, word) {
      const row = await db.getFirstAsync<ItemRow>(
        `${ITEM_SELECT} WHERE li.language = ? AND li.type = 'vocabulary' AND v.word = ? COLLATE NOCASE
         ORDER BY CASE li.source WHEN 'seed' THEN 0 ELSE 1 END LIMIT 1`,
        [language, word.trim()],
      );
      return row ? (itemFromRow(row) as VocabularyItem) : null;
    },

    async levelTotals(language) {
      return db.getAllAsync<LevelTotals>(
        `SELECT li.cefr_level AS level, COUNT(*) AS total,
                SUM(CASE WHEN lp.status = 'mastered' OR pv.is_mastered = 1 THEN 1 ELSE 0 END) AS mastered
         FROM learning_items li
         LEFT JOIN learning_progress lp ON lp.item_id = li.id
         LEFT JOIN personal_vocabulary pv ON pv.item_id = li.id
         WHERE li.language = ? AND li.source = 'seed'
         GROUP BY li.cefr_level
         ORDER BY li.cefr_level`,
        [language],
      );
    },
  };
}
