import { z } from 'zod';

import {
  type CefrLevel,
  type LanguageCode,
  cefrLevelSchema,
  languageCodeSchema,
} from '@/types/language';
import type {
  FsrsState,
  ItemSource,
  LearningItem,
  LearningProgress,
  LearningStatus,
  PersonalWordFlags,
  Rating,
} from '@/types/learning';

const stringList = z.array(z.string());
const translationMap = z.partialRecord(languageCodeSchema, z.string());

/** Parses a JSON column, falling back instead of crashing on corrupt data. */
export function parseJson<T>(schema: z.ZodType<T>, text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

export const toBool = (value: number | null | undefined): boolean => value === 1;
export const fromBool = (value: boolean): number => (value ? 1 : 0);

function toLanguage(value: string): LanguageCode {
  const parsed = languageCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : 'en';
}

function toLevel(value: string): CefrLevel {
  const parsed = cefrLevelSchema.safeParse(value);
  return parsed.success ? parsed.data : 'B1';
}

/** Columns selected by `ITEM_SELECT`. */
export interface ItemRow {
  id: string;
  type: LearningItem['type'];
  language: string;
  cefr_level: string;
  difficulty: number;
  tags: string;
  source: ItemSource;
  word: string | null;
  pronunciation: string | null;
  part_of_speech: string | null;
  definition: string | null;
  v_example: string | null;
  translations: string | null;
  synonyms: string | null;
  antonyms: string | null;
  audio_uri: string | null;
  rule: string | null;
  explanation: string | null;
  g_example: string | null;
  question: string | null;
  options: string | null;
  correct_answer: string | null;
  answer_explanation: string | null;
  phrase: string | null;
  meaning: string | null;
  p_example: string | null;
  usage_note: string | null;
}

export const ITEM_SELECT = `
SELECT li.id, li.type, li.language, li.cefr_level, li.difficulty, li.tags, li.source,
       v.word, v.pronunciation, v.part_of_speech, v.definition, v.example AS v_example,
       v.translations, v.synonyms, v.antonyms, v.audio_uri,
       g.rule, g.explanation, g.example AS g_example, g.question, g.options, g.correct_answer,
       g.answer_explanation,
       p.phrase, p.meaning, p.example AS p_example, p.usage_note
FROM learning_items li
LEFT JOIN vocabulary_items v ON v.item_id = li.id
LEFT JOIN grammar_items g ON g.item_id = li.id
LEFT JOIN phrase_items p ON p.item_id = li.id`;

export function itemFromRow(row: ItemRow): LearningItem {
  const base = {
    id: row.id,
    language: toLanguage(row.language),
    cefrLevel: toLevel(row.cefr_level),
    difficulty: row.difficulty,
    tags: parseJson(stringList, row.tags, []),
    source: row.source,
  };
  switch (row.type) {
    case 'grammar':
      return {
        ...base,
        type: 'grammar',
        rule: row.rule ?? '',
        explanation: row.explanation ?? '',
        example: row.g_example ?? '',
        question: row.question ?? '',
        options: parseJson(stringList, row.options, []),
        correctAnswer: row.correct_answer ?? '',
        answerExplanation: row.answer_explanation ?? '',
      };
    case 'phrase':
      return {
        ...base,
        type: 'phrase',
        phrase: row.phrase ?? '',
        meaning: row.meaning ?? '',
        example: row.p_example ?? '',
        usageNote: row.usage_note,
      };
    case 'vocabulary':
      return {
        ...base,
        type: 'vocabulary',
        word: row.word ?? '',
        pronunciation: row.pronunciation,
        partOfSpeech: row.part_of_speech,
        definition: row.definition,
        example: row.v_example,
        translations: parseJson(translationMap, row.translations, {}),
        synonyms: parseJson(stringList, row.synonyms, []),
        antonyms: parseJson(stringList, row.antonyms, []),
        audioUri: row.audio_uri,
      };
  }
}

export interface ProgressRow {
  item_id: string;
  status: LearningStatus;
  fsrs_state: FsrsState;
  stability: number;
  difficulty: number;
  due_at: number | null;
  last_reviewed_at: number | null;
  reps: number;
  lapses: number;
  seen_count: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  confidence: number;
  last_rating: number | null;
}

export const PROGRESS_COLUMNS = `item_id, status, fsrs_state, stability, difficulty, due_at, last_reviewed_at,
  reps, lapses, seen_count, correct_count, incorrect_count, streak, confidence, last_rating`;

function toRating(value: number | null): Rating | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

export function progressFromRow(row: ProgressRow): LearningProgress {
  return {
    itemId: row.item_id,
    status: row.status,
    fsrsState: row.fsrs_state,
    stability: row.stability,
    difficulty: row.difficulty,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
    reps: row.reps,
    lapses: row.lapses,
    seenCount: row.seen_count,
    correctCount: row.correct_count,
    incorrectCount: row.incorrect_count,
    streak: row.streak,
    confidence: row.confidence,
    lastRating: toRating(row.last_rating),
  };
}

export interface FlagRow {
  is_important: number | null;
  is_difficult: number | null;
  is_mastered: number | null;
}

export function flagsFromRow(row: FlagRow & { personal_id: string | null }): PersonalWordFlags | null {
  if (row.personal_id === null) return null;
  return {
    isImportant: toBool(row.is_important),
    isDifficult: toBool(row.is_difficult),
    isMastered: toBool(row.is_mastered),
  };
}
