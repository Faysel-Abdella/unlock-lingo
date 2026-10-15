import { effectiveStatus } from '@/features/learning/domain/review';
import type { Database } from '@/services/database/types';
import type { CefrLevel, LanguageCode } from '@/types/language';
import type { LearningStatus, PersonalWordFlags, VocabularyItem } from '@/types/learning';
import { createId } from '@/utils/random';

import type { ContentRepository } from './contentRepository';
import { ITEM_SELECT, type ItemRow, fromBool, itemFromRow, toBool } from './rows';

export const WORD_SOURCES = ['work', 'reading', 'conversation', 'article', 'book', 'other'] as const;
export type WordSource = (typeof WORD_SOURCES)[number];
export type EnrichmentStatus = 'pending' | 'enriched' | 'not_found';

export interface PersonalWord {
  id: string;
  itemId: string;
  word: string;
  contextNote: string | null;
  source: WordSource;
  flags: PersonalWordFlags;
  enrichmentStatus: EnrichmentStatus;
  addedAt: number;
  item: VocabularyItem;
  status: LearningStatus;
  dueAt: number | null;
  /** True when the word is linked to bundled content rather than created by the user. */
  isBundled: boolean;
}

export interface AddWordInput {
  word: string;
  contextNote?: string | null;
  source?: WordSource;
  language: LanguageCode;
  /** Level assigned to words not found in bundled content. */
  defaultLevel: CefrLevel;
}

/** Details the learner (or a future enrichment provider) can fill in for their own words. */
export interface WordDetails {
  definition?: string | null;
  example?: string | null;
  pronunciation?: string | null;
  partOfSpeech?: string | null;
  synonyms?: string[];
  antonyms?: string[];
  translations?: VocabularyItem['translations'];
}

export interface PersonalVocabularyRepository {
  list(): Promise<PersonalWord[]>;
  get(id: string): Promise<PersonalWord | null>;
  findByItemId(itemId: string): Promise<PersonalWord | null>;
  /**
   * Adds a word. If it exists in bundled content, the entry links to it and is
   * enriched immediately. Adding a word already in My Words returns the existing entry.
   */
  add(input: AddWordInput, now: number): Promise<{ word: PersonalWord; created: boolean }>;
  updateFlags(id: string, flags: Partial<PersonalWordFlags>, now: number): Promise<void>;
  updateNote(id: string, contextNote: string | null, source: WordSource, now: number): Promise<void>;
  /** Fills in details for a user-created word. Bundled entries are read-only. */
  updateDetails(id: string, details: WordDetails, now: number): Promise<void>;
  remove(id: string): Promise<void>;
}

type PersonalRow = ItemRow & {
  pv_id: string;
  pv_word: string;
  context_note: string | null;
  pv_source: WordSource;
  is_important: number;
  is_difficult: number;
  is_mastered: number;
  enrichment_status: EnrichmentStatus;
  added_at: number;
  status: LearningStatus | null;
  due_at: number | null;
};

const PERSONAL_SELECT = `
SELECT q.*, pv.id AS pv_id, pv.word AS pv_word, pv.context_note, pv.source AS pv_source,
       pv.is_important, pv.is_difficult, pv.is_mastered, pv.enrichment_status, pv.added_at,
       lp.status, lp.due_at
FROM personal_vocabulary pv
JOIN (${ITEM_SELECT}) q ON q.id = pv.item_id
LEFT JOIN learning_progress lp ON lp.item_id = pv.item_id`;

function fromRow(row: PersonalRow): PersonalWord {
  const flags: PersonalWordFlags = {
    isImportant: toBool(row.is_important),
    isDifficult: toBool(row.is_difficult),
    isMastered: toBool(row.is_mastered),
  };
  return {
    id: row.pv_id,
    itemId: row.id,
    word: row.pv_word,
    contextNote: row.context_note,
    source: row.pv_source,
    flags,
    enrichmentStatus: row.enrichment_status,
    addedAt: row.added_at,
    item: itemFromRow(row) as VocabularyItem,
    status: effectiveStatus(row.status ?? 'new', flags),
    dueAt: row.due_at,
    isBundled: row.source === 'seed',
  };
}

export function normalizeWord(word: string): string {
  return word.trim().replace(/\s+/g, ' ');
}

export function createPersonalVocabularyRepository(
  db: Database,
  content: ContentRepository,
): PersonalVocabularyRepository {
  async function get(id: string): Promise<PersonalWord | null> {
    const row = await db.getFirstAsync<PersonalRow>(`${PERSONAL_SELECT} WHERE pv.id = ?`, [id]);
    return row ? fromRow(row) : null;
  }

  return {
    async list() {
      const rows = await db.getAllAsync<PersonalRow>(`${PERSONAL_SELECT} ORDER BY pv.added_at DESC`, []);
      return rows.map(fromRow);
    },

    get,

    async findByItemId(itemId) {
      const row = await db.getFirstAsync<PersonalRow>(`${PERSONAL_SELECT} WHERE pv.item_id = ?`, [itemId]);
      return row ? fromRow(row) : null;
    },

    async add(input, now) {
      const word = normalizeWord(input.word);
      if (!word) throw new Error('Word must not be empty');

      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT pv.id FROM personal_vocabulary pv
         JOIN learning_items li ON li.id = pv.item_id
         WHERE pv.word = ? COLLATE NOCASE AND li.language = ?`,
        [word, input.language],
      );
      if (existing) {
        const found = await get(existing.id);
        if (found) return { word: found, created: false };
      }

      const id = createId('pw-');
      const bundled = await content.findVocabularyByWord(input.language, word);

      await db.withTransactionAsync(async () => {
        let itemId: string;
        if (bundled) {
          itemId = bundled.id;
        } else {
          itemId = createId(`${input.language}-user-`);
          await db.runAsync(
            `INSERT INTO learning_items (id, type, language, cefr_level, difficulty, tags, source, created_at, updated_at)
             VALUES (?, 'vocabulary', ?, ?, 5, '["personal"]', 'user', ?, ?)`,
            [itemId, input.language, input.defaultLevel, now, now],
          );
          await db.runAsync('INSERT INTO vocabulary_items (item_id, word) VALUES (?, ?)', [itemId, word]);
        }
        await db.runAsync(
          `INSERT INTO personal_vocabulary
             (id, item_id, word, context_note, source, enrichment_status, added_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            itemId,
            bundled ? bundled.word : word,
            input.contextNote?.trim() || null,
            input.source ?? 'other',
            bundled ? 'enriched' : 'pending',
            now,
            now,
          ],
        );
      });

      const created = await get(id);
      if (!created) throw new Error('Failed to add word');
      return { word: created, created: true };
    },

    async updateFlags(id, flags, now) {
      const sets: string[] = [];
      const params: (number | string)[] = [];
      if (flags.isImportant !== undefined) {
        sets.push('is_important = ?');
        params.push(fromBool(flags.isImportant));
      }
      if (flags.isDifficult !== undefined) {
        sets.push('is_difficult = ?');
        params.push(fromBool(flags.isDifficult));
      }
      if (flags.isMastered !== undefined) {
        sets.push('is_mastered = ?');
        params.push(fromBool(flags.isMastered));
      }
      if (sets.length === 0) return;
      await db.runAsync(`UPDATE personal_vocabulary SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [
        ...params,
        now,
        id,
      ]);
    },

    async updateNote(id, contextNote, source, now) {
      await db.runAsync('UPDATE personal_vocabulary SET context_note = ?, source = ?, updated_at = ? WHERE id = ?', [
        contextNote?.trim() || null,
        source,
        now,
        id,
      ]);
    },

    async updateDetails(id, details, now) {
      const entry = await get(id);
      if (!entry) throw new Error('Word not found');
      if (entry.isBundled) throw new Error('Bundled words cannot be edited');
      const item = entry.item;
      const merged = {
        definition: details.definition !== undefined ? details.definition?.trim() || null : item.definition,
        example: details.example !== undefined ? details.example?.trim() || null : item.example,
        pronunciation: details.pronunciation !== undefined ? details.pronunciation?.trim() || null : item.pronunciation,
        partOfSpeech: details.partOfSpeech !== undefined ? details.partOfSpeech?.trim() || null : item.partOfSpeech,
        synonyms: details.synonyms ?? item.synonyms,
        antonyms: details.antonyms ?? item.antonyms,
        translations: details.translations ?? item.translations,
      };
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE vocabulary_items SET definition = ?, example = ?, pronunciation = ?, part_of_speech = ?,
             synonyms = ?, antonyms = ?, translations = ? WHERE item_id = ?`,
          [
            merged.definition,
            merged.example,
            merged.pronunciation,
            merged.partOfSpeech,
            JSON.stringify(merged.synonyms),
            JSON.stringify(merged.antonyms),
            JSON.stringify(merged.translations),
            entry.itemId,
          ],
        );
        await db.runAsync(
          `UPDATE personal_vocabulary SET enrichment_status = ?, updated_at = ? WHERE id = ?`,
          [merged.definition ? 'enriched' : 'pending', now, id],
        );
        await db.runAsync('UPDATE learning_items SET updated_at = ? WHERE id = ?', [now, entry.itemId]);
      });
    },

    async remove(id) {
      const entry = await get(id);
      if (!entry) return;
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM personal_vocabulary WHERE id = ?', [id]);
        // A user-created word only exists for My Words; bundled content and its progress stay.
        if (!entry.isBundled) await db.runAsync('DELETE FROM learning_items WHERE id = ?', [entry.itemId]);
      });
    },
  };
}
